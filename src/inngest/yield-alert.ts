/**
 * fetcher 산출 감시 — 조용한 데이터 유실 알림 (PLAN 4.27, ADR-0054)
 *
 * 왜 이 모듈이 존재하는가?
 *   fetcher 고장은 "에러"가 아니라 **"숫자가 줄어드는 침묵"** 으로 나타난다.
 *   2026-08 라운드에서 한 번에 3건이 이 형태로 발견됐고, 전부 사람이 우연히 찾았다:
 *     • Orange internet   — 페이지가 JS 렌더로 전환 → 매일 파싱 0건, 없는 상품이 DB 잔존
 *     • Proximus internet — 프로모 표기가 `€0` 정수로 바뀜 → 4개 중 3개 유실
 *     • Telenet mobile    — 결합가 카드가 실가격을 갖게 됨 → 절반 가격 혼입 직전
 *   셋 다 HTTP 200 이고 예외도 없다. 감시 없이는 다음 번에도 우연에 기댄다.
 *
 * 설계 원칙
 *   • 판정은 **순수 함수**(`evaluateYield`) — DB/네트워크 없이 테스트 가능.
 *   • 보고는 **부수효과 함수**(`reportYieldFindings`) — Sentry + Inngest logger.
 *   • 알림 실패가 cron 을 깨지 않는다 (1.9 격리 정신).
 *
 * 결정 근거: docs/adr/0054-fetcher-yield-drop-alerting.md
 */

import * as Sentry from '@sentry/nextjs';

import type { TariffCategory } from '@/db/schema/tariff';
import type { YieldByCategory } from '@/db/queries/fetcher-yield';

// ─── 임계 (ADR-0054 §D5) ──────────────────────────────────────────────────

/**
 * 급감 판정 비율 — 직전 대비 30% 이상 감소.
 * 실측 근거: Proximus internet 4 → 1 = −75%. 정상 변동(요금제 1개 단종)은
 * 5개 중 1개 = −20% 수준이라 30% 아래에 머문다.
 */
export const SHARP_DROP_RATIO = 0.3;

/**
 * 급감 판정 최소 표본 — 직전 건수가 3 이상일 때만 비율 판정.
 * 1 → 0 같은 소표본은 비율이 −100% 로 튀어 노이즈가 된다. 그런 경우는
 * `zero_yield` 가 이미 잡으므로 이중 알림도 피한다.
 */
export const MIN_PREVIOUS_FOR_DROP = 3;

// ─── 판정 결과 ────────────────────────────────────────────────────────────

export type YieldFindingKind = 'fetch_failed' | 'zero_yield' | 'sharp_drop';

export interface YieldFinding {
  readonly kind: YieldFindingKind;
  readonly providerSlug: string;
  /** fetch_failed 는 카테고리 단위가 아니므로 null. */
  readonly category: TariffCategory | null;
  readonly current: number;
  readonly previous: number | null;
  /** 사람이 읽는 한 줄 — Sentry issue 제목이 된다. */
  readonly message: string;
}

export interface EvaluateYieldInput {
  readonly providerSlug: string;
  /** fetcher metadata.categories — "내가 커버한다고 선언한" 목록. */
  readonly declaredCategories: readonly TariffCategory[];
  /** 이번 실행에서 실제로 산출된 카테고리별 건수. */
  readonly currentCounts: YieldByCategory;
  /** 직전 성공 실행의 카테고리별 건수. 첫 실행이면 빈 객체. */
  readonly previousCounts: YieldByCategory;
  /**
   * fetcher 가 커버 중단을 선언한 카테고리 (FetchResult.retiredCategories).
   * 의도적으로 0건이므로 zero_yield 대상에서 제외한다.
   */
  readonly retiredCategories?: readonly TariffCategory[];
}

// ─── 판정 (순수) ──────────────────────────────────────────────────────────

