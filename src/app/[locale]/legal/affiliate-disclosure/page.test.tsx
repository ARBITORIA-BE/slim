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

  it('알림 배너 표시 (개발용 placeholder 문구)', () => {
    render(<AffiliatePage />);
    expect(screen.getByRole('note')).toBeInTheDocument();
    expect(screen.getByRole('note').textContent).toMatch(/개발용 placeholder/);
    expect(screen.getByRole('note').textContent).toMatch(/ADR-0027/);
  });

  it('표 렌더 — 2건 entry 행 존재', () => {
    render(<AffiliatePage />);
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

  it('알림 배너 없음', () => {
    render(<AffiliatePage />);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('표 렌더 — 1건 entry 행 존재', () => {
    render(<AffiliatePage />);
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

  it('"활성 어필리에이트 계약이 없습니다" 메시지 표시', () => {
    render(<AffiliatePage />);
    expect(
      screen.getByText(/현재 활성 어필리에이트 계약이 없습니다/),
    ).toBeInTheDocument();
  });

  it('표 없음', () => {
    render(<AffiliatePage />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

// ─── 4. EUR 포맷 ──────────────────────────────────────────────────────────

describe('AffiliatePage — EUR 포맷', () => {
  it('amountCents=5000 → "50" 포함 (nl-BE EUR)', () => {
    setRates(PLACEHOLDER_RATES); // placeholder-proximus-be amountCents=5000
    render(<AffiliatePage />);
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

  const EXPECTED_HEADERS = [
    '공급사',
    '유형',
    '단가',
    '통화',
    '출처',
    '확인 일자',
    '발효 일자',
    '만료 일자',
  ];

  it.each(EXPECTED_HEADERS)('컬럼 헤더 "%s" 존재', (header) => {
    render(<AffiliatePage />);
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

  it('"어필리에이트 수수료를 받는" 문구 존재', () => {
    render(<AffiliatePage />);
    expect(screen.getByText(/어필리에이트 수수료를 받는/)).toBeInTheDocument();
  });

  it('"절약액 내림차순" 문구 존재', () => {
    render(<AffiliatePage />);
    expect(screen.getByText(/절약액 내림차순/)).toBeInTheDocument();
  });

  it('"어필리에이트 여부 / 수수료 수령 여부는 순위에 영향을 주지 않습니다" 문구 존재', () => {
    render(<AffiliatePage />);
    expect(
      screen.getByText(/어필리에이트 여부 \/ 수수료 수령 여부는 순위에 영향을 주지 않습니다/),
    ).toBeInTheDocument();
  });

  it('"compare.isolation.test.ts" 텍스트 존재 (단일 출처 약속)', () => {
    render(<AffiliatePage />);
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

  it.each(DARK_PATTERNS)('다크패턴 문구 "%s" 없음', (pattern) => {
    render(<AffiliatePage />);
    expect(document.body.textContent).not.toContain(pattern);
  });
});
