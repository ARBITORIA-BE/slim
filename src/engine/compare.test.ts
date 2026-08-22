/**
 * compare() 단위 테스트 — 6 케이스 (PLAN 1.12, scope cut 옵션 B)
 *
 * 결정 근거: docs/adr/0010-comparison-engine.md §T7
 *
 * 6 케이스 (운영자 검증 가능 — 모든 expected 값은 cents 정수):
 *   1. 평균 커플 모바일 (€25 → €15) — €10/월 절약
 *   2. 저사용 1인 모바일 — 절약 0 (현재가 가장 저렴)
 *   3. 고사용 family 모바일 한도 초과 caveat (currentTariff GO 10 + 사용 50GB)
 *   4. VDSL → 케이블 인터넷 (€35 → €59 promo 첫 3개월) — 음의 절약 표시
 *   5. 약정 vs 비약정 — 신규 가입자, prom o 없는 게 1위
 *   6. 신규 가입자 (currentTariff null) 엣지
 *
 * 추가 단위 테스트 (T5/T6 강제):
 *   - 빈 candidates 배열 → 빈 ranked
 *   - 모두 confidence='low' → 빈 ranked + excludedByConfidence 카운트
 *   - 자기 참조 제외 (currentTariff 가 candidates 에 포함)
 *   - 카테고리 미스매치 제외 (T1)
 *   - avgMonthlyCents 산술 검증 4건
 *
 * 모든 expected 값 ±0.01€ DoD = ±0 cent (strict equality).
 */

import { describe, it, expect } from 'vitest';
import { parseCaveat } from './caveat-codes';
import { compare, ENGINE_VERSION, avgMonthlyCents } from './compare';
import type { TariffSnapshotLike, UsageProfile } from './types';

// ─── 테스트 fixture builder ───────────────────────────────────────────────

/**
 * 왜 builder 함수인가?
 *   각 케이스가 같은 모양의 객체를 약간씩 다르게 만든다. 평탄하게 모든 필드를
 *   매번 적으면 *어떤 필드가 핵심* 인지 가독성 ↓. builder + override 패턴이
 *   *왜 이 케이스가 다른지* 명확.
 */
export function makeSnapshot(
  override: Partial<TariffSnapshotLike> & {
    id: string;
    providerSlug: string;
    tariffSlug: string;
  },
): TariffSnapshotLike {
  return {
    category: 'mobile',
    monthlyPriceCents: 0,
    activationFeeCents: 0,
    modemRentalCents: null,
    promoPriceCents: null,
    promoMonths: null,
    commitmentMonths: 0,
    earlyTerminationFeeCents: null,
    attributes: {},
    confidence: 'high',
    confidenceReason: null,
    isAnomaly: false,
    ...override,
  };
}

/**
 * caveat 부분 문자열 매칭 helper.
 *
 * 왜 expect.toContain(expect.stringContaining(...)) 을 쓰지 않는가?
 *   vitest 의 `toContain` 은 strict equality 기반 — asymmetricMatcher 를
 *   원소로 받지 않는다. 부분 문자열 매칭에는 .some() 이 명료하고 견고.
 */
export function hasCaveatLike(caveats: readonly string[], code: string): boolean {
  return caveats.some((c) => parseCaveat(c)?.code === code);
}

/**
 * PLAN 4.28: 엔진은 문장이 아니라 caveat *코드* 를 낸다. 파라미터 단언용 helper.
 * 예: caveatParam(caveats, 'dataOverage', 'usedGb') === 50
 */
export function caveatParam(
  caveats: readonly string[],
  code: string,
  key: string,
): string | number | undefined {
  for (const raw of caveats) {
    const c = parseCaveat(raw);
    if (c?.code === code) return c.params[key];
  }
  return undefined;
}

// ─── 케이스 1: 평균 커플 모바일 (€25 → €15) — €10/월 절약 ──────────────

