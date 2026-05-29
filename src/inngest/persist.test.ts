/**
 * persistFetchResult 단위 테스트 — 단종 처리(ADR-0005 §T5) 집중 (PLAN 1.5.6 보강)
 *
 * 왜 이 테스트가 필요한가?
 *   fix(1.5.6) 에서 persist.ts 에 "이번 fetch 가 커버한 (provider, category) 범위의
 *   미관측 활성 요금제를 isActive=false" 단종 로직을 추가했다 (스텁→스크래핑 slug
 *   변경 시 고아 요금제가 24h 신선도 게이트를 영구 차단하는 문제 해소). 이 로직은
 *   비교 결과에 보이는 요금제 집합을 직접 좌우하므로 회귀 테스트가 필수다.
 *
 * 실 DB 없이 검증하는 방법:
 *   - `@/db` 를 in-memory mock 으로 대체 (select 호출 순서로 provider/tariff 분기).
 *   - drizzle 연산자(eq/and/inArray/notInArray)를 *inspectable descriptor* 로 mock
 *     → 단종 UPDATE 의 WHERE 스코프(provider id + 커버 카테고리 + seen id 제외)를
 *     실제 SQL 평가 없이 단언한다.
 *
 * 케이스:
 *   1. mobile + internet 결과 → 단종 WHERE = (providerId) ∧ category∈{mobile,internet_fixed}
 *      ∧ id∉{seen ids}
 *   2. mobile-only 결과 → 단종 카테고리 = {mobile} 만 (manual internet 보호)
 *   3. 빈 결과 → 함수 상단 early-return → 단종 UPDATE 0건
 *   4. 기존(update path) 요금제는 seen id 라 단종 제외 + isActive=true 갱신
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tariff } from '@/db/schema/tariff';
import type { TariffSnapshotInput, FetchResult } from '@/fetchers/types';

// ─── hoisted 공유 상태 (mock 클로저보다 먼저 평가) ──────────────────────────
const state = vi.hoisted(() => ({
  providerId: 'prov-1',
  selectCallCount: 0,
  /** result.data 인덱스별 기존 tariff id (없으면 null = insert 경로). */
  existingLookups: [] as (string | null)[],
  recordedUpdates: [] as { set: Record<string, unknown>; where: WhereDesc }[],
  nextTariffId: 1,
}));

/** mock 연산자가 만드는 inspectable WHERE descriptor. */
interface WhereDesc {
  __op: 'eq' | 'and' | 'inArray' | 'notInArray';
  col?: unknown;
  val?: unknown;
  vals?: unknown[];
  args?: WhereDesc[];
}

// ─── drizzle 연산자 mock — descriptor 화 (나머지는 actual 유지) ──────────────
vi.mock('drizzle-orm', async (importActual) => {
  const actual = await importActual<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown): WhereDesc => ({ __op: 'eq', col, val }),
    and: (...args: WhereDesc[]): WhereDesc => ({ __op: 'and', args }),
    inArray: (col: unknown, vals: unknown[]): WhereDesc => ({ __op: 'inArray', col, vals }),
    notInArray: (col: unknown, vals: unknown[]): WhereDesc => ({ __op: 'notInArray', col, vals }),
  };
});

