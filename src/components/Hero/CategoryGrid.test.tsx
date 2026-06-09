// __SAFE_PRICE_DISPLAY__: 테스트 픽스처 — 가격 숫자는 실제 UI 표시 아님 (mock 데이터).
/**
 * CategoryGrid 단위 테스트 (PLAN 4.13.c DoD + PLAN 4.14.c, ADR-0041 D1 §블록 2 + ADR-0042 §D1).
 *
 * 검증:
 *   (1) 카테고리 5개 링크 렌더 (/compare/{category}/current-provider 경로) — ADR-0042 §D1 + ADR-0043 §D5
 *   (2) showExamples=false 시 가격 예시 없음
 *   (3) showExamples=true + cheapest data 있음 → 가격 텍스트 포함
 *   (4) showExamples=true + cheapest data 없음 → pending placeholder 노출 (5개)
 *
 * Mock 전략:
 *   - next-intl/server, next/link, lucide-react: 각 의존성 mock
 *   - getCheapestTariffByCategory: 제어된 mock
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// getCheapestTariffByCategory mock
const mockGetCheapest = vi.fn().mockResolvedValue({});
vi.mock('@/db/queries/cheapest-tariff', () => ({
  getCheapestTariffByCategory: () => mockGetCheapest(),
}));

// next-intl/server mock
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockImplementation(async () => {
    const map: Record<string, string> = {
      'categories.mobile.label': 'Mobiel',
      'categories.internet_fixed.label': 'Internet',
      'categories.bundle_internet_tv.label': 'Internet + TV',
      'categories.bundle_mobile_internet.label': 'Mobiel + Internet',
      'categories.bundle_mobile_internet_tv.label': 'Mobiel + Internet + TV',
      'categories.mobile.description': '€15–€35 per maand',
      'categories.internet_fixed.description': '€35–€70 per maand',
      'categories.bundle_internet_tv.description': '€60–€100 per maand',
      'categories.bundle_mobile_internet.description': '€50–€90 per maand',
      'categories.bundle_mobile_internet_tv.description': '€70–€120 per maand',
      headingFriendly: 'Welk tarief wilt u nu vergelijken?',
      stepBadgeReduced: 'Stap 1/4 · circa 4 minuten',
      supportNoteShort: 'Belgische telecom',
      savingsPreviewPending: 'Voorbeeldbesparing — bèta-data wordt verzameld',
      exampleCheapestLabel: 'bijv. {provider} {tariff} {price}/maand',
      priceSourceAriaLabel: 'Databron: {sourceUrl}',
    };
    // why: next-intl t 함수는 callable + .raw 메소드. 둘 다 mock 필요.
    const t = ((key: string, params?: Record<string, string>): string => {
      if (key === 'ariaStart') {
        return params?.label ? `${params.label} vergelijking starten` : 'vergelijking starten';
      }
      return map[key] ?? key;
    }) as ((key: string, params?: Record<string, string>) => string) & {
      raw: (key: string) => string;
    };
    t.raw = (key: string) => map[key] ?? key;
    return t;
  }),
}));

// next/link mock
vi.mock('next/link', () => ({
  default: ({ href, children, className, 'aria-label': ariaLabel }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    'aria-label'?: string;
  }) => <a href={href} className={className} aria-label={ariaLabel}>{children}</a>,
}));

// lucide-react mock — ADR-0042 §D1: Package2 + TvMinimalPlay 신규 아이콘 포함
vi.mock('lucide-react', () => ({
  Smartphone: () => <span data-icon="smartphone" />,
  Wifi: () => <span data-icon="wifi" />,
  Tv: () => <span data-icon="tv" />,
  Package2: () => <span data-icon="package2" />,
  TvMinimalPlay: () => <span data-icon="tv-minimal-play" />,
}));

// shadcn/ui card mock
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h3 className={className}>{children}</h3>
  ),
  CardDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <p className={className}>{children}</p>
  ),
}));

import { CategoryGrid } from './CategoryGrid';

describe('CategoryGrid', () => {
  beforeEach(() => {
    mockGetCheapest.mockResolvedValue({});
  });

  it('카테고리 5개 링크가 /compare/{category}/current-provider 경로로 렌더됨 (ADR-0042 §D1 + ADR-0043 §D5)', async () => {
    // ADR-0043 §D5 (2026-06-08): postal 단계 제거 → current-provider 직진.
    // 4.16 본문은 라우트 자체를 삭제했고, 본 hero 카드도 진입점을 동시 갱신해야 함.
    // 회귀 봉합 (2026-06-09): 4.16 sweep 누락 → home 카드가 /postal 가리킴 = 사용자 클릭 시 404.
    const Component = await CategoryGrid({ variant: 'hero' });
    render(Component);
    // 기존 3개 — exact aria-label 매칭 (substring 충돌 방지)
    expect(screen.getByRole('link', { name: 'Mobiel vergelijking starten' })).toHaveAttribute(
      'href',
      '/compare/mobile/current-provider',
    );
    expect(screen.getByRole('link', { name: 'Internet vergelijking starten' })).toHaveAttribute(
      'href',
      '/compare/internet_fixed/current-provider',
    );
    expect(screen.getByRole('link', { name: 'Internet + TV vergelijking starten' })).toHaveAttribute(
      'href',
      '/compare/bundle_internet_tv/current-provider',
    );
    // 신규 2개 (ADR-0042 §D1)
    expect(screen.getByRole('link', { name: 'Mobiel + Internet vergelijking starten' })).toHaveAttribute(
      'href',
      '/compare/bundle_mobile_internet/current-provider',
    );
    expect(screen.getByRole('link', { name: 'Mobiel + Internet + TV vergelijking starten' })).toHaveAttribute(
      'href',
      '/compare/bundle_mobile_internet_tv/current-provider',
    );
  });

  it('showExamples=false 시 가격 예시 없음', async () => {
    const Component = await CategoryGrid({ variant: 'hero', showExamples: false });
    render(Component);
    // pending placeholder 없음
    expect(screen.queryByText(/voorbeeldbesparing/i)).not.toBeInTheDocument();
  });

  it('showExamples=true + 데이터 없음 → pending placeholder 5개 표시 (ADR-0042 §D1)', async () => {
    mockGetCheapest.mockResolvedValue({});
    const Component = await CategoryGrid({ variant: 'hero', showExamples: true });
    render(Component);
    // 5 카테고리 모두 placeholder
    const pendingItems = screen.getAllByText(/voorbeeldbesparing/i);
    expect(pendingItems.length).toBe(5);
  });

  it('showExamples=true + mobile cheapest 데이터 있음 → 가격 포함', async () => {
    mockGetCheapest.mockResolvedValue({
      mobile: {
        category: 'mobile' as const,
        providerName: 'Proximus',
        tariffName: 'Mobilus Light',
        monthlyPriceCents: 1500,
        sourceUrl: 'https://www.proximus.be',
        lastSeenAt: '2026-06-06T06:00:00.000Z',
      },
    });
    const Component = await CategoryGrid({ variant: 'hero', showExamples: true });
    render(Component);
    // Proximus 가 텍스트로 포함됨
    expect(screen.getByText(/proximus/i)).toBeInTheDocument();
  });
});