/** 이번 실행 결과를 직전 실행과 대조해 알릴 만한 이상을 찾는다. */
export function evaluateYield(input: EvaluateYieldInput): YieldFinding[] {
  const retired = new Set(input.retiredCategories ?? []);
  const findings: YieldFinding[] = [];

  for (const category of input.declaredCategories) {
    if (retired.has(category)) continue;

    const current = input.currentCounts[category] ?? 0;
    const previous = input.previousCounts[category] ?? null;

    // (a) 선언해 놓고 0건 — 가장 심각. Orange internet 사고의 형태.
    if (current === 0) {
      findings.push({
        kind: 'zero_yield',
        providerSlug: input.providerSlug,
        category,
        current,
        previous,
        message: `fetcher '${input.providerSlug}' 가 선언한 카테고리 '${category}' 에서 0건 산출 (직전 ${previous ?? '기록 없음'}건) — 파서 또는 공급사 페이지 변경 의심`,
      });
      continue; // 0건은 sharp_drop 중복 판정 안 함
    }

    // (b) 급감 — Proximus internet 4 → 1 의 형태.
    if (previous !== null && previous >= MIN_PREVIOUS_FOR_DROP) {
      const dropRatio = (previous - current) / previous;
      if (dropRatio >= SHARP_DROP_RATIO) {
        findings.push({
          kind: 'sharp_drop',
          providerSlug: input.providerSlug,
          category,
          current,
          previous,
          message: `fetcher '${input.providerSlug}' / '${category}' 산출 급감: ${previous} → ${current} (−${Math.round(dropRatio * 100)}%) — 일부 요금제 유실 의심`,
        });
      }
    }
  }

  return findings;
}

/** fetcher 전체 실패(ok:false)를 finding 으로 변환. */
export function fetchFailureFinding(
  providerSlug: string,
  kind: string,
  errorMessage: string,
): YieldFinding {
  return {
    kind: 'fetch_failed',
    providerSlug,
    category: null,
    current: 0,
    previous: null,
    message: `fetcher '${providerSlug}' 실행 실패 (${kind}): ${errorMessage}`,
  };
}

// ─── 보고 (부수효과) ──────────────────────────────────────────────────────

interface MinimalLogger {
  error: (payload: Record<string, unknown>) => void;
}

/**
 * finding 을 Sentry + logger 로 내보낸다.
 *
 * 왜 전부 level='error' 인가? (ADR-0054 §D3)
 *   운영 알림 룰 1(`docs/runbook/sentry-alert-rules.md`)이 **`level:error` 이상만**
 *   이메일로 보낸다 — warning 으로 올리면 아무도 보지 않는 로그가 하나 더 생길 뿐이고,
 *   그건 이 항목이 없애려는 바로 그 상태다.
 *
 * 왜 fingerprint 를 고정하는가?
 *   같은 고장이 매일 반복돼도 Sentry issue 는 하나로 묶이고, 룰 2(신규 issue 첫 발생)가
 *   **1회만** 이메일을 보낸다. 알림 피로 없이 침묵도 없다.
 *
 * Sentry DSN 미등록 상태에서는 `enabled:false` 라 no-op — logger 기록은 그대로 남는다.
 */
export function reportYieldFindings(
  findings: readonly YieldFinding[],
  logger: MinimalLogger,
): void {
  for (const f of findings) {
    logger.error({
      msg: 'fetcher 산출 이상 감지',
      kind: f.kind,
      fetcherSlug: f.providerSlug,
      category: f.category,
      current: f.current,
      previous: f.previous,
      detail: f.message,
    });

    try {
      Sentry.captureMessage(f.message, {
        level: 'error',
        tags: {
          feature: 'fetcher-yield',
          yield_kind: f.kind,
          fetcher: f.providerSlug,
          ...(f.category ? { category: f.category } : {}),
        },
        extra: { current: f.current, previous: f.previous },
        fingerprint: ['fetcher-yield', f.kind, f.providerSlug, f.category ?? 'all'],
      });
    } catch {
      // Sentry 미초기화/전송 실패가 cron 을 깨지 않는다.
    }
  }
}

/** TariffSnapshotInput[] → 카테고리별 건수. */
export function countByCategory(
  data: ReadonlyArray<{ readonly category: TariffCategory }>,
): YieldByCategory {
  const counts: YieldByCategory = {};
  for (const row of data) {
    counts[row.category] = (counts[row.category] ?? 0) + 1;
  }
  return counts;
}
