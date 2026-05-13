/**
 * EUR 통화 포맷 공유 헬퍼 (PLAN 4.3.d 추출).
 *
 * 왜 분리했나:
 *   AffiliateDisclosureLine (4.3.c) 와 /legal/affiliate-disclosure 페이지 (4.3.d)
 *   둘 다 동일 로직이 필요해 DRY 준수를 위해 공통 모듈로 추출.
 *
 * TODO(4.3.e): bias-audit 정합 테스트에서도 EUR 포맷 필요 시 이 헬퍼 재사용.
 */

/**
 * cents → "€X" 형식 (nl-BE 로케일 EUR).
 *
 * - 100의 배수 (정수 €): 소수점 없이 표시 (e.g. 5000 → "€ 50").
 * - 100의 배수가 아닌 경우: 소수 2자리 표시 (e.g. 5050 → "€ 50,50").
 * - nl-BE 로케일: "€ 50" (NARROW NO-BREAK SPACE 포함) — SSR 결정적 결과 보장.
 *
 * @param amountCents - 금액 (cents 단위, commission_amount_cents 와 동일)
 */
export function formatEuroCents(amountCents: number): string {
  const euros = Math.floor(amountCents / 100);
  const remainder = amountCents % 100;
  if (remainder === 0) {
    return new Intl.NumberFormat('nl-BE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(euros);
  }
  return new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}
