/**
 * compare() — 사용량 적합성 정렬 회귀 테스트 (PLAN 4.28, ADR-0055 §D2)
 *
 * 2026-08-22 프로덕션 실측을 그대로 재현한다:
 *   사용자 월 10GB · 현재 요금제 €17.99
 *   후보 A: 5GB  €16.99 (프로모 €14.99 6개월 → 12개월 평균 €15.99)
 *   후보 B: 15GB €21.00
 * 절약액만 보면 A 가 1위였고 헤드라인은 "€2 절약" 이라고 단정했다. 그런데 같은
 * 화면의 caveat 은 "한도 초과 비용은 표시되지 않습니다" 라고 자백하고 있었다 —
 * 총비용의 핵심 변수를 모르면서 결론만 단정한 상태.
 */

import { describe, it, expect } from 'vitest';

import { compare } from './compare';
import { makeSnapshot, hasCaveatLike } from './compare.test';
import type { UsageProfile } from './types';

const HEAVY_USER: UsageProfile = { data_gb_used: 10 };

const PLAN_5GB = makeSnapshot({
  id: 'cand-5gb',
  providerSlug: 'proximus-be',
  tariffSlug: 'proximus-mobile-essential',
  category: 'mobile',
  monthlyPriceCents: 1699,
  promoPriceCents: 1499,
  promoMonths: 6,
  attributes: { data_gb: 5 },
});

const PLAN_15GB = makeSnapshot({
  id: 'cand-15gb',
  providerSlug: 'telenet-be',
  tariffSlug: 'telenet-mobile-basic',
  category: 'mobile',
  monthlyPriceCents: 2100,
  attributes: { data_gb: 15 },
});

const CURRENT = makeSnapshot({
  id: 'current',
  providerSlug: 'other-be',
  tariffSlug: 'other-plan',
  category: 'mobile',
  monthlyPriceCents: 1799,
  attributes: { data_gb: 20 },
});

describe('compare() — 사용량 미달 후보는 1위가 되지 않는다', () => {
  it('10GB 사용자: 5GB(더 쌈) 가 아니라 15GB 가 1위', () => {
    const result = compare({
      category: 'mobile',
      currentTariff: CURRENT,
      usageProfile: HEAVY_USER,
      candidates: [PLAN_5GB, PLAN_15GB],
    });

    expect(result.ranked[0]?.tariffSnapshotId).toBe('cand-15gb');
    expect(result.ranked[1]?.tariffSnapshotId).toBe('cand-5gb');
  });

  it('미달 후보를 *제외하지는* 않는다 (P3 — 비교 대상을 지우지 않음)', () => {
    const result = compare({
      category: 'mobile',
      currentTariff: CURRENT,
      usageProfile: HEAVY_USER,
      candidates: [PLAN_5GB, PLAN_15GB],
    });

    expect(result.ranked).toHaveLength(2);
    expect(result.meta.comparedCount).toBe(2);
  });

  it('미달 후보에는 한도 초과 caveat 이 그대로 붙는다 (이유 설명)', () => {
    const result = compare({
      category: 'mobile',
      currentTariff: CURRENT,
      usageProfile: HEAVY_USER,
      candidates: [PLAN_5GB, PLAN_15GB],
    });

    const under = result.ranked.find((r) => r.tariffSnapshotId === 'cand-5gb');
    expect(hasCaveatLike(under?.caveats ?? [], 'dataOverage')).toBe(true);
    const fitting = result.ranked.find((r) => r.tariffSnapshotId === 'cand-15gb');
    expect(hasCaveatLike(fitting?.caveats ?? [], 'dataOverage')).toBe(false);
  });

  it('둘 다 감당하면 기존대로 절약액 순', () => {
    const light: UsageProfile = { data_gb_used: 3 };
    const result = compare({
      category: 'mobile',
      currentTariff: CURRENT,
      usageProfile: light,
      candidates: [PLAN_5GB, PLAN_15GB],
    });

    // 3GB 사용자에게는 둘 다 충분 → 더 싼 5GB 가 1위
    expect(result.ranked[0]?.tariffSnapshotId).toBe('cand-5gb');
  });

  it('둘 다 미달이면 그 안에서 절약액 순 (전부 미달이어도 순서는 결정적)', () => {
    const extreme: UsageProfile = { data_gb_used: 100 };
    const result = compare({
      category: 'mobile',
      currentTariff: CURRENT,
      usageProfile: extreme,
      candidates: [PLAN_5GB, PLAN_15GB],
    });

    expect(result.ranked[0]?.tariffSnapshotId).toBe('cand-5gb');
    expect(result.ranked).toHaveLength(2);
  });

  it('사용량 미상이면 불리하게 쓰지 않는다 (모르는 것 = 적합 취급)', () => {
    const unknown: UsageProfile = {};
    const result = compare({
      category: 'mobile',
      currentTariff: CURRENT,
      usageProfile: unknown,
      candidates: [PLAN_5GB, PLAN_15GB],
    });

    expect(result.ranked[0]?.tariffSnapshotId).toBe('cand-5gb');
  });

  it('unlimited 요금제는 항상 적합', () => {
    const unlimited = makeSnapshot({
      id: 'cand-unlimited',
      providerSlug: 'telenet-be',
      tariffSlug: 'telenet-mobile-unlimited',
      category: 'mobile',
      monthlyPriceCents: 4100,
      attributes: { data_gb: 'unlimited' },
    });

    const result = compare({
      category: 'mobile',
      currentTariff: CURRENT,
      usageProfile: HEAVY_USER,
      candidates: [PLAN_5GB, unlimited],
    });

    // 5GB 는 미달 → unlimited 가 훨씬 비싸도 1위
    expect(result.ranked[0]?.tariffSnapshotId).toBe('cand-unlimited');
  });

  it('internet 카테고리는 적합성 판정 대상이 아니다 (절약액 순 유지)', () => {
    const slow = makeSnapshot({
      id: 'cand-slow',
      providerSlug: 'p',
      tariffSlug: 'slow',
      category: 'internet_fixed',
      monthlyPriceCents: 3000,
      attributes: { download_mbps: 50 },
    });
    const fast = makeSnapshot({
      id: 'cand-fast',
      providerSlug: 'p',
      tariffSlug: 'fast',
      category: 'internet_fixed',
      monthlyPriceCents: 6000,
      attributes: { download_mbps: 500 },
    });

    const result = compare({
      category: 'internet_fixed',
      currentTariff: null,
      usageProfile: { streaming_4k: true },
      candidates: [slow, fast],
    });

    // 4K 부족은 caveat 으로만 알린다 — 순서를 바꾸지 않는다
    expect(result.ranked[0]?.tariffSnapshotId).toBe('cand-slow');
  });
});