// ─── @/db mock — select 호출 순서 기반 + update/insert 기록 ──────────────────
vi.mock('@/db', () => {
  const makeSelectChain = () => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.from = vi.fn(self);
    chain.where = vi.fn(self);
    chain.limit = vi.fn(() => {
      const idx = state.selectCallCount++;
      // idx 0 = provider lookup, idx 1.. = result.data[idx-1] 기존 tariff lookup
      if (idx === 0) return Promise.resolve([{ id: state.providerId }]);
      const existing = state.existingLookups[idx - 1];
      return Promise.resolve(existing ? [{ id: existing }] : []);
    });
    return chain;
  };

  return {
    db: {
      select: vi.fn(() => makeSelectChain()),
      insert: vi.fn(() => ({
        values: vi.fn(() => {
          // insert(tariff).values().returning() 와 insert(snapshot).values() 둘 다 지원:
          // values() 결과는 await 가능(snapshot) + .returning() 보유(tariff).
          const p = Promise.resolve(undefined) as Promise<undefined> & {
            returning: () => Promise<{ id: string }[]>;
          };
          p.returning = () =>
            Promise.resolve([{ id: `new-tariff-${state.nextTariffId++}` }]);
          return p;
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn((vals: Record<string, unknown>) => ({
          where: vi.fn((desc: WhereDesc) => {
            state.recordedUpdates.push({ set: vals, where: desc });
            return Promise.resolve(undefined);
          }),
        })),
      })),
    },
  };
});

// mock 이후 SUT import (vitest 가 vi.mock 을 hoist 하므로 순서 무관하나 명시)
import { persistFetchResult } from './persist';

// ─── fixture 헬퍼 ───────────────────────────────────────────────────────────
function makeResult(data: TariffSnapshotInput[]): FetchResult {
  return {
    fetcherSlug: 'proximus-be',
    fetchedAt: '2026-05-29T06:00:00.000Z',
    data,
  };
}

function mobileInput(slug: string, name: string): TariffSnapshotInput {
  return {
    providerSlug: 'proximus-be',
    tariffSlug: slug,
    tariffName: name,
    category: 'mobile',
    monthlyPriceCents: 1699,
    activationFeeCents: 0,
    modemRentalCents: null,
    promoPriceCents: null,
    promoMonths: null,
    promoDescription: null,
    commitmentMonths: 0,
    earlyTerminationFeeCents: null,
    attributes: {
      category: 'mobile',
      data_gb: 5,
      voice_minutes: 'unlimited',
      sms: 'unlimited',
      eu_roaming_included: true,
    },
    sourceUrl: 'https://www.proximus.be/en/mobile-subscription',
    confidence: 'high',
    confidenceReason: 'test',
    rawPayload: { stub: false },
  };
}

function internetInput(slug: string, name: string): TariffSnapshotInput {
  return {
    providerSlug: 'proximus-be',
    tariffSlug: slug,
    tariffName: name,
    category: 'internet_fixed',
    monthlyPriceCents: 5999,
    activationFeeCents: 0,
    modemRentalCents: 0,
    promoPriceCents: null,
    promoMonths: null,
    promoDescription: null,
    commitmentMonths: 0,
    earlyTerminationFeeCents: null,
    attributes: {
      category: 'internet_fixed',
      download_mbps: 150,
      upload_mbps: 30,
      unlimited_data: true,
      wifi_booster_included: false,
    },
    sourceUrl: 'https://www.proximus.be/en/internet',
    confidence: 'high',
    confidenceReason: 'test',
    rawPayload: { stub: false },
  };
}

/** recordedUpdates 에서 단종(isActive=false) UPDATE 를 찾는다. */
function findDeactivation(): { set: Record<string, unknown>; where: WhereDesc } | undefined {
  return state.recordedUpdates.find((u) => u.set['isActive'] === false);
}

beforeEach(() => {
  state.selectCallCount = 0;
  state.existingLookups = [];
  state.recordedUpdates = [];
  state.nextTariffId = 1;
});

// ─── 1. mobile + internet → 단종 스코프 = 두 카테고리 + seen id 제외 ─────────
describe('persistFetchResult — 단종 처리 스코프 (ADR-0005 §T5)', () => {
  it('mobile+internet 결과 → 단종 WHERE = providerId ∧ category∈{mobile,internet_fixed} ∧ id∉seen', async () => {
    state.existingLookups = [null, null]; // 둘 다 신규 insert → new-tariff-1, new-tariff-2

    await persistFetchResult(
      makeResult([mobileInput('proximus-mobile-easy', 'Mobile Easy'), internetInput('proximus-internet-go-fiber', 'Internet Go Fiber')]),
    );

    const deact = findDeactivation();
    if (!deact) throw new Error('단종 UPDATE 가 기록되지 않음');

    expect(deact.where.__op).toBe('and');
    const args = deact.where.args ?? [];

    const eqArg = args.find((a) => a.__op === 'eq');
    expect(eqArg?.col).toBe(tariff.providerId);
    expect(eqArg?.val).toBe('prov-1');

    const inArr = args.find((a) => a.__op === 'inArray');
    expect(inArr?.col).toBe(tariff.category);
    expect(new Set(inArr?.vals)).toEqual(new Set(['mobile', 'internet_fixed']));

    const notIn = args.find((a) => a.__op === 'notInArray');
    expect(notIn?.col).toBe(tariff.id);
    expect(new Set(notIn?.vals)).toEqual(new Set(['new-tariff-1', 'new-tariff-2']));
  });

  // ─── 2. mobile-only → manual internet 카테고리 보호 ────────────────────────
  it('mobile-only 결과 → 단종 카테고리 = {mobile} 만 (manual internet 미삭제)', async () => {
    state.existingLookups = [null];

    await persistFetchResult(makeResult([mobileInput('proximus-mobile-easy', 'Mobile Easy')]));

    const deact = findDeactivation();
    if (!deact) throw new Error('단종 UPDATE 가 기록되지 않음');

    const inArr = (deact.where.args ?? []).find((a) => a.__op === 'inArray');
    expect(new Set(inArr?.vals)).toEqual(new Set(['mobile']));
    // internet_fixed 는 이번 fetch 가 커버하지 않았으므로 단종 스코프에서 제외
    expect(inArr?.vals).not.toContain('internet_fixed');
  });

  // ─── 3. 빈 결과 → early-return → 단종 0건 ─────────────────────────────────
  it('빈 결과 → 함수 early-return → 단종 UPDATE 0건 (카테고리 통째 삭제 방지)', async () => {
    await persistFetchResult(makeResult([]));

    expect(findDeactivation()).toBeUndefined();
    expect(state.recordedUpdates.length).toBe(0);
  });

  // ─── 4. 기존(update path) 요금제는 seen id → 단종 제외 + isActive=true ──────
  it('기존 요금제(update path)는 seen id 라 단종에서 제외 + isActive=true 로 갱신', async () => {
    state.existingLookups = ['tariff-existing-1']; // 기존 행 존재 → update 경로

    await persistFetchResult(makeResult([mobileInput('proximus-mobile-essential', 'Mobile Essential')]));

    // 갱신: isActive=true 로 set 하는 update 존재
    const upTrue = state.recordedUpdates.find((u) => u.set['isActive'] === true);
    expect(upTrue).toBeDefined();

    // 단종: seen id(tariff-existing-1)는 notInArray 에 포함 → 자기 자신 비활성화 안 됨
    const deact = findDeactivation();
    if (!deact) throw new Error('단종 UPDATE 가 기록되지 않음');
    const notIn = (deact.where.args ?? []).find((a) => a.__op === 'notInArray');
    expect(notIn?.vals).toContain('tariff-existing-1');
  });
});
