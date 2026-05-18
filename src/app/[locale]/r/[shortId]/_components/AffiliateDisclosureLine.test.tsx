/**
 * AffiliateDisclosureLine 단위 테스트 (PLAN 4.3.c DoD §4).
 *
 * 컴포넌트가 async RSC (4.5.j.4.A i18n 마이그레이션 후)이므로
 * 테스트는 await 로 JSX를 resolve 한 뒤 render 한다.
 *
 * next-intl/server mock: getTranslations 를 ko.json 메시지로 직접 주입.
 * why: next-intl server functions 은 Next.js request context 없이는
 *      JSDOM 환경에서 동작하지 않는다. vi.mock 으로 ko 메시지를 직접 주입.
 *
 * 검증 범위:
 *   1. active_b2b_intra_eu + entry 있음 → €X 카피 + 디스클로저 링크
 *   2. active_b2b_domestic_be + entry 있음 → €X 카피 + 디스클로저 링크
 *   3. active (둘) + entry 미등록(임의 ID) → fallback "단가 비공개" 카피 + 디스클로저 링크
 *   4. none / pending / paused / terminated → "수수료 없음" 카피 + 디스클로저 링크 없음
 *   5. amountCents=5000 → "€50" 포맷
 *   6. 디스클로저 링크 href = /legal/affiliate-disclosure
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { AffiliateStatus } from '@/db/schema/provider';

// next-intl/server mock — ko.json 메시지 직접 주입
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    const koMessages: Record<string, Record<string, string>> = {
      'result.affiliateDisclosure': {
        noCommission: '수수료 없음',
        noCommissionDetail: 'Slim은 이 공급사로부터 수수료를 받지 않습니다. 외부 링크로 직접 이동합니다.',
        commissionUnknown: 'Slim은 변경 시 {providerName}로부터 수수료를 받습니다 (단가 비공개 — 미등록). 이 수수료는 회원님의 요금에 영향이 없습니다.',
        commissionKnown: 'Slim은 변경 시 {providerName}로부터 {amount}의 수수료를 받습니다 — 이 금액은 회원님의 요금에 영향이 없습니다.',
        policyLink: '수수료 정책 자세히 보기',
        disclosureAriaLabel: '{providerName} 수수료 정보',
      },
    };
    const messages = koMessages[namespace] ?? {};
    // ICU 변수 보간 지원 (간단한 {var} 치환)
    return (key: string, vars?: Record<string, string>) => {
      let text = messages[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
        }
      }
      return text;
    };
  },
  setRequestLocale: vi.fn(),
}));

import { AffiliateDisclosureLine } from './AffiliateDisclosureLine';

// ─── 픽스처 ────────────────────────────────────────────────────────────────

const KNOWN_PROVIDER_ID = 'placeholder-proximus-be';
const KNOWN_PROVIDER_NAME = 'Proximus';
const UNKNOWN_PROVIDER_ID = 'non-existent-provider-id-for-test';
const UNKNOWN_PROVIDER_NAME = 'TestUnknown';

// ─── 1. active_b2b_intra_eu + entry 있음 ─────────────────────────────────

describe('AffiliateDisclosureLine — active_b2b_intra_eu + entry 있음', () => {
  it('EUR 수수료 카피 표시', async () => {
    const jsx = await AffiliateDisclosureLine({
      providerId: KNOWN_PROVIDER_ID,
      providerName: KNOWN_PROVIDER_NAME,
      affiliateStatus: 'active_b2b_intra_eu',
    });
    render(jsx);
    expect(screen.getByText(/수수료를 받습니다/)).toBeInTheDocument();
    expect(screen.getByText(/Proximus/)).toBeInTheDocument();
    expect(screen.getByText(/요금에 영향이 없습니다/)).toBeInTheDocument();
  });

  it('디스클로저 링크 존재 + href 정합', async () => {
    const jsx = await AffiliateDisclosureLine({
      providerId: KNOWN_PROVIDER_ID,
      providerName: KNOWN_PROVIDER_NAME,
      affiliateStatus: 'active_b2b_intra_eu',
    });
    render(jsx);
    const link = screen.getByRole('link', { name: /수수료 정책 자세히 보기/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/legal/affiliate-disclosure');
  });
});

// ─── 2. active_b2b_domestic_be + entry 있음 ──────────────────────────────

describe('AffiliateDisclosureLine — active_b2b_domestic_be + entry 있음', () => {
  it('EUR 수수료 카피 표시', async () => {
    const jsx = await AffiliateDisclosureLine({
      providerId: KNOWN_PROVIDER_ID,
      providerName: KNOWN_PROVIDER_NAME,
      affiliateStatus: 'active_b2b_domestic_be',
    });
    render(jsx);
    expect(screen.getByText(/수수료를 받습니다/)).toBeInTheDocument();
    expect(screen.getByText(/Proximus/)).toBeInTheDocument();
  });

  it('디스클로저 링크 존재', async () => {
    const jsx = await AffiliateDisclosureLine({
      providerId: KNOWN_PROVIDER_ID,
      providerName: KNOWN_PROVIDER_NAME,
      affiliateStatus: 'active_b2b_domestic_be',
    });
    render(jsx);
    const link = screen.getByRole('link', { name: /수수료 정책 자세히 보기/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/legal/affiliate-disclosure');
  });
});

// ─── 3. active + entry 미등록(임의 ID) → fallback ─────────────────────────

describe('AffiliateDisclosureLine — active + entry 미등록 → fallback', () => {
  it('intra_eu: "단가 비공개" fallback 카피 + 디스클로저 링크', async () => {
    const jsx = await AffiliateDisclosureLine({
      providerId: UNKNOWN_PROVIDER_ID,
      providerName: UNKNOWN_PROVIDER_NAME,
      affiliateStatus: 'active_b2b_intra_eu',
    });
    render(jsx);
    expect(screen.getByText(/단가 비공개 — 미등록/)).toBeInTheDocument();
    expect(screen.getByText(/요금에 영향이 없습니다/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /수수료 정책 자세히 보기/ });
    expect(link).toHaveAttribute('href', '/legal/affiliate-disclosure');
  });

  it('domestic_be: "단가 비공개" fallback 카피 + 디스클로저 링크', async () => {
    const jsx = await AffiliateDisclosureLine({
      providerId: UNKNOWN_PROVIDER_ID,
      providerName: UNKNOWN_PROVIDER_NAME,
      affiliateStatus: 'active_b2b_domestic_be',
    });
    render(jsx);
    expect(screen.getByText(/단가 비공개 — 미등록/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /수수료 정책 자세히 보기/ });
    expect(link).toHaveAttribute('href', '/legal/affiliate-disclosure');
  });
});

// ─── 4. non-active 4값 → "수수료 없음" + 링크 없음 ──────────────────────

const NON_ACTIVE_STATUSES: AffiliateStatus[] = [
  'none',
  'pending',
  'paused',
  'terminated',
];

describe('AffiliateDisclosureLine — non-active 4값', () => {
  it.each(NON_ACTIVE_STATUSES)(
    'status=%s → "수수료를 받지 않습니다" 카피 표시',
    async (status) => {
      const jsx = await AffiliateDisclosureLine({
        providerId: KNOWN_PROVIDER_ID,
        providerName: KNOWN_PROVIDER_NAME,
        affiliateStatus: status,
      });
      render(jsx);
      expect(
        screen.getByText(/수수료를 받지 않습니다/),
      ).toBeInTheDocument();
    },
  );

  it.each(NON_ACTIVE_STATUSES)(
    'status=%s → 디스클로저 링크 없음',
    async (status) => {
      const jsx = await AffiliateDisclosureLine({
        providerId: KNOWN_PROVIDER_ID,
        providerName: KNOWN_PROVIDER_NAME,
        affiliateStatus: status,
      });
      render(jsx);
      expect(
        screen.queryByRole('link', { name: /수수료 정책 자세히 보기/ }),
      ).not.toBeInTheDocument();
    },
  );
});

// ─── 5. amountCents=5000 → "€50" 포맷 ────────────────────────────────────

describe('AffiliateDisclosureLine — EUR 포맷', () => {
  it('amountCents=5000 → €50 포맷 (nl-BE currency)', async () => {
    const jsx = await AffiliateDisclosureLine({
      providerId: KNOWN_PROVIDER_ID,
      providerName: KNOWN_PROVIDER_NAME,
      affiliateStatus: 'active_b2b_domestic_be',
    });
    render(jsx);
    const container = screen.getByText(/수수료를 받습니다/);
    expect(container.textContent).toMatch(/50/);
  });
});
