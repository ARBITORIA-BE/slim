/**
 * /legal/affiliate-disclosure 페이지 단위 테스트 (PLAN 4.3.d DoD §4).
 *
 * 검증 범위:
 *   1. placeholder-only 상태 → 알림 배너 표시 + 표 렌더 (entry 2건)
 *   2. 실 entry 추가 가정 (affiliateRates mock) → 알림 배너 없음 + 표 렌더
 *   3. 빈 배열 → "활성 계약 없음" 메시지
 *   4. EUR 포맷 — amountCents=5000 → "50" 포함
 *   5. 필수 컬럼 헤더 8개 존재
 *   6. UCPD / VI.99 키 문구 존재
 *   7. 다크패턴 자가 검사 — "지금만 / 오늘만 / 마감 / Hurry" 류 0건
 *
 * mock 전략:
 *   vi.mock 팩토리가 mutable 배열 레퍼런스(`mockRates`)를 반환.
 *   각 테스트 전 `.splice(0)` 로 초기화 후 원하는 픽스처를 push.
 *   no-import-assign 규칙 회피: import 된 바인딩을 재할당하지 않음.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { AffiliateRate } from '@/data/affiliate-rates';

// ─── @/i18n/navigation mock ────────────────────────────────────────────────
// next-intl 의 Link 는 NextIntlClientProvider 컨텍스트를 요구함.
// 테스트 환경에는 provider 가 없으므로 next/link 의 Link 로 대체.
vi.mock('@/i18n/navigation', () => ({
  Link: require('next/link').default,
}));

// ─── next-intl/server mock ──────────────────────────────────────────────────
// getTranslations: 키를 그대로 반환 (i18n 실값 로딩 없이 구조만 검증)
// setRequestLocale: PLAN 3.5.4 — generateMetadata/컴포넌트 params 패턴으로 변환.
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockImplementation(
    async ({ namespace }: { namespace: string }) => {
      return (key: string) => `${namespace}.${key}`;
    },
  ),
  setRequestLocale: vi.fn(),
}));

// ─── mock 전략 ─────────────────────────────────────────────────────────────

// vi.mock 은 파일 최상단으로 hoisting 됨.
// vi.hoisted 로 선언한 변수만 vi.mock 팩토리 안에서 안전하게 참조 가능.
const { mockRates } = vi.hoisted(() => ({
  mockRates: [] as AffiliateRate[],
}));

vi.mock('@/data/affiliate-rates', () => ({
  // 동일 배열 레퍼런스 — 테스트에서 splice/push 로 내용 교체
  affiliateRates: mockRates,
  getRateForProvider: vi.fn(),
}));

// page.tsx 가 vi.mock 이후에 import 되어야 mock 된 모듈을 사용
import AffiliatePage from './page';

// ─── 헬퍼 (RSC async 컴포넌트 렌더) ────────────────────────────────────────
// PLAN 3.5.4 — AffiliatePage 가 async 컴포넌트(params 수신)가 됨.
async function renderAffiliatePage(locale = 'nl-BE') {
  const element = await AffiliatePage({
    params: Promise.resolve({ locale }),
  });
  return render(element);
}

// ─── 픽스처 ────────────────────────────────────────────────────────────────

const PLACEHOLDER_RATES: AffiliateRate[] = [
  {
    providerId: 'placeholder-proximus-be',
    currency: 'EUR',
    amountCents: 5000,
    commissionType: 'CPA',
    source: 'placeholder — TODO(4.3.d): 실 계약 PDF 경로 + 페이지',
    fetchedAt: '2026-05-13',
    effectiveFrom: '2026-05-13',
  },
  {
    providerId: 'placeholder-telenet-be',
    currency: 'EUR',
    amountCents: 4500,
    commissionType: 'CPA',
    source: 'placeholder — TODO(4.3.d): 실 계약 PDF 경로 + 페이지',
    fetchedAt: '2026-05-13',
    effectiveFrom: '2026-05-13',
  },
];

const REAL_RATES: AffiliateRate[] = [
  {
    providerId: 'real-proximus-be',
    currency: 'EUR',
    amountCents: 6000,
    commissionType: 'CPA',
    source: 'contracts/proximus-2026.pdf p.3',
    fetchedAt: '2026-05-13',
    effectiveFrom: '2026-05-13',
  },
];

// ─── 헬퍼 ──────────────────────────────────────────────────────────────────

/**
 * mockRates 배열을 원하는 픽스처로 교체.
 * splice(0) 로 기존 항목 모두 제거 후 push 로 채움.
 * no-import-assign: import 된 바인딩 재할당 없이 배열 내용만 변경.
 */
function setRates(rates: AffiliateRate[]): void {
  mockRates.splice(0);
  rates.forEach((r) => mockRates.push(r));
}