describe('compare() — 케이스 1: 평균 커플 모바일 (€25 → €15)', () => {
  it('Proximus Essential 이 1위, monthlySaving = 1000 cents (€10/월)', () => {
    // 현재: Proximus Smart 70 (€25 정상가, 프로모 없음 가정 — 6개월 프로모 종료 후)
    // 왜 promo null 인가?
    //   사용자가 "현재" 보는 가격은 *지금의 청구액* — promo 가 이미 끝난 상태.
    //   Smart 70 가입 후 6개월 지나 €25 청구되는 시점.
    const currentTariff = makeSnapshot({
      id: 'curr-smart-70',
      providerSlug: 'proximus-be',
      tariffSlug: 'proximus-mobile-smart-70',
      category: 'mobile',
      monthlyPriceCents: 2500, // €25
      attributes: { data_gb: 70, eu_roaming_included: true },
    });

    const candidates = [
      // Proximus Essential €15
      makeSnapshot({
        id: 'cand-essential',
        providerSlug: 'proximus-be',
        tariffSlug: 'proximus-mobile-essential',
        category: 'mobile',
        monthlyPriceCents: 1500,
        attributes: { data_gb: 5, eu_roaming_included: true },
      }),
      // Telenet GO 10 €20
      makeSnapshot({
        id: 'cand-go-10',
        providerSlug: 'telenet-be',
        tariffSlug: 'telenet-mobile-go-10',
        category: 'mobile',
        monthlyPriceCents: 2000,
        attributes: { data_gb: 10, eu_roaming_included: true },
      }),
    ];

    const profile: UsageProfile = {
      householdType: 'couple',
      data_gb_used: 4, // 5GB 한도 미만 — caveat 0
      voice_minutes_used: 100,
    };

    const result = compare({
      category: 'mobile',
      currentTariff,
      usageProfile: profile,
      candidates,
    });

    // 왜 ranked.length === 2 인가?
    //   2 candidate 모두 카테고리 일치 + confidence high + 자기 참조 X → 둘 다 비교.
    expect(result.ranked.length).toBe(2);
    expect(result.engineVersion).toBe(ENGINE_VERSION);

    // 1위 = Proximus Essential
    const top = result.ranked[0];
    expect(top).toBeDefined();
    if (!top) throw new Error('ranked[0] missing');
    expect(top.tariffSnapshotId).toBe('cand-essential');
    expect(top.rank).toBe(1);
    // currentMonthlyAvg12 = 2500 (정상가만 12개월) → saving = 2500 - 1500 = 1000 cents
    expect(top.monthlySavingCents).toBe(1000);
    expect(top.yearlySavingCents).toBe(12000); // 1000 × 12
    expect(top.confidence).toBe('high');

    // 2위 = Telenet GO 10
    const second = result.ranked[1];
    expect(second).toBeDefined();
    if (!second) throw new Error('ranked[1] missing');
    expect(second.tariffSnapshotId).toBe('cand-go-10');
    // saving = 2500 - 2000 = 500 cents
    expect(second.monthlySavingCents).toBe(500);

    // top* 메타 일관성
    expect(result.topMonthlySavingCents).toBe(1000);
    expect(result.topYearlySavingCents).toBe(12000);

    // meta — 모두 비교, 제외 0
    expect(result.meta.inputCount).toBe(2);
    expect(result.meta.comparedCount).toBe(2);
    expect(result.meta.excludedByCategory).toBe(0);
    expect(result.meta.excludedByConfidence).toBe(0);
    expect(result.meta.excludedBySelfReference).toBe(0);
  });
});

// ─── 케이스 2: 저사용 1인 — 절약 0 ─────────────────────────────────────────

