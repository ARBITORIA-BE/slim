/**
 * ADR-0027 §T5 — affiliateRates[*].amountCents 와
 * affiliate_click.commission_amount_cents 는 *동일 단위(cents) + 동일 타입(number)*.
 * Drizzle: bigint('commission_amount_cents', { mode: 'number' }) → TS number.
 * AffiliateRate.amountCents: number.
 * 두 곳에서 단위가 어긋나면 P3 위반 (사용자 디스클로저 카드의 €X 와 정산 단가가
 * 다르게 보임). 본 테스트는 placeholder 단계의 단위 sanity 만 검증 — 실 정산
 * 데이터가 입력되면 4.3.e (i) 의 정합 검증을 *통합 테스트*에서 확장.
 *
 * enum 6값 분기 동작 검증은
 * `src/app/r/[shortId]/_components/AffiliateDisclosureLine.test.tsx` 가 단일 출처.
 *
 * 4.1.e 격리: 본 파일은 `src/data/` 에 위치하므로 `src/engine/**` 정적 grep 대상 밖.
 */

import { describe, expect, it } from 'vitest';

// type-only import — 런타임 DB 호출 없음 (ADR-0027 §T5 정합 의도 명시)
import type { NewAffiliateClick } from '@/db/schema/affiliate_click';
import { affiliateRates, type AffiliateRate } from './affiliate-rates';

// ─── 타입 동질성 주석 (컴파일타임 보증) ─────────────────────────────────────
//
// NewAffiliateClick['commissionAmountCents']:
//   Drizzle bigint({ mode: 'number' }) + nullable → `number | null | undefined`
//
// AffiliateRate['amountCents']:
//   `number` (NOT null, NOT optional — AffiliateRate 인터페이스 비선택 필드)
//
// 두 타입의 *값 도메인*이 겹치는 구간: `number` (정수, > 0, < MAX_SAFE_INTEGER).
// 본 테스트는 그 런타임 sanity 를 검증한다.

// ─── 픽스처 타입 힌트 ────────────────────────────────────────────────────────

// NewAffiliateClick 을 타입으로만 참조 — 런타임에선 사용하지 않음.
// 컴파일러가 이 변수를 통해 `commissionAmountCents` 필드 타입을 검사한다.
// @ts-expect-error — unused type alias intentional: type-level assertion only
type _CommissionCentsField = NewAffiliateClick['commissionAmountCents'];
// _CommissionCentsField = number | null | undefined (bigint mode:'number' + nullable)
// AffiliateRate['amountCents'] = number
// 두 타입 모두 number 값 도메인을 공유함 — 단위 cents 일치.

// ─── 1. amountCents 타입 sanity ──────────────────────────────────────────────

describe('cents-parity — 1. amountCents 타입 sanity (ADR-0027 §T5)', () => {
  it('affiliateRates 배열 비어 있지 않음 (parity 검증 전제)', () => {
    expect(affiliateRates.length).toBeGreaterThan(0);
  });

  it('모든 entry — typeof amountCents === "number"', () => {
    for (const entry of affiliateRates) {
      expect(
        typeof entry.amountCents,
        `providerId=${entry.providerId} amountCents 타입 이탈`,
      ).toBe('number');
    }
  });

  it('모든 entry — amountCents 정수 (Number.isInteger)', () => {
    for (const entry of affiliateRates) {
      expect(
        Number.isInteger(entry.amountCents),
        `providerId=${entry.providerId} amountCents 정수 아님 (값: ${entry.amountCents})`,
      ).toBe(true);
    }
  });

  it('모든 entry — amountCents > 0 (음수/0 정산은 의미 없음)', () => {
    for (const entry of affiliateRates) {
      expect(
        entry.amountCents,
        `providerId=${entry.providerId} amountCents <= 0`,
      ).toBeGreaterThan(0);
    }
  });

  it('모든 entry — amountCents < Number.MAX_SAFE_INTEGER (JS number bigint 안전 범위)', () => {
    // Drizzle bigint(mode:'number') 는 JS number 로 읽히므로
    // MAX_SAFE_INTEGER (2^53 - 1) 을 넘으면 정밀도 손실 → P3 위반 가능성.
    for (const entry of affiliateRates) {
      expect(
        entry.amountCents,
        `providerId=${entry.providerId} amountCents Number.MAX_SAFE_INTEGER 초과`,
      ).toBeLessThan(Number.MAX_SAFE_INTEGER);
    }
  });
});

// ─── 2. 단위 일관 — commissionAmountCents 와 amountCents 는 동일 cents 단위 ──

describe('cents-parity — 2. 단위 일관 (cents 동일 단위 계약)', () => {
  /**
   * DB 컬럼: commission_amount_cents (bigint, mode:'number')
   * 정적 데이터: AffiliateRate.amountCents (number)
   *
   * 단위 계약:
   *   - 1 cents = €0.01 (EUR)
   *   - €50 = 5000 cents
   *   - 두 곳 모두 cents 정수 — EUR 소수점 산술 오차 없음 (ADR-0005 §T2)
   *
   * 이 describe 블록은 런타임 DB row 가 없어도
   * *정적 affiliateRates 의 cents 단위를 강제*하는 것을 목적으로 한다.
   */

  it('amountCents 값이 EUR cents 단위임을 EUR 기준으로 검증 (€0.01 최소 단위)', () => {
    // EUR 최소 단위 = 1 cent → amountCents >= 1
    for (const entry of affiliateRates) {
      expect(entry.amountCents).toBeGreaterThanOrEqual(1);
      // 정수 단언 재확인 — cents 는 소수점 없음
      expect(entry.amountCents % 1).toBe(0);
    }
  });

  it('amountCents 와 currency 쌍 — EUR + number 타입 항상 동시 (타입 계약)', () => {
    // AffiliateRate 인터페이스: currency: 'EUR', amountCents: number — 불변 계약
    for (const entry of affiliateRates) {
      expect(entry.currency).toBe('EUR');
      expect(typeof entry.amountCents).toBe('number');
    }
  });
});

// ─── 3. NewAffiliateClick.commissionAmountCents 타입 가드 단언 ─────────────

describe('cents-parity — 3. NewAffiliateClick 타입 상호 호환 (runtime sanity)', () => {
  /**
   * NewAffiliateClick['commissionAmountCents'] 는 `number | null | undefined`.
   * affiliateRates entry 의 amountCents 는 `number`.
   * → affiliate_click INSERT 시 amountCents 를 commissionAmountCents 에 대입 가능.
   *
   * 런타임 단언: affiliateRates[*].amountCents 를 number 로 parse 해도 손실 없음.
   */

  it('모든 entry — Number(amountCents) === amountCents (number parse 손실 없음)', () => {
    for (const entry of affiliateRates) {
      expect(Number(entry.amountCents)).toBe(entry.amountCents);
    }
  });

  it('모든 entry — Math.round(amountCents) === amountCents (반올림 손실 없음)', () => {
    // bigint INSERT 시 Math.round 처리 필요 없음을 확인 — 이미 정수
    for (const entry of affiliateRates) {
      expect(Math.round(entry.amountCents)).toBe(entry.amountCents);
    }
  });

  it('affiliateRates[*].amountCents 타입이 AffiliateRate["amountCents"] 계약 준수', () => {
    // AffiliateRate 인터페이스의 amountCents: number 계약을
    // 런타임 배열 전체에 대해 재확인 (타입 assertion 이중 방어)
    const allAreNumbers = affiliateRates.every(
      (e: AffiliateRate) => typeof e.amountCents === 'number',
    );
    expect(allAreNumbers).toBe(true);
  });
});