beforeEach(() => {
  setRates([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── 1. placeholder-only 상태 ──────────────────────────────────────────────

describe('AffiliatePage — placeholder-only 상태', () => {
  beforeEach(() => {
    setRates(PLACEHOLDER_RATES);
  });

  it('알림 배너 표시 (i18n 키 형식)', async () => {
    await renderAffiliatePage();
    expect(screen.getByRole('note')).toBeInTheDocument();
    // getTranslations mock 은 "legal.affiliateDisclosure.placeholderBannerBody" 를 반환
    expect(screen.getByRole('note').textContent).toMatch(/placeholderBannerBody/);
  });

  it('표 렌더 — 2건 entry 행 존재', async () => {
    await renderAffiliatePage();
    // 표 자체 존재
    expect(screen.getByRole('table')).toBeInTheDocument();
    // header row 1 + data row 2 = 3
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(3);
  });
});

// ─── 2. 실 entry (source 가 placeholder 아님) → 배너 없음 ─────────────────

describe('AffiliatePage — 실 entry 상태', () => {
  beforeEach(() => {
    setRates(REAL_RATES);
  });

  it('알림 배너 없음', async () => {
    await renderAffiliatePage();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('표 렌더 — 1건 entry 행 존재', async () => {
    await renderAffiliatePage();
    const rows = screen.getAllByRole('row');
    // header 1 + data 1 = 2
    expect(rows.length).toBe(2);
  });
});

// ─── 3. 빈 배열 → "활성 계약 없음" 메시지 ────────────────────────────────

describe('AffiliatePage — 빈 배열', () => {
  beforeEach(() => {
    setRates([]);
  });

  it('noRatesMessage 표시 (i18n 키 형식)', async () => {
    await renderAffiliatePage();
    // getTranslations mock 은 "legal.affiliateDisclosure.noRatesMessage" 를 반환
    expect(
      screen.getByText(/legal\.affiliateDisclosure\.noRatesMessage/),
    ).toBeInTheDocument();
  });

  it('표 없음', async () => {
    await renderAffiliatePage();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

// ─── 4. EUR 포맷 ──────────────────────────────────────────────────────────

describe('AffiliatePage — EUR 포맷', () => {
  it('amountCents=5000 → "50" 포함 (nl-BE EUR)', async () => {
    setRates(PLACEHOLDER_RATES); // placeholder-proximus-be amountCents=5000
    await renderAffiliatePage();
    // 단가 셀에 "50" 이 포함됨 (nl-BE: "€ 50" 또는 "€50")
    const cells = screen.getAllByRole('cell');
    const amountCell = cells.find((c) => /€/.test(c.textContent ?? ''));
    expect(amountCell).toBeDefined();
    expect(amountCell?.textContent).toMatch(/50/);
  });
});

// ─── 5. 필수 컬럼 헤더 8개 ──────────────────────────────────────────────

describe('AffiliatePage — 컬럼 헤더', () => {
  beforeEach(() => {
    setRates(PLACEHOLDER_RATES);
  });

  // getTranslations mock 은 "legal.affiliateDisclosure.tableCol*" 형식을 반환
  const EXPECTED_HEADERS = [
    'legal.affiliateDisclosure.tableColProvider',
    'legal.affiliateDisclosure.tableColType',
    'legal.affiliateDisclosure.tableColRate',
    'legal.affiliateDisclosure.tableColCurrency',
    'legal.affiliateDisclosure.tableColSource',
    'legal.affiliateDisclosure.tableColCheckedAt',
    'legal.affiliateDisclosure.tableColEffectiveFrom',
    'legal.affiliateDisclosure.tableColEffectiveTo',
  ];

  it.each(EXPECTED_HEADERS)('컬럼 헤더 "%s" 존재 (i18n 키 형식)', async (header) => {
    await renderAffiliatePage();
    expect(
      screen.getByRole('columnheader', { name: header }),
    ).toBeInTheDocument();
  });
});

// ─── 6. UCPD / BE CDE VI.99 키 문구 ─────────────────────────────────────

describe('AffiliatePage — 법적 키 문구', () => {
  beforeEach(() => {
    setRates(PLACEHOLDER_RATES);
  });

  it('commercialRelationBody1 i18n 키 렌더 (상업적 관계 명시)', async () => {
    await renderAffiliatePage();
    // getTranslations mock 은 "legal.affiliateDisclosure.commercialRelationBody1" 반환
    expect(
      screen.getByText(/legal\.affiliateDisclosure\.commercialRelationBody1/),
    ).toBeInTheDocument();
  });

  it('rankingAlgorithmBody1 i18n 키 렌더 (순위 알고리즘 독립성)', async () => {
    await renderAffiliatePage();
    expect(
      screen.getByText(/legal\.affiliateDisclosure\.rankingAlgorithmBody1/),
    ).toBeInTheDocument();
  });

  it('"compare.isolation.test.ts" 텍스트 존재 (단일 출처 약속)', async () => {
    await renderAffiliatePage();
    expect(
      screen.getByText(/compare\.isolation\.test\.ts/),
    ).toBeInTheDocument();
  });
});

// ─── 7. 다크패턴 자가 검사 ────────────────────────────────────────────────

describe('AffiliatePage — 다크패턴 부재', () => {
  beforeEach(() => {
    setRates(PLACEHOLDER_RATES);
  });

  const DARK_PATTERNS = ['지금만', '오늘만', '마감', 'Hurry', 'Limited', '마지막'];

  it.each(DARK_PATTERNS)('다크패턴 문구 "%s" 없음', async (pattern) => {
    await renderAffiliatePage();
    expect(document.body.textContent).not.toContain(pattern);
  });
});
