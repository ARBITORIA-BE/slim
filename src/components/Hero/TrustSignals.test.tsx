/**
 * TrustSignals 단위 테스트 (PLAN 4.13.c DoD, ADR-0041 D1 §블록 5).
 *
 * 검증:
 *   (1) trustNoAds 텍스트 렌더 (헌법 §8 #4)
 *   (2) trustAffiliateDisclosure 링크 → /legal/affiliate-disclosure (헌법 P3)
 *   (3) trustExcluded 링크 → /data-sources (헌법 P3 + ADR-0011)
 *
 * Mock 전략:
 *   - next-intl/server: getTranslations mock
 *   - next/link: href 속성 보존 plain <a>
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => {
    const map: Record<string, string> = {
      trustNoAds: '0 advertenties · Vergelijkingsresultaten zijn 100% algoritmisch',
      trustAffiliateDisclosure: 'Affiliatecommissies openbaar',
      trustExcluded: 'Uitgesloten aanbieders openbaar',
    };
    return map[key] ?? key;
  }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => <a href={href} className={className}>{children}</a>,
}));

import { TrustSignals } from './TrustSignals';

describe('TrustSignals', () => {
  it('trustNoAds 텍스트가 렌더됨', async () => {
    const Component = await TrustSignals();
    render(Component);
    expect(screen.getByText(/0 advertenties/i)).toBeInTheDocument();
  });

  it('trustAffiliateDisclosure 링크가 /legal/affiliate-disclosure 를 가리킴', async () => {
    const Component = await TrustSignals();
    render(Component);
    const link = screen.getByRole('link', { name: /affiliatecommissies/i });
    expect(link).toHaveAttribute('href', '/legal/affiliate-disclosure');
  });

  it('trustExcluded 링크가 /data-sources 를 가리킴', async () => {
    const Component = await TrustSignals();
    render(Component);
    const link = screen.getByRole('link', { name: /uitgesloten/i });
    expect(link).toHaveAttribute('href', '/data-sources');
  });
});
