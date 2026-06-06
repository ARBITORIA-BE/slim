// __SAFE_PRICE_DISPLAY__: 테스트 픽스처 — 가격 숫자는 실제 UI 표시 아님 (mock 데이터).
/**
 * CategoryGrid 단위 테스트 (PLAN 4.13.c DoD, ADR-0041 D1 §블록 2 + Amendment 1 D7~D8).
 *
 * 검증:
 *   (1) 카테고리 3개 링크 렌더 (/compare/{category}/postal 경로)
 *   (2) showExamples=false 시 가격 예시 없음
 *   (3) showExamples=true + cheapest data 있음 → 가격 텍스트 포함
 *   (4) showExamples=true + cheapest data 없음 → pending placeholder 노출
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
  getTranslations: vi.fn().mockResolvedValue((key: string, params?: Record<string, string>) => {
    const map: Record<string, string> = {
      'categories.mobile.label': 'Mobiel',
      'categories.internet_fixed.label': 'Internet',
      'categories.bundle_internet_tv.label': 'Internet + TV',
      'categories.mobile.description': '€15–€35 per maand',
      'categories.internet_fixed.description': '€35–€70 per maand',
      'categories.bundle_internet_tv.description': '€60–€100 per maand',
      ariaStart: params?.label ? `${params.label} vergelijking starten` : 'vergelijking starten',
      headingFriendly: 'Welk tarief wilt u nu vergelijken?',
      stepBadgeReduced: 'Stap 1/4 · circa 4 minuten',
      supportNoteShort: 'Belgische telecom',
      savingsPreviewPending: 'Voorbeeldbesparing — bèta-data wordt verzameld',
      exampleCheapestLabel: 'bijv. {provider} {tariff} {price}/maand',
      priceSourceAriaLabel: 'Databron: {sourceUrl}',
    };
    return map[key] ?? key;
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

// lucide-react mock
vi.mock('lucide-react', () => ({
  Smartphone: () => <span data-icon="smartphone" />,
  Wifi: () => <span data-icon="wifi" />,
  Tv: () => <span data-icon="tv" />,
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

  it('카테고리 3개 링크가 /compare/{category}/postal 경로로 렌더됨 (variant=hero)', async () => {
    const Component = await CategoryGrid({ variant: 'hero' });
    render(Component);
    expect(screen.getByRole('link', { name: /mobiel/i })).toHaveAttribute(
      'href',
      '/compare/mobile/postal',
    );
    expect(screen.getByRole('link', { name: /internet vergelijking/i })).toHaveAttribute(
      'href',
      '/compare/internet_fixed/postal',
    );
    expect(screen.getByRole('link', { name: /internet \+ tv vergelijking/i })).toHaveAttribute(
      'href',
      '/compare/bundle_internet_tv/postal',
    );
  });

  it('showExamples=false 시 가격 예시 없음', async () => {
    const Component = await CategoryGrid({ variant: 'hero', showExamples: false });
    render(Component);
    // pending placeholder 없음
    expect(screen.queryByText(/voorbeeldbesparing/i)).not.toBeInTheDocument();
  });

  it('showExamples=true + 데이터 없음 → pending placeholder 표시', async () => {
    mockGetCheapest.mockResolvedValue({});
    const Component = await CategoryGrid({ variant: 'hero', showExamples: true });
    render(Component);
    // 3 카테고리 모두 placeholder
    const pendingItems = screen.getAllByText(/voorbeeldbesparing/i);
    expect(pendingItems.length).toBe(3);
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
