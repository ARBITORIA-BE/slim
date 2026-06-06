/**
 * SiteHeader 단위 테스트 (PLAN 4.13.c DoD, ADR-0041 Amendment 3).
 *
 * 검증:
 *   (1) "Slim" 브랜드 링크 href="/" 렌더
 *   (2) LocaleSwitcher 렌더 (mock — 클라이언트 island)
 *   (3) header 태그로 감싸져 있음
 *
 * Mock 전략:
 *   - LocaleSwitcher: 단순 nav 텍스트 렌더 (client hook 의존 제거)
 *   - next/link: href 속성 보존 plain <a>
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// LocaleSwitcher mock — client hooks(useLocale/usePathname) 의존 제거
vi.mock('@/components/LocaleSwitcher', () => ({
  LocaleSwitcher: () => <nav data-testid="locale-switcher">lang</nav>,
}));

// next/link mock — href 속성 보존
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

import { SiteHeader } from './SiteHeader';

describe('SiteHeader', () => {
  it('"Slim" 브랜드 링크가 href="/"로 렌더됨', () => {
    render(<SiteHeader />);
    const brandLink = screen.getByRole('link', { name: 'Slim' });
    expect(brandLink).toBeInTheDocument();
    expect(brandLink).toHaveAttribute('href', '/');
  });

  it('LocaleSwitcher 가 렌더됨', () => {
    render(<SiteHeader />);
    expect(screen.getByTestId('locale-switcher')).toBeInTheDocument();
  });

  it('header 요소로 감싸져 있음', () => {
    const { container } = render(<SiteHeader />);
    expect(container.querySelector('header')).not.toBeNull();
  });
});
