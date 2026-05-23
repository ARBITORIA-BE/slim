/**
 * LocaleSwitcher 단위 테스트 (PLAN 4.11.a DoD).
 *
 * 검증:
 *   (1) routing.locales 5개 링크 전부 렌더
 *   (2) 현재 locale 링크에 aria-current="true" + font-semibold 클래스
 *   (3) 비활성 locale 링크에 aria-current 없음
 *   (4) 모든 링크의 href 가 현재 pathname 을 보존
 *   (5) nav aria-label 이 t('languageLabel') 값으로 렌더
 *
 * Mock 전략:
 *   - @/i18n/navigation: Link → plain <a> (href + locale 속성 보존), usePathname 고정
 *   - next-intl: useLocale 고정, useTranslations footer.languageLabel 반환
 *   - @/i18n/routing: routing.locales 실 값 사용 (mock 불요 — 순수 상수)
 */

import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const FIXED_PATHNAME = '/compare/mobile';
const FIXED_CURRENT_LOCALE = 'fr-BE';

// next-intl mock — useLocale/useTranslations
vi.mock('next-intl', () => ({
  useLocale: () => FIXED_CURRENT_LOCALE,
  useTranslations: (ns: string) => {
    const map: Record<string, Record<string, string>> = {
      footer: { languageLabel: 'Langue' },
    };
    return (key: string) => map[ns]?.[key] ?? key;
  },
}));

// @/i18n/navigation mock — usePathname 고정 경로 반환, Link = plain <a> + locale attr
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => FIXED_PATHNAME,
  // locale prop 을 data-locale 속성으로 노출해 검증에 활용
  Link: ({
    href,
    locale,
    children,
    className,
    'aria-current': ariaCurrent,
  }: {
    href: string;
    locale?: string;
    children: ReactNode;
    className?: string;
    'aria-current'?: string;
  }) => (
    <a
      href={href}
      data-locale={locale}
      className={className}
      aria-current={ariaCurrent}
    >
      {children}
    </a>
  ),
}));

import { LocaleSwitcher } from './LocaleSwitcher';

describe('LocaleSwitcher', () => {
  it('5 locale 링크 전부 렌더', () => {
    render(<LocaleSwitcher />);
    // endonym 텍스트로 5개 링크 확인
    expect(
      screen.getByRole('link', { name: 'Nederlands (BE)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Nederlands (NL)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Français (BE)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Français (LU)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'English' }),
    ).toBeInTheDocument();
  });

  it('현재 locale(fr-BE) 링크에 aria-current="true"', () => {
    render(<LocaleSwitcher />);
    const frBeLink = screen.getByRole('link', { name: 'Français (BE)' });
    expect(frBeLink).toHaveAttribute('aria-current', 'true');
  });

  it('비활성 locale 링크에는 aria-current 없음', () => {
    render(<LocaleSwitcher />);
    const nlBeLink = screen.getByRole('link', { name: 'Nederlands (BE)' });
    expect(nlBeLink).not.toHaveAttribute('aria-current');
    const enLink = screen.getByRole('link', { name: 'English' });
    expect(enLink).not.toHaveAttribute('aria-current');
  });

  it('모든 링크의 href 가 현재 pathname 보존', () => {
    render(<LocaleSwitcher />);
    const links = screen.getAllByRole('link');
    for (const link of links) {
      expect(link).toHaveAttribute('href', FIXED_PATHNAME);
    }
  });

  it('각 링크의 data-locale 이 routing.locales 순서대로', () => {
    render(<LocaleSwitcher />);
    const links = screen.getAllByRole('link');
    const locales = links.map((l) => l.getAttribute('data-locale'));
    expect(locales).toEqual(['nl-BE', 'nl-NL', 'fr-BE', 'fr-LU', 'en']);
  });

  it('nav aria-label 이 t("languageLabel") 값("Langue") 으로 렌더', () => {
    render(<LocaleSwitcher />);
    expect(screen.getByRole('navigation', { name: 'Langue' })).toBeInTheDocument();
  });

  it('현재 locale 링크에 font-semibold 클래스 포함', () => {
    render(<LocaleSwitcher />);
    const frBeLink = screen.getByRole('link', { name: 'Français (BE)' });
    expect(frBeLink.className).toContain('font-semibold');
  });
});
