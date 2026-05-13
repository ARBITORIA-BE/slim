/**
 * AffiliateDisclosureLine — 결과 카드 하단 제휴 수수료 디스클로저 (PLAN 4.3.c).
 *
 * ADR-0026 §T4 + §검토 5 (UCPD + BE CDE VI.99):
 *   - active_b2b_intra_eu / active_b2b_domestic_be: 수수료 금액(EUR) 또는 fallback 표시 + 디스클로저 링크.
 *   - 그 외 4값(none/pending/paused/terminated): "수수료 없음" 표시 + 링크 없음.
 *
 * ADR-0027 §T3:
 *   - getRateForProvider 는 active 2종에만 entry 반환. 그 외 null.
 *   - rate === null + active → fallback (미등록 entry): 단가 비공개 표기.
 *
 * 헌법 §8 #4 광고-비교 분리:
 *   - 카드 본문 외부 슬롯: 얇은 구분선 + text-xs/text-fg-soft tone.
 *   - active / non-active 동일 위치·형태 → Visual Interference 회피.
 *
 * RSC (서버 컴포넌트) — getRateForProvider 는 순수 데이터 함수, 'use client' 불필요.
 */

import Link from 'next/link';

import type { AffiliateStatus } from '@/db/schema/provider';
import { getRateForProvider } from '@/data/affiliate-rates';

// ─── Props ─────────────────────────────────────────────────────────────────

export interface AffiliateDisclosureLineProps {
  /** provider.id — ADR-0027 §T3 getRateForProvider 인자 */
  readonly providerId: string;
  /** 카피 안의 회사명 */
  readonly providerName: string;
  /** affiliate_status enum 6값 — 분기 키 */
  readonly affiliateStatus: AffiliateStatus;
}

// ─── 통화 포맷 헬퍼 ────────────────────────────────────────────────────────

/**
 * cents → "€X" 형식 (nl-BE 로케일 EUR, 소수점 없음).
 *
 * Intl.NumberFormat 사용 — SSR 에서도 결정적 결과.
 * minimumFractionDigits=0 / maximumFractionDigits=0: cents 가 100의 배수여야 정수 표시.
 * 절사(floor) 없이 toFixed(0) 반올림 방지 — cents/100 을 정수 연산으로 처리.
 */
function formatEuroCents(amountCents: number): string {
  const euros = Math.floor(amountCents / 100);
  // cents 나머지가 있으면 소수 표시
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

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────

export function AffiliateDisclosureLine({
  providerId,
  providerName,
  affiliateStatus,
}: AffiliateDisclosureLineProps) {
  // active 2종 분기 — ADR-0027 §T3
  const isActive =
    affiliateStatus === 'active_b2b_intra_eu' ||
    affiliateStatus === 'active_b2b_domestic_be';

  if (!isActive) {
    // non-active 4값: 수수료 없음 (PLAN 4.4 동시 충족)
    // 디스클로저 링크 없음 — ADR-0026 §T4: 표시 대상 아님
    return (
      <div
        aria-label={`${providerName} 수수료 없음`}
        className="border-t border-fg/10 pt-2 mt-3 text-xs text-fg-soft"
      >
        수수료 없음 — Slim은 이 공급사로부터 수수료를 받지 않습니다. 외부 링크로 직접 이동합니다.
      </div>
    );
  }

  // active 분기 — getRateForProvider 호출 (ADR-0027 §T3)
  const rate = getRateForProvider(providerId, affiliateStatus);

  if (rate === null) {
    // entry 미등록 active 공급사 — fallback: 단가 비공개
    return (
      <div
        aria-label={`${providerName} 수수료 정보`}
        className="border-t border-fg/10 pt-2 mt-3 text-xs text-fg-soft"
      >
        Slim은 변경 시 {providerName}로부터 수수료를 받습니다 (단가 비공개 — 미등록). 이 수수료는 회원님의 요금에 영향이 없습니다.{' '}
        <Link
          href="/legal/affiliate-disclosure"
          className="underline-offset-4 hover:underline"
        >
          수수료 정책 자세히 보기
        </Link>
      </div>
    );
  }

  // entry 있음 — EUR 표시
  const formattedAmount = formatEuroCents(rate.amountCents);

  return (
    <div
      aria-label={`${providerName} 수수료 정보`}
      className="border-t border-fg/10 pt-2 mt-3 text-xs text-fg-soft"
    >
      Slim은 변경 시 {providerName}로부터 {formattedAmount}의 수수료를 받습니다 — 이 금액은 회원님의 요금에 영향이 없습니다.{' '}
      <Link
        href="/legal/affiliate-disclosure"
        className="underline-offset-4 hover:underline"
      >
        수수료 정책 자세히 보기
      </Link>
    </div>
  );
}