describe('compare() — 케이스 2: 저사용 1인 (현재가 이미 가장 저렴)', () => {
  it('candidate Telenet GO 10 (€20) 은 €5 더 비쌈 → saving = -500 cents', () => {
    // 현재: Proximus Essential €15
    const currentTariff = makeSnapshot({
      id: 'curr-essential',
      providerSlug: 'proximus-be',
      tariffSlug: 'proximus-mobile-essential',
      category: 'mobile',
      monthlyPriceCents: 1500,
      attributes: { data_gb: 5, eu_roaming_included: true },
    });

    const candidates = [
      // Telenet GO 10 €20 (현재보다 비쌈)
      makeSnapshot({
        id: 'cand-go-10',
        providerSlug: 'telenet-be',
        tariffSlug: 'telenet-mobile-go-10',
        category: 'mobile',
        monthlyPriceCents: 2000,
        attributes: { data_gb: 10, eu_roaming_included: true },
      }),
    ];

    const profile: UsageProfile = {
      householdType: 'single',
      data_gb_used: 2,
    };

    const result = compare({
      category: 'mobile',
      currentTariff,
      usageProfile: profile,
      candidates,
    });

    expect(result.ranked.length).toBe(1);
    const top = result.ranked[0];
    if (!top) throw new Error('ranked[0] missing');
    // 1500 - 2000 = -500 cents (€5/월 더 비쌈)
    expect(top.monthlySavingCents).toBe(-500);
    expect(top.yearlySavingCents).toBe(-6000);
    // 음의 절약은 그대로 표시 — UI 에서 "더 비쌈" 라벨 전환은 페이즈 3.5 결정
  });
});

// ─── 케이스 3: 고사용 family — 한도 초과 caveat ─────────────────────────────

describe('compare() — 케이스 3: 고사용 family 모바일 한도 초과', () => {
  it('candidate Smart 70 (70GB) / Unlimited 모두 한도 caveat 없음 (caveat 4 는 candidate 한도 기준)', () => {
    // 현재: Telenet GO 10 (€20, 10GB) — 사용자 50GB (currentTariff 한도 초과 상태)
    const currentTariff = makeSnapshot({
      id: 'curr-go-10',
      providerSlug: 'telenet-be',
      tariffSlug: 'telenet-mobile-go-10',
      category: 'mobile',
      monthlyPriceCents: 2000,
      attributes: { data_gb: 10, eu_roaming_included: true },
    });

    const candidates = [
      // Proximus Smart 70 GB €25 (한도 충분)
      makeSnapshot({
        id: 'cand-smart-70',
        providerSlug: 'proximus-be',
        tariffSlug: 'proximus-mobile-smart-70',
        category: 'mobile',
        monthlyPriceCents: 2500,
        attributes: { data_gb: 70, eu_roaming_included: true },
      }),
      // Proximus Unlimited €35
      makeSnapshot({
        id: 'cand-unlimited',
        providerSlug: 'proximus-be',
        tariffSlug: 'proximus-mobile-unlimited',
        category: 'mobile',
        monthlyPriceCents: 3500,
        attributes: { data_gb: 'unlimited', eu_roaming_included: true },
      }),
    ];

    const profile: UsageProfile = {
      householdType: 'family_3_plus',
      data_gb_used: 50,
    };

    const result = compare({
      category: 'mobile',
      currentTariff,
      usageProfile: profile,
      candidates,
    });

    expect(result.ranked.length).toBe(2);
    const top = result.ranked[0];
    if (!top) throw new Error('ranked[0] missing');
    // 1위 = Smart 70 (절약액이 더 큼: 2000 - 2500 = -500 vs Unlimited 2000 - 3500 = -1500)
    expect(top.tariffSnapshotId).toBe('cand-smart-70');
    expect(top.monthlySavingCents).toBe(-500);

    // 왜 candidate Smart 70 의 caveats 에 한도 초과가 없는가?
    //   T6 규칙 4: candidate.attributes.data_gb (70) > usage (50) — 한도 안.
    //   currentTariff 의 한도 초과는 6 케이스에서 다루지 않음 (Amendment 가능).
    expect(hasCaveatLike(top.caveats, 'dataOverage')).toBe(false);

    // 2위 = Unlimited
    const second = result.ranked[1];
    if (!second) throw new Error('ranked[1] missing');
    expect(second.tariffSnapshotId).toBe('cand-unlimited');
    // attributes.data_gb='unlimited' — caveat 4 없음 (typeof !== 'number')
    expect(hasCaveatLike(second.caveats, 'dataOverage')).toBe(false);
  });

  it('candidate 가 한도 미만이면 caveat 4 발동 — 보조 검증', () => {
    // 케이스 3 의 역방향: candidate Telenet GO 10 (10GB) 가 후보일 때 50GB 사용 → caveat
    const candidates = [
      makeSnapshot({
        id: 'cand-go-10',
        providerSlug: 'telenet-be',
        tariffSlug: 'telenet-mobile-go-10',
        category: 'mobile',
        monthlyPriceCents: 2000,
        attributes: { data_gb: 10, eu_roaming_included: true },
      }),
    ];

    const result = compare({
      category: 'mobile',
      currentTariff: null,
      usageProfile: { data_gb_used: 50 },
      candidates,
    });

    expect(result.ranked.length).toBe(1);
    const top = result.ranked[0];
    if (!top) throw new Error('ranked[0] missing');
    // T6 규칙 4 발동
    expect(hasCaveatLike(top.caveats, 'dataOverage')).toBe(true);
    expect(caveatParam(top.caveats, 'dataOverage', 'usedGb')).toBe(50);
    expect(caveatParam(top.caveats, 'dataOverage', 'planGb')).toBe(10);
  });
});

