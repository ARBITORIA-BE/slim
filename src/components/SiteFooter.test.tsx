/**
 * SiteFooter 단위 테스트 (PLAN 4.10.c DoD).
 *
 * async RSC + getTranslations('footer') → next-intl/server mock (4.5.j.4.A 패턴).
 * @/i18n/navigation Link 는 plain <a> 로 mock — href 결정성 확보.
 */
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// next-intl/server mock — footer 네임스페이스 ko 라벨 직접 주입
vi.mock('next-intl/server', () => ({
  getTranslations: async () => {
    const labels: Record<string, string> = {
      companyInfoHeading: '사업자 정보',
      operatorLabel: '운영자',
      companyNumberLabel: '기업번호',
      vatLabel: 'VAT 번호',
      addressLabel: '주소',
      contactLabel: '문의',
      legalLinksLabel: '법무 및 투명성',
      affiliateDisclosureLink: '제휴 수수료 공개',
      dataSourcesLink: '데이터 출처',
      copyright: '© {year} Slim',
    };
    return (key: string, vars?: Record<string, string | number>) => {
      let text = labels[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      return text;
    };
  },
}));

// i18n navigation Link → plain anchor (href 결정성)
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// LocaleSwitcher 는 client 훅(usePathname/useLocale/useTranslations)을 사용 —
// SiteFooter 단위 테스트에서는 스텁으로 격리 (전용 검증은 LocaleSwitcher.test.tsx).
// why: 미스텁 시 usePathname(@/i18n/navigation mock 미제공) + next-intl client 훅이
//      provider 없이 throw → SiteFooter 6 케이스 전부 깨짐 (4.11.c 회귀 차단).
vi.mock('./LocaleSwitcher', () => ({
  LocaleSwitcher: () => <nav aria-label="language">lang</nav>,
}));

import { SiteFooter } from './SiteFooter';

describe('SiteFooter', () => {
  it('기업번호 관례 표기 노출 (1037.548.919)', async () => {
    render(await SiteFooter());
    expect(screen.getByText('1037.548.919')).toBeInTheDocument();
  });

  it('VAT 관례 표기 노출 (BE 1037.548.919)', async () => {
    render(await SiteFooter());
    expect(screen.getByText('BE 1037.548.919')).toBeInTheDocument();
  });

  it('법인명 노출', async () => {
    render(await SiteFooter());
    expect(screen.getByText('Kim Wonmin')).toBeInTheDocument();
  });

  it('법무 링크 href 정합', async () => {
    render(await SiteFooter());
    expect(
      screen.getByRole('link', { name: '제휴 수수료 공개' }),
    ).toHaveAttribute('href', '/legal/affiliate-disclosure');
    expect(
      screen.getByRole('link', { name: '데이터 출처' }),
    ).toHaveAttribute('href', '/data-sources');
  });

  it('주소 미수령 — 주소 줄 비노출 (P1)', async () => {
    render(await SiteFooter());
    // 주소 라벨이 렌더되지 않아야 한다 (address null → 조건부 비노출)
    expect(screen.queryByText('주소:')).not.toBeInTheDocument();
  });

  it('연락 이메일 mailto 링크', async () => {
    render(await SiteFooter());
    expect(
      screen.getByRole('link', { name: 'kim.wonmin91@gmail.com' }),
    ).toHaveAttribute('href', 'mailto:kim.wonmin91@gmail.com');
  });
});
