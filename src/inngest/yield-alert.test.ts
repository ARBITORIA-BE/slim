/**
 * fetcher 산출 감시 단위 테스트 (PLAN 4.27, ADR-0054)
 *
 * 케이스 설계 원칙: **실제로 일어난 사고 3건을 그대로 재현**한다.
 * 합성 시나리오로만 채우면 "다음에도 못 잡는" 감시가 만들어진다.
 *   • Orange internet   (2026-08-19 발견) — 선언한 카테고리 산출 0건
 *   • Proximus internet (2026-08-20 발견) — 4 → 1 (−75%)
 *   • Telenet mobile    (2026-08-19 발견) — 결합가 혼입. 건수는 그대로라
 *     본 감시로는 못 잡는다는 사실을 테스트로 못박는다 (한계의 명시).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  MIN_PREVIOUS_FOR_DROP,
  SHARP_DROP_RATIO,
  countByCategory,
  evaluateYield,
  fetchFailureFinding,
  reportYieldFindings,
} from './yield-alert';

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
}));
import * as Sentry from '@sentry/nextjs';

afterEach(() => {
  vi.clearAllMocks();
});

// ─── 판정 (순수 함수) ────────────────────────────────────────────────────

describe('evaluateYield — 실제 사고 재현', () => {
  it('Orange internet 사고: 선언한 카테고리에서 0건 → zero_yield', () => {
    const findings = evaluateYield({
      providerSlug: 'orange-be',
      declaredCategories: ['internet_fixed'],
      currentCounts: {}, // 파서가 아무것도 못 뽑음
      previousCounts: { internet_fixed: 3 }, // Start / Zen / Giga
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe('zero_yield');
    expect(findings[0]?.category).toBe('internet_fixed');
    expect(findings[0]?.current).toBe(0);
    expect(findings[0]?.previous).toBe(3);
    expect(findings[0]?.message).toContain('orange-be');
  });

  it('Proximus internet 사고: 4 → 1 (−75%) → sharp_drop', () => {
    const findings = evaluateYield({
      providerSlug: 'proximus-be',
      declaredCategories: ['mobile', 'internet_fixed'],
      currentCounts: { mobile: 5, internet_fixed: 1 },
      previousCounts: { mobile: 5, internet_fixed: 4 },
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe('sharp_drop');
    expect(findings[0]?.category).toBe('internet_fixed');
    expect(findings[0]?.message).toContain('4 → 1');
    expect(findings[0]?.message).toContain('75%');
  });

  it('⚠️ 한계 명시 — Telenet mobile 결합가 혼입은 건수가 같아 못 잡는다', () => {
    // 결합가 카드가 실가격을 갖게 된 사고. 산출 건수는 2로 동일하고
    // *가격만* 절반이 된다 → 본 감시의 사각지대 (ADR-0054 §잃는 것).
    const findings = evaluateYield({
      providerSlug: 'telenet-be',
      declaredCategories: ['mobile'],
      currentCounts: { mobile: 2 },
      previousCounts: { mobile: 2 },
    });

    expect(findings).toEqual([]);
  });
});

describe('evaluateYield — 오탐 억제', () => {
  it('요금제 1개 단종 수준의 정상 변동(5 → 4, −20%)은 알리지 않는다', () => {
    const findings = evaluateYield({
      providerSlug: 'proximus-be',
      declaredCategories: ['mobile'],
      currentCounts: { mobile: 4 },
      previousCounts: { mobile: 5 },
    });

    expect(findings).toEqual([]);
  });

  it('소표본(직전 2건)에서는 비율 판정을 하지 않는다 — 2 → 1 은 침묵', () => {
    expect(MIN_PREVIOUS_FOR_DROP).toBe(3);

    const findings = evaluateYield({
      providerSlug: 'telenet-be',
      declaredCategories: ['mobile'],
      currentCounts: { mobile: 1 },
      previousCounts: { mobile: 2 },
    });

    expect(findings).toEqual([]);
  });

  it('임계 경계: 정확히 −30% 는 알린다 (10 → 7)', () => {
    expect(SHARP_DROP_RATIO).toBe(0.3);

    const findings = evaluateYield({
      providerSlug: 'telenet-be',
      declaredCategories: ['bundle_mobile_internet_tv'],
      currentCounts: { bundle_mobile_internet_tv: 7 },
      previousCounts: { bundle_mobile_internet_tv: 10 },
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe('sharp_drop');
  });

  it('첫 실행(직전 기록 없음) + 정상 산출 → 침묵', () => {
    const findings = evaluateYield({
      providerSlug: 'telenet-be',
      declaredCategories: ['bundle_internet_tv'],
      currentCounts: { bundle_internet_tv: 3 },
      previousCounts: {},
    });

    expect(findings).toEqual([]);
  });

  it('첫 실행이어도 0건이면 알린다 (신규 fetcher 가 처음부터 고장난 경우)', () => {
    const findings = evaluateYield({
      providerSlug: 'telenet-be',
      declaredCategories: ['bundle_internet_tv'],
      currentCounts: {},
      previousCounts: {},
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe('zero_yield');
    expect(findings[0]?.previous).toBeNull();
    expect(findings[0]?.message).toContain('기록 없음');
  });

  it('0건은 zero_yield 하나만 — sharp_drop 과 이중 알림하지 않는다', () => {
    const findings = evaluateYield({
      providerSlug: 'orange-be',
      declaredCategories: ['internet_fixed'],
      currentCounts: {},
      previousCounts: { internet_fixed: 10 },
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe('zero_yield');
  });

  it('커버 중단 선언(retiredCategories)한 카테고리는 0건이어도 침묵', () => {
    const findings = evaluateYield({
      providerSlug: 'orange-be',
      declaredCategories: ['internet_fixed', 'bundle_mobile_internet_tv'],
      currentCounts: { bundle_mobile_internet_tv: 3 },
      previousCounts: { internet_fixed: 3, bundle_mobile_internet_tv: 3 },
      retiredCategories: ['internet_fixed'],
    });

    expect(findings).toEqual([]);
  });
});

describe('countByCategory', () => {
  it('카테고리별로 센다', () => {
    expect(
      countByCategory([
        { category: 'mobile' },
        { category: 'mobile' },
        { category: 'internet_fixed' },
      ]),
    ).toEqual({ mobile: 2, internet_fixed: 1 });
  });

  it('빈 배열 → 빈 객체 (zero_yield 판정의 입력)', () => {
    expect(countByCategory([])).toEqual({});
  });
});

describe('fetchFailureFinding', () => {
  it('fetcher 전체 실패를 finding 으로 변환한다', () => {
    const f = fetchFailureFinding('orange-be', 'parse', 'No tariffs parsed');
    expect(f.kind).toBe('fetch_failed');
    expect(f.category).toBeNull();
    expect(f.message).toContain('orange-be');
    expect(f.message).toContain('parse');
  });
});

// ─── 보고 (부수효과) ──────────────────────────────────────────────────────

describe('reportYieldFindings', () => {
  it('logger.error + Sentry.captureMessage 를 finding 당 1회씩 호출한다', () => {
    const logger = { error: vi.fn() };
    const findings = evaluateYield({
      providerSlug: 'orange-be',
      declaredCategories: ['internet_fixed', 'bundle_mobile_internet_tv'],
      currentCounts: {},
      previousCounts: { internet_fixed: 3, bundle_mobile_internet_tv: 3 },
    });

    reportYieldFindings(findings, logger);

    expect(findings).toHaveLength(2);
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(2);
  });

  it("level='error' 로 올린다 — warning 은 운영 룰 1 에서 이메일이 안 간다", () => {
    const logger = { error: vi.fn() };
    reportYieldFindings([fetchFailureFinding('orange-be', 'network', 'HTTP 403')], logger);

    const call = vi.mocked(Sentry.captureMessage).mock.calls[0];
    expect(call?.[1]).toMatchObject({ level: 'error' });
  });

  it('fingerprint 를 고정해 같은 고장이 매일 반복돼도 issue 1개로 묶인다', () => {
    const logger = { error: vi.fn() };
    const finding = evaluateYield({
      providerSlug: 'proximus-be',
      declaredCategories: ['internet_fixed'],
      currentCounts: { internet_fixed: 1 },
      previousCounts: { internet_fixed: 4 },
    });

    reportYieldFindings(finding, logger);
    reportYieldFindings(finding, logger); // 다음 날 같은 고장

    const calls = vi.mocked(Sentry.captureMessage).mock.calls;
    expect(calls).toHaveLength(2);

    // captureMessage 2번째 인자는 CaptureContext | SeverityLevel 유니온 —
    // 우리가 넘긴 형태로 좁혀서 단언한다.
    type Ctx = { fingerprint?: readonly string[] };
    const ctx0 = calls[0]?.[1] as Ctx | undefined;
    const ctx1 = calls[1]?.[1] as Ctx | undefined;

    expect(ctx0?.fingerprint).toEqual([
      'fetcher-yield',
      'sharp_drop',
      'proximus-be',
      'internet_fixed',
    ]);
    // 두 호출의 fingerprint 가 동일해야 Sentry 가 같은 issue 로 묶는다
    expect(ctx0?.fingerprint).toEqual(ctx1?.fingerprint);
  });

  it('Sentry 전송이 throw 해도 예외를 전파하지 않는다 (cron 보호)', () => {
    vi.mocked(Sentry.captureMessage).mockImplementationOnce(() => {
      throw new Error('sentry down');
    });
    const logger = { error: vi.fn() };

    expect(() =>
      reportYieldFindings([fetchFailureFinding('orange-be', 'network', 'HTTP 403')], logger),
    ).not.toThrow();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