// ─── 케이스 4: VDSL → 케이블 인터넷 (음의 절약 + 프로모 + 약정) ──────────

describe('compare() — 케이스 4: VDSL → 케이블 (€35 → €59 프로모 첫 3개월)', () => {
  it('Telenet ONE Internet (€59 정상, €49 프로모 3개월, 12개월 약정) — 음의 절약 + 약정/프로모 caveat', () => {
    // 현재: Proximus Essential Internet €35 (프로모 없음, 약정 0, modem €0)
    const currentTariff = makeSnapshot({
      id: 'curr-prox-internet',
      providerSlug: 'proximus-be',
      tariffSlug: 'proximus-internet-essential',
      category: 'internet_fixed',
      monthlyPriceCents: 3500,
      modemRentalCents: 0,
      attributes: {
        download_mbps: 150,
        upload_mbps: 15,
        unlimited_data: true,
        wifi_booster_included: false,
      },
    });

    const candidates = [
      // Telenet ONE Internet €59 정상, 프로모 €49 × 3개월, 12개월 약정
      makeSnapshot({
        id: 'cand-telenet-one',
        providerSlug: 'telenet-be',
        tariffSlug: 'telenet-one-internet',
        category: 'internet_fixed',
        monthlyPriceCents: 5900,
        modemRentalCents: 0,
        promoPriceCents: 4900,
        promoMonths: 3,
        commitmentMonths: 12,
        earlyTerminationFeeCents: 7500,
        attributes: {
          download_mbps: 400,
          upload_mbps: 40,
          unlimited_data: true,
          wifi_booster_included: true,
        },
      }),
    ];

    const profile: UsageProfile = {
      householdType: 'couple',
      download_mbps_needed: 400,
      streaming_4k: true,
    };

    const result = compare({
      category: 'internet_fixed',
      currentTariff,
      usageProfile: profile,
      candidates,
    });

    expect(result.ranked.length).toBe(1);
    const top = result.ranked[0];
    if (!top) throw new Error('ranked[0] missing');

    // candidate monthlyAvg12 = (4900×3 + 5900×9 + 0 + 0×12) / 12
    //                       = (14700 + 53100) / 12 = 67800 / 12 = 5650 cents
    // currentMonthlyAvg12 = 3500 cents (프로모 없음, 정상가만)
    // saving12 = 3500 - 5650 = -2150 cents (€21.50/월 더 비쌈)
    expect(top.breakdown.monthlyAvg12Cents).toBe(5650);
    expect(top.monthlySavingCents).toBe(-2150);
    expect(top.yearlySavingCents).toBe(-25800);

    // 24개월 시나리오: candidate monthlyAvg24 = (4900×3 + 5900×21 + 0 + 0×24) / 24
    //                                       = (14700 + 123900) / 24 = 138600 / 24 = 5775 cents
    // saving24 = 3500 - 5775 = -2275 cents (24개월 평균 시 더 비쌈 — 프로모 비중 ↓)
    expect(top.breakdown.monthlyAvg24Cents).toBe(5775);
    expect(top.breakdown.monthlySaving24Cents).toBe(-2275);

    // T6 규칙 1 (12개월 약정) + 3 (프로모 12개월 미만) caveat 발동
    expect(hasCaveatLike(top.caveats, 'commitment')).toBe(true);
    expect(caveatParam(top.caveats, 'promoEnds', 'months')).toBe(3);
    // 400 Mbps >= 100 → 4K caveat 없음 (조건 미달)
    expect(hasCaveatLike(top.caveats, 'speed4kInsufficient')).toBe(false);
  });
});

