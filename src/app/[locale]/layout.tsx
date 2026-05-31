/**
 * [locale] Layout — next-intl v3 App Router 표준 배선 (ADR-0033 §T1).
 *
 * 역할:
 *   - <html lang={locale}> — locale 별 언어 속성 (SEO + a11y)
 *   - NextIntlClientProvider — 클라이언트 컴포넌트에서 useTranslations() 사용 가능하게
 *   - setRequestLocale — RSC 에서 locale 접근 허용 (next-intl v3 static rendering 패턴)
 *   - generateStaticParams — 빌드 시 모든 locale 정적 생성
 *   - generateMetadata — 브랜드 메타데이터 i18n (ADR-0033 §A2.9.1)
 *
 * 왜 root layout.tsx 가 아닌 여기서 <html> 을 선언하는가?
 *   next-intl v3 App Router 표준 패턴 — [locale] layout 이 <html lang> 을 담당.
 *   root layout.tsx 는 최소화 (font/globals.css 만 보유, html 태그 없음).
 *
 * ko: locale 목록 비포함 (ADR-0033 §T2) — URL에 /ko/ 없음.
 *   베타 사용자는 defaultLocale(nl-BE) URL로 접근, nl-BE 메시지(= ko 내용)를 봄.
 *
 * og:locale 동적 매핑 (§A2.9.2):
 *   nl-BE → nl_BE, nl-NL → nl_NL, fr-BE → fr_BE, fr-LU → fr_LU, en → en_US
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';

import { SITE_ORIGIN } from '@/lib/site';
import { routing } from '@/i18n/routing';
import { SiteFooter } from '@/components/SiteFooter';
import { CookieConsent } from '@/components/CookieConsent';

import '../globals.css';

/**
 * locale → OG locale 코드 매핑 (§A2.9.2).
 * 'en' 은 en_US 로 매핑 (Open Graph 표준 코드).
 */
const OG_LOCALE_MAP: Record<string, string> = {
  'nl-BE': 'nl_BE',
  'nl-NL': 'nl_NL',
  'fr-BE': 'fr_BE',
  'fr-LU': 'fr_LU',
  'en': 'en_US',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // next-intl v3: metadata 컨텍스트는 setRequestLocale 보장 안 됨 → locale 명시 전달 (§A2.9.1 규칙 2)
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'metadata' });

  const ogLocale = OG_LOCALE_MAP[locale] ?? 'nl_BE';

  return {
    metadataBase: new URL(SITE_ORIGIN),
    title: {
      default: t('defaultTitle'),
      template: '%s · Slim', // 브랜드 template — 영문, 한글 아님 (§A2.9.5)
    },
    description: t('description'),
    openGraph: {
      type: 'website',
      locale: ogLocale,
      siteName: 'Slim',
      title: t('ogTitle'),
      description: t('ogDescription'),
    },
    twitter: {
      card: 'summary_large_image',
      title: t('ogTitle'),
      description: t('ogDescription'),
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  // locale 유효성 검증 — routing.locales 에 없으면 404
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  // next-intl v3 static rendering 활성화
  setRequestLocale(locale);

  // 서버에서 메시지 로드 (request.ts 의 getRequestConfig 사용)
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
          {/* 전역 footer — 사업자 식별정보 상시 노출 (CDE Art. XII.6, PLAN 4.10.d) */}
          <SiteFooter />
          {/* 쿠키 동의 배너 — client island, localStorage 게이팅 (PLAN 4.12.c, ADR-0037) */}
          <CookieConsent />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
