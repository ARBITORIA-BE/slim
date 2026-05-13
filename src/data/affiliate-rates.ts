/**
 * Affiliate rate 정적 데이터 소스 (ADR-0027 §T1 — 옵션 C 채택).
 *
 * `commission_amount_cents` 와 동일 단위(cents) — 정합 단언은 4.3.e 정합 테스트 + bias-audit (ADR-0027 §T5).
 *
 * 사용처:
 *   - `/legal/affiliate-disclosure` 페이지 (4.3.d)
 *   - `AffiliateDisclosureLine` UI 컴포넌트 (4.3.c)
 *   - `bias-audit` 하네스 정합 검사 (4.3.e)
 *
 * 이 모듈은 `src/engine/**` 에서 import 하지 않는다 (헌법 §8 #4 광고-비교 분리).
 * 위반 시 compare.isolation.test.ts 의 정적 grep 테스트가 차단한다.
 *
 * 단가 변경 commit 형식: "chore(affiliate): 단가 갱신 — [공급사명] €X (계약 링크)"
 */

import type { AffiliateStatus } from '@/db/schema/provider';

// ─── 타입 ──────────────────────────────────────────────────────────────────

/**
 * 제휴 단가 entry.
 *
 * - `currency` / `commissionType` 은 literal 타입 — 베네룩스 B2B 텔레컴 CPA 표준 (ADR-0027 §T2).
 * - `source` + `fetchedAt` 은 P1 강제 — NOT empty (harness:data 검사 대상).
 * - `amountCents` 는 `affiliate_click.commission_amount_cents` 와 동일 단위 (cents).
 */
export interface AffiliateRate {
  /** provider.id — FK 처럼 동작, 런타임 정합 검사는 4.3.e */
  providerId: string;
  /** 통화 literal — 베네룩스 고정 EUR (ADR-0027 §T2) */
  currency: 'EUR';
  /** 단가 (cents) — commission_amount_cents 와 동일 단위 (ADR-0027 §T5) */
  amountCents: number;
  /** 정산 유형 literal — BE 텔레컴 CPA flat fee 표준 (ADR-0027 §T2) */
  commissionType: 'CPA';
  /** 계약 PDF 경로 + 페이지 — P1 강제, NOT empty */
  source: string;
  /** 운영자가 단가를 확인한 일자 (ISO 8601) — P1 강제, NOT empty */
  fetchedAt: string;
  /** 계약 유효 시작일 (ISO 8601) */
  effectiveFrom: string;
  /** 계약 유효 종료일 (ISO 8601). undefined = 무기한 */
  effectiveTo?: string;
}

// ─── 데이터 ────────────────────────────────────────────────────────────────

/**
 * 제휴 단가 배열.
 *
 * 4.x 초기 stub — 실 계약 체결 후 4.3.d 에서 교체.
 * 단가 변경 시 commit 형식: "chore(affiliate): 단가 갱신 — [공급사명] €X (계약 링크)"
 */
export const affiliateRates: AffiliateRate[] = [
  {
    // TODO(4.3.d): 실 UUID 로 교체 (DB seed Proximus row 의 provider.id)
    providerId: 'placeholder-proximus-be',
    currency: 'EUR',
    // €50 — BE 텔레컴 CPA 시장 통설 범위 €15~€120 중간값 (placeholder)
    amountCents: 5000,
    commissionType: 'CPA',
    // TODO(4.3.d): 실 계약 PDF 경로 + 페이지로 교체
    source: 'placeholder — TODO(4.3.d): 실 계약 PDF 경로 + 페이지',
    fetchedAt: '2026-05-13',
    effectiveFrom: '2026-05-13',
    // effectiveTo 미설정 = 무기한 (exactOptionalPropertyTypes: 필드 생략으로 undefined 표현)
  },
  {
    // TODO(4.3.d): 실 UUID 로 교체 (DB seed Telenet row 의 provider.id)
    providerId: 'placeholder-telenet-be',
    currency: 'EUR',
    // €45 — BE 텔레컴 CPA 시장 통설 범위 placeholder
    amountCents: 4500,
    commissionType: 'CPA',
    // TODO(4.3.d): 실 계약 PDF 경로 + 페이지로 교체
    source: 'placeholder — TODO(4.3.d): 실 계약 PDF 경로 + 페이지',
    fetchedAt: '2026-05-13',
    effectiveFrom: '2026-05-13',
    // effectiveTo 미설정 = 무기한 (exactOptionalPropertyTypes: 필드 생략으로 undefined 표현)
  },
];

// ─── 헬퍼 ──────────────────────────────────────────────────────────────────

/**
 * 공급사별 활성 제휴 단가 조회.
 *
 * 반환 조건 (ADR-0026 §T4 + ADR-0027 §T3):
 *   - `status` 가 `'active_b2b_intra_eu'` 또는 `'active_b2b_domestic_be'` 인 경우만 검색.
 *   - 그 외 4값(`none` / `pending` / `paused` / `terminated`) → null.
 *   - 유효기간: `effectiveFrom <= today` 이고 `effectiveTo` 있으면 `today < effectiveTo`.
 *   - 동일 providerId 에 복수 entry 가 있으면 가장 최근 `effectiveFrom` 우선.
 *
 * @param providerId - provider.id (provider.ts)
 * @param status     - provider.affiliate_status enum 6값 (provider.ts:124)
 * @param today      - 오늘 날짜 (ISO 8601 date, 기본값 = 실행 시 오늘). 테스트 주입용.
 * @returns 활성 단가 entry 또는 null
 */
export function getRateForProvider(
  providerId: string,
  status: AffiliateStatus,
  today: string = new Date().toISOString().slice(0, 10),
): AffiliateRate | null {
  // 표시 대상 분기 — active 상태 2종만 통과
  if (status !== 'active_b2b_intra_eu' && status !== 'active_b2b_domestic_be') {
    return null;
  }

  // providerId 매치 + 유효기간 필터
  // ISO 8601 date 문자열은 사전순 == 시간순 → 안전한 문자열 비교
  const candidates = affiliateRates.filter((rate) => {
    if (rate.providerId !== providerId) return false;
    // effectiveFrom <= today
    if (rate.effectiveFrom > today) return false;
    // effectiveTo 가 있으면 today < effectiveTo (만료 당일은 만료)
    if (rate.effectiveTo !== undefined && today >= rate.effectiveTo) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  // 복수 entry 가 있으면 가장 최근 effectiveFrom 우선 (내림차순 정렬 후 첫 번째)
  // placeholder 단계에서는 1건/공급사이나 로직은 완전 구현
  const sorted = [...candidates].sort((a, b) =>
    b.effectiveFrom.localeCompare(a.effectiveFrom),
  );

  // noUncheckedIndexedAccess: sorted[0] 은 candidates.length > 0 검사 이후이므로 안전
  // @ts-expect-error — noUncheckedIndexedAccess: 위 candidates.length > 0 guard 로 안전
  return sorted[0];
}