// ─── 케이스 5: 약정 vs 비약정 — 신규 가입자 ────────────────────────────────

describe('compare() — 케이스 5: 신규 가입자, 같은 €49 도 프로모 유무로 다름', () => {
  it('프로모 없는 €49 가 프로모 €49→€59 보다 12개월 평균 저렴 → 1위', () => {
    const candidates = [
      // Telenet Essential Internet €49 (프로모 없음, 12개월 약정)
      makeSnapshot({
        id: 'cand-essential',
        providerSlug: 'telenet-be',
        tariffSlug: 'telenet-internet-essential',
        category: 'internet_fixed',
        monthlyPriceCents: 4900,
        modemRentalCents: 0,
        commitmentMonths: 12,
        earlyTerminationFeeCents: 5000,
        attributes: { download_mbps: 150, upload_mbps: 15, unlimited_data: true },
      }),
      // Telenet ONE Internet €59 (프로모 €49 × 3개월, 12개월 약정)
      makeSnapshot({
        id: 'cand-one',
        providerSlug: 'telenet-be',
        tariffSlug: 'telenet-one-internet',
        category: 'internet_fixed',
        monthlyPriceCents: 5900,
        modemRentalCents: 0,
        promoPriceCents: 4900,
        promoMonths: 3,
        commitmentMonths: 12,
        attributes: { download_mbps: 400, upload_mbps: 40, unlimited_data: true },
      }),
    ];

    const profile: UsageProfile = {
      householdType: 'single',
      download_mbps_needed: 100,
    };

    const result = compare({
      category: 'internet_fixed',
      currentTariff: null, // 신규 가입자
      usageProfile: profile,
      candidates,
    });

    expect(result.ranked.length).toBe(2);

    // 1위 = Essential €49 (avg12 = 4900) — saving = -4900 (signed = -monthlyAvg12)
    const top = result.ranked[0];
    if (!top) throw new Error('ranked[0] missing');
    expect(top.tariffSnapshotId).toBe('cand-essential');
    expect(top.breakdown.monthlyAvg12Cents).toBe(4900);
    expect(top.monthlySavingCents).toBe(-4900);

    // 2위 = ONE Internet (avg12 = 5650, 케이스 4 동일 산식)
    const second = result.ranked[1];
    if (!second) throw new Error('ranked[1] missing');
    expect(second.tariffSnapshotId).toBe('cand-one');
    expect(second.breakdown.monthlyAvg12Cents).toBe(5650);
    expect(second.monthlySavingCents).toBe(-5650);

    // 두 candidate 모두 12개월 약정 caveat
    expect(hasCaveatLike(top.caveats, 'commitment')).toBe(true);
    expect(hasCaveatLike(second.caveats, 'commitment')).toBe(true);
    // ONE Internet 만 프로모 caveat (Essential 은 promo null → 발동 X)
    expect(hasCaveatLike(second.caveats, 'promoEnds')).toBe(true);
    expect(hasCaveatLike(top.caveats, 'promoEnds')).toBe(false);
  });
});

// ─── 케이스 6: 신규 가입자 (currentTariff null) 엣지 ───────────────────────

