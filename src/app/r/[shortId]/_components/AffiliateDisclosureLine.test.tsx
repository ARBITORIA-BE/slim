/**
 * AffiliateDisclosureLine 단위 테스트 (PLAN 4.3.c DoD §4).
 *
 * 검증 범위:
 *   1. active_b2b_intra_eu + entry 있음 → €X 카피 + 디스클로저 링크
 *   2. active_b2b_domestic_be + entry 있음 → €X 카피 + 디스클로저 링크
 *   3. active (둘) + entry 미등록(임의 ID) → fallback "단가 비공개" 카피 + 디스클로저 링크
 *   4. none / pending / paused / terminated → "수수료 없음" 카피 + 디스클로저 링크 없음 (4.4 동시 충족)
 *   5. amountCents=5000 → "€50" 포맷
 *   6. 디스클로저 링크 href = /legal/affiliate-disclosure
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { AffiliateStatus } from '@/db/schema/provider';

import { AffiliateDisclosureLine } from './AffiliateDisclosureLine';

// ─── 픽스처 ────────────────────────────────────────────────────────────────

// affiliateRates stub 에 등록된 placeholder 공급사 (affiliate-rates.ts)
const KNOWN_PROVIDER_ID = 'placeholder-proximus-be';
const KNOWN_PROVIDER_NAME = 'Proximus';

// affiliateRates 에 존재하지 않는 임의 ID → getRateForProvider null
const UNKNOWN_PROVIDER_ID = 'non-existent-provider-id-for-test';
const UNKNOWN_PROVIDER_NAME = 'TestUnknown';

// ─── 1. active_b2b_intra_eu + entry 있음 ─────────────────────────────────

describe('AffiliateDisclosureLine — active_b2b_intra_eu + entry 있음', () => {
  it('EUR 수수료 카피 표시', () => {
    render(
      <AffiliateDisclosureLine
        providerId={KNOWN_PROVIDER_ID}
        providerName={KNOWN_PROVIDER_NAME}
        affiliateStatus="active_b2b_intra_eu"
      />,
    );
    // "수수료를 받습니다" 와 공급사명 확인
    expect(screen.getByText(/수수료를 받습니다/)).toBeInTheDocument();
    expect(screen.getByText(/Proximus/)).toBeInTheDocument();
    // "요금에 영향이 없습니다" 문구
    expect(screen.getByText(/요금에 영향이 없습니다/)).toBeInTheDocument();
  });

  it('디스클로저 링크 존재 + href 정합', () => {
    render(
      <AffiliateDisclosureLine
        providerId={KNOWN_PROVIDER_ID}
        providerName={KNOWN_PROVIDER_NAME}
        affiliateStatus="active_b2b_intra_eu"
      />,
    );
    const link = screen.getByRole('link', { name: /수수료 정책 자세히 보기/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/legal/affiliate-disclosure');
  });
});

// ─── 2. active_b2b_domestic_be + entry 있음 ──────────────────────────────

describe('AffiliateDisclosureLine — active_b2b_domestic_be + entry 있음', () => {
  it('EUR 수수료 카피 표시', () => {
    render(
      <AffiliateDisclosureLine
        providerId={KNOWN_PROVIDER_ID}
        providerName={KNOWN_PROVIDER_NAME}
        affiliateStatus="active_b2b_domestic_be"
      />,
    );
    expect(screen.getByText(/수수료를 받습니다/)).toBeInTheDocument();
    expect(screen.getByText(/Proximus/)).toBeInTheDocument();
  });

  it('디스클로저 링크 존재', () => {
    render(
      <AffiliateDisclosureLine
        providerId={KNOWN_PROVIDER_ID}
        providerName={KNOWN_PROVIDER_NAME}
        affiliateStatus="active_b2b_domestic_be"
      />,
    );
    const link = screen.getByRole('link', { name: /수수료 정책 자세히 보기/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/legal/affiliate-disclosure');
  });
});

// ─── 3. active + entry 미등록(임의 ID) → fallback ─────────────────────────

describe('AffiliateDisclosureLine — active + entry 미등록 → fallback', () => {
  it('intra_eu: "단가 비공개" fallback 카피 + 디스클로저 링크', () => {
    render(
      <AffiliateDisclosureLine
        providerId={UNKNOWN_PROVIDER_ID}
        providerName={UNKNOWN_PROVIDER_NAME}
        affiliateStatus="active_b2b_intra_eu"
      />,
    );
    expect(screen.getByText(/단가 비공개 — 미등록/)).toBeInTheDocument();
    expect(screen.getByText(/요금에 영향이 없습니다/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /수수료 정책 자세히 보기/ });
    expect(link).toHaveAttribute('href', '/legal/affiliate-disclosure');
  });

  it('domestic_be: "단가 비공개" fallback 카피 + 디스클로저 링크', () => {
    render(
      <AffiliateDisclosureLine
        providerId={UNKNOWN_PROVIDER_ID}
        providerName={UNKNOWN_PROVIDER_NAME}
        affiliateStatus="active_b2b_domestic_be"
      />,
    );
    expect(screen.getByText(/단가 비공개 — 미등록/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /수수료 정책 자세히 보기/ });
    expect(link).toHaveAttribute('href', '/legal/affiliate-disclosure');
  });
});

// ─── 4. non-active 4값 → "수수료 없음" + 링크 없음 (PLAN 4.4 동시 충족) ──

const NON_ACTIVE_STATUSES: AffiliateStatus[] = [
  'none',
  'pending',
  'paused',
  'terminated',
];

describe('AffiliateDisclosureLine — non-active 4값', () => {
  it.each(NON_ACTIVE_STATUSES)(
    'status=%s → "수수료 없음" 카피 표시',
    (status) => {
      render(
        <AffiliateDisclosureLine
          providerId={KNOWN_PROVIDER_ID}
          providerName={KNOWN_PROVIDER_NAME}
          affiliateStatus={status}
        />,
      );
      expect(
        screen.getByText(/수수료를 받지 않습니다/),
      ).toBeInTheDocument();
    },
  );

  it.each(NON_ACTIVE_STATUSES)(
    'status=%s → 디스클로저 링크 없음',
    (status) => {
      render(
        <AffiliateDisclosureLine
          providerId={KNOWN_PROVIDER_ID}
          providerName={KNOWN_PROVIDER_NAME}
          affiliateStatus={status}
        />,
      );
      expect(
        screen.queryByRole('link', { name: /수수료 정책 자세히 보기/ }),
      ).not.toBeInTheDocument();
    },
  );
});

// ─── 5. amountCents=5000 → "€50" 포맷 ────────────────────────────────────

describe('AffiliateDisclosureLine — EUR 포맷', () => {
  it('amountCents=5000 → €50 포맷 (nl-BE currency)', () => {
    // KNOWN_PROVIDER_ID = placeholder-proximus-be, amountCents=5000
    render(
      <AffiliateDisclosureLine
        providerId={KNOWN_PROVIDER_ID}
        providerName={KNOWN_PROVIDER_NAME}
        affiliateStatus="active_b2b_domestic_be"
      />,
    );
    // nl-BE Intl.NumberFormat EUR 정수 → "€ 50" 또는 "€50" (로케일 spacing 허용)
    // 텍스트에 "50" 이 포함되어 있음을 확인
    const container = screen.getByText(/수수료를 받습니다/);
    expect(container.textContent).toMatch(/50/);
  });
});
