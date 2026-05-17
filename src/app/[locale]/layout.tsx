/**
 * [locale] Layout — next-intl v3 App Router 표준 배선 (ADR-0033 §T1).
 *
 * 역할:
 *   - <html lang={locale}> — locale 별 언어 속성 (SEO + a11y)
 *   - NextIntlClientProvider — 클라이언트 컴포넌트에서 useTranslations() 사용 가능하게
 *   - setRequestLocale — RSC 에서 locale 접근 허용 (next-intl v3 static rendering 패턴)
 *   - generateStaticParams — 빌드 시 모든 locale 정적 생성
 *
 * 왜 root layout.tsx 가 아닌 여기서 <html> 을 선언하는가?
 *   next-intl v3 App Router 표준 패턴 — [locale] layout 이 <html lang> 을 담당.
 *   root layout.tsx 는 최소화 (font/globals.css 만 보유, html 태그 없음).
 *
 * ko: locale 목록 비포함 (ADR-0033 §T2) — URL에 /ko/ 없음.
 *   베타 사용자는 defaultLocale(nl-BE) URL로 접근, nl-BE 메시지(= ko 내용)를 봄.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';

import { SITE_ORIGIN } from '@/lib/site';
import { routing } from '@/i18n/routing';

import '../globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: 'Slim — 비교는 쉽게, 절약은 두툼하게',
    template: '%s · Slim',
  },
  description: '베네룩스 비교 플랫폼. BE · NL · LU에서 5분 안에 비교.',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: 'Slim',
    title: 'Slim — 비교는 쉽게, 절약은 두툼하게',
    description: '베네룩스 비교 플랫폼. BE · NL · LU에서 5분 안에 비교.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Slim — 비교는 쉽게, 절약은 두툼하게',
    description: '베네룩스 비교 플랫폼. BE · NL · LU에서 5분 안에 비교.',
  },
};

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
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