describe('compare() — 케이스 6: 신규 가입자 (currentTariff null)', () => {
  it('saving 은 -monthlyAvg12 (signed) — 저렴한 candidate 가 1위', () => {
    const candidates = [
      makeSnapshot({
        id: 'cand-essential',
        providerSlug: 'proximus-be',
        tariffSlug: 'proximus-mobile-essential',
        category: 'mobile',
        monthlyPriceCents: 1500,
        attributes: { data_gb: 5, eu_roaming_included: true },
      }),
      makeSnapshot({
        id: 'cand-go-10',
        providerSlug: 'telenet-be',
        tariffSlug: 'telenet-mobile-go-10',
        category: 'mobile',
        monthlyPriceCents: 2000,
        attributes: { data_gb: 10, eu_roaming_included: true },
      }),
    ];

    const result = compare({
      category: 'mobile',
      currentTariff: null,
      usageProfile: { householdType: 'single', data_gb_used: 5 },
      candidates,
    });

    expect(result.ranked.length).toBe(2);
    const top = result.ranked[0];
    if (!top) throw new Error('ranked[0] missing');
    expect(top.tariffSnapshotId).toBe('cand-essential'); // 저렴한 게 1위
    expect(top.monthlySavingCents).toBe(-1500); // signed = -1500 (= -monthlyAvg12)
    expect(top.yearlySavingCents).toBe(-18000);
    // currentTariff null → confidence 는 candidate 만으로 결정
    expect(top.confidence).toBe('high');
  });
});

// ─── 추가 단위 테스트 1: 빈 candidates ──────────────────────────────────────

describe('compare() — 빈 candidates', () => {
  it('빈 ranked + topMonthlySavingCents = null', () => {
    const result = compare({
      category: 'mobile',
      currentTariff: null,
      usageProfile: {},
      candidates: [],
    });
    expect(result.ranked.length).toBe(0);
    expect(result.topMonthlySavingCents).toBe(null);
    expect(result.topYearlySavingCents).toBe(null);
    expect(result.meta.inputCount).toBe(0);
    expect(result.meta.comparedCount).toBe(0);
  });
});

// ─── 추가 단위 테스트 2: 모두 confidence='low' → 자동 제외 ─────────────────

describe('compare() — 모두 confidence=low (ADR-0006 §T5 자동 제외)', () => {
  it('빈 ranked + excludedByConfidence 카운트 일치', () => {
    const candidates = [
      makeSnapshot({
        id: 'low-1',
        providerSlug: 'proximus-be',
        tariffSlug: 'p1',
        category: 'mobile',
        monthlyPriceCents: 1500,
        confidence: 'low',
      }),
      makeSnapshot({
        id: 'low-2',
        providerSlug: 'telenet-be',
        tariffSlug: 't1',
        category: 'mobile',
        monthlyPriceCents: 2000,
        confidence: 'low',
      }),
    ];

    const result = compare({
      category: 'mobile',
      currentTariff: null,
      usageProfile: {},
      candidates,
    });

    expect(result.ranked.length).toBe(0);
    expect(result.meta.excludedByConfidence).toBe(2);
    expect(result.meta.comparedCount).toBe(0);
  });

  it('isAnomaly=true 도 제외', () => {
    const candidates = [
      makeSnapshot({
        id: 'anom-1',
        providerSlug: 'proximus-be',
        tariffSlug: 'p1',
        category: 'mobile',
        monthlyPriceCents: 1500,
        confidence: 'high', // confidence 는 high 라도
        isAnomaly: true, // anomaly 면 제외
      }),
    ];

    const result = compare({
      category: 'mobile',
      currentTariff: null,
      usageProfile: {},
      candidates,
    });
    expect(result.ranked.length).toBe(0);
    expect(result.meta.excludedByConfidence).toBe(1);
  });
});

// ─── 추가 단위 테스트 3: 자기 참조 제외 ────────────────────────────────────

describe('compare() — 자기 참조 제외 (currentTariff 가 candidates 에 포함)', () => {
  it('동일 (providerSlug, tariffSlug) candidate 는 비교에서 제외', () => {
    const currentTariff = makeSnapshot({
      id: 'curr-1',
      providerSlug: 'proximus-be',
      tariffSlug: 'proximus-mobile-essential',
      category: 'mobile',
      monthlyPriceCents: 1500,
    });

    const candidates = [
      // 동일 (provider, tariff) — 자기 참조
      makeSnapshot({
        id: 'cand-self', // 다른 snapshot id 지만 같은 tariff
        providerSlug: 'proximus-be',
        tariffSlug: 'proximus-mobile-essential',
        category: 'mobile',
        monthlyPriceCents: 1500,
      }),
      // 다른 tariff
      makeSnapshot({
        id: 'cand-other',
        providerSlug: 'telenet-be',
        tariffSlug: 'telenet-mobile-go-10',
        category: 'mobile',
        monthlyPriceCents: 2000,
      }),
    ];

    const result = compare({
      category: 'mobile',
      currentTariff,
      usageProfile: {},
      candidates,
    });

    expect(result.ranked.length).toBe(1);
    expect(result.meta.excludedBySelfReference).toBe(1);
    const top = result.ranked[0];
    if (!top) throw new Error('ranked[0] missing');
    expect(top.tariffSnapshotId).toBe('cand-other');
  });
});

