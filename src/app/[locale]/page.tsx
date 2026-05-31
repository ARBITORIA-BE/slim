import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { buildAlternates } from '@/lib/alternates';

/**
 * 루트 레이아웃의 title template(`%s · Slim`) 을 사용하지 않고
 * absolute 로 설정한다.
 * 홈은 브랜드 슬로건 전체가 title 이어야 탭에서 의미가 있다.
 *
 * i18n: generateMetadata + getTranslations (RSC) — 'home' 네임스페이스.
 * ADR-0033 §A2.9.1 — locale 명시 전달 패턴.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // next-intl v3: metadata 컨텍스트는 setRequestLocale 보장 안 됨 → locale 명시 (§A2.9.1 규칙 2)
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'home' });

  // hreflang: 5 locale × '/' — Google Localized Versions (PLAN 3.5.4, ADR-0034 D5)
  const alts = buildAlternates(locale, '/');

  return {
    title: {
      // absolute — layout template 무시하고 전체 title 직접 (홈 브랜드 슬로건)
      absolute: t('metaTitle'),
    },
    description: t('metaDescription'),
    alternates: alts,
  };
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // next-intl v3 static rendering 활성화 (RSC 컴포넌트 내부)
  setRequestLocale(locale);
  // why: RSC 이므로 getTranslations 사용 (await 필요).
  // 'home' 네임스페이스 = ko.json "home" 키 블록.
  const t = await getTranslations('home');

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="font-display text-5xl font-medium tracking-tight">
        {t('headline')}<span className="text-accent">.</span>
      </h1>
      <p className="text-fg-soft text-lg max-w-md text-center">
        {t('tagline')}
      </p>
      <Link
        href="/compare"
        className="rounded-full bg-fg px-6 py-3 text-sm font-medium text-bg transition hover:bg-primary"
      >
        {t('ctaButton')}
      </Link>
    </main>
  );
}