// ─── 추가 단위 테스트 4: 카테고리 미스매치 제외 (T1) ──────────────────────

describe('compare() — 카테고리 미스매치 제외 (T1)', () => {
  it('mobile 비교에 internet candidate 가 섞이면 자동 제외', () => {
    const candidates = [
      makeSnapshot({
        id: 'cand-mobile',
        providerSlug: 'proximus-be',
        tariffSlug: 'p-mobile',
        category: 'mobile',
        monthlyPriceCents: 1500,
      }),
      makeSnapshot({
        id: 'cand-internet',
        providerSlug: 'telenet-be',
        tariffSlug: 't-internet',
        category: 'internet_fixed',
        monthlyPriceCents: 4900,
      }),
    ];

    const result = compare({
      category: 'mobile',
      currentTariff: null,
      usageProfile: {},
      candidates,
    });

    expect(result.ranked.length).toBe(1);
    expect(result.meta.excludedByCategory).toBe(1);
    const top = result.ranked[0];
    if (!top) throw new Error('ranked[0] missing');
    expect(top.tariffSnapshotId).toBe('cand-mobile');
  });
});

// ─── avgMonthlyCents 단위 테스트 (산술 핵심 — Math.round 검증) ────────────

describe('avgMonthlyCents — 정수 cents 산술 검증', () => {
  it('프로모 6개월 €15 + 정상 6개월 €25, activation 0, modem null → 12개월 평균 = 2000 cents', () => {
    const c = makeSnapshot({
      id: 'x',
      providerSlug: 'p',
      tariffSlug: 's',
      monthlyPriceCents: 2500,
      promoPriceCents: 1500,
      promoMonths: 6,
    });
    // (1500×6 + 2500×6 + 0 + 0×12) / 12 = (9000 + 15000) / 12 = 24000 / 12 = 2000
    expect(avgMonthlyCents(c, 12)).toBe(2000);
  });

  it('activation €30 + modem €5/월, 24개월 amortize', () => {
    const c = makeSnapshot({
      id: 'x',
      providerSlug: 'p',
      tariffSlug: 's',
      monthlyPriceCents: 4000, // €40
      activationFeeCents: 3000, // €30
      modemRentalCents: 500, // €5/월
    });
    // (4000×24 + 3000 + 500×24) / 24 = (96000 + 3000 + 12000) / 24 = 111000 / 24 = 4625
    expect(avgMonthlyCents(c, 24)).toBe(4625);
  });

  it('프로모 36개월 (totalMonths 12 보다 김) → 프로모는 12개월만 적용', () => {
    const c = makeSnapshot({
      id: 'x',
      providerSlug: 'p',
      tariffSlug: 's',
      monthlyPriceCents: 5000,
      promoPriceCents: 3000,
      promoMonths: 36,
    });
    // 12개월 평균: 프로모 12 × 3000 + 정상 0 × 5000 = 36000 / 12 = 3000
    expect(avgMonthlyCents(c, 12)).toBe(3000);
  });

  it('프로모 0개월 + monthlyPrice 정상 → 프로모 영향 없음', () => {
    const c = makeSnapshot({
      id: 'x',
      providerSlug: 'p',
      tariffSlug: 's',
      monthlyPriceCents: 2500,
    });
    expect(avgMonthlyCents(c, 12)).toBe(2500);
    expect(avgMonthlyCents(c, 24)).toBe(2500);
  });
});
