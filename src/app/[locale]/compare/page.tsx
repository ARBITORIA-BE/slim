/**
 * /compare — 카테고리 선택 (ADR-0016 §T2).
 *
 * RSC. 3 카드 (mobile/internet_fixed/bundle_internet_tv) 동일 시각
 * 무게 — 다크 패턴 0 (헌법 §8 #3 "추천" 라벨 / 색상 강조 0).
 * landline 제거: ADR-0005 §Amendment 1 (2026-05-16), D-1 흔적 제거.
 *
 * 평균 절약액 미리보기는 페이즈 4 베타 후 노출 (ADR-0011 §T2 항목 5 동형 — 0
 * 데이터 정직 표시).
 *
 * ADR-0033 §T1: [locale] 세그먼트 — setRequestLocale 추가.
 * i18n: getTranslations (RSC) — 'compare' 네임스페이스.
 */

import type { Metadata } from 'next';
import { Smartphone, Tv, Wifi, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { TARIFF_CATEGORIES, type TariffCategoryInput } from '@/types/comparison-input';
import { buildAlternates } from '@/lib/alternates';

/**
 * 기존 compare.pageTitle / compare.pageDescription 키 재사용 (§A2.9.2).
 * ADR-0033 §A2.9.1 — locale 명시 전달 패턴.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'compare' });

  // hreflang: 5 locale × '/compare' (PLAN 3.5.4, ADR-0034 D5)
  const alts = buildAlternates(locale, '/compare');

  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
    alternates: alts,
  };
}

type CategoryIconKey = TariffCategoryInput;

const CATEGORY_ICONS: Record<CategoryIconKey, LucideIcon> = {
  mobile: Smartphone,
  internet_fixed: Wifi,
  bundle_internet_tv: Tv,
};

// TARIFF_CATEGORIES enum 정합성 자가 점검 (개발자 안전망)
const iconKeys = new Set<string>(Object.keys(CATEGORY_ICONS));
for (const c of TARIFF_CATEGORIES) {
  if (!iconKeys.has(c)) {
    throw new Error(`/compare: TARIFF_CATEGORIES "${c}" 아이콘 누락 — CATEGORY_ICONS 추가 필요`); // @i18n-allow 개발자 에러 메시지
  }
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // why: RSC 이므로 getTranslations 사용. 'compare' 네임스페이스.
  const t = await getTranslations('compare');

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-4 py-10 md:px-6 md:py-16">
      <header className="flex flex-col gap-3">
        <span className="text-sm text-muted">{t('stepBadge')}</span>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          {t('heading')}
        </h1>
        <p className="text-base text-fg-soft">
          {t('supportNote')}
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-4 md:auto-rows-fr md:grid-cols-2">
        {TARIFF_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICONS[category];
          // why: 타입 단언 없이 접근 — TARIFF_CATEGORIES 와 CATEGORY_ICONS 키가 정합함을 위 점검이 보장.
          const label = t(`categories.${category}.label` as Parameters<typeof t>[0]);
          const description = t(`categories.${category}.description` as Parameters<typeof t>[0]);
          return (
            <li key={category}>
              <Link
                href={`/compare/${category}/postal`}
                className="block rounded-2xl outline-none ring-offset-bg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={t('ariaStart', { label })}
              >
                <Card className="flex h-full flex-col justify-between transition hover:border-primary/40 hover:bg-bg-warm/70">
                  <CardHeader className="flex flex-row items-center gap-4 pb-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" aria-hidden />
                    </span>
                    <div className="flex flex-col gap-1">
                      <CardTitle>{label}</CardTitle>
                      <CardDescription className="line-clamp-2 min-h-[2.5em]">{description}</CardDescription>
                    </div>
                  </CardHeader>
                  <p className="text-xs text-muted">{t('savingsPreviewPending')}</p>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* 이용약관 + 개인정보처리방침 동의 간주 문구 (PLAN 4.12.d.(가)) */}
      <footer className="border-t border-fg/10 pt-6 text-xs text-muted">
        {t('termsNotice')}{' '}
        <Link href="/legal/terms" className="underline underline-offset-4 hover:text-fg-soft">
          {t('termsLink')}
        </Link>{' '}
        {/* 개인정보처리방침 링크 추가 (PLAN 4.12.d.(가)) — 접속사 i18n */}
        {t('termsAndPrivacyConnector')}{' '}
        <Link href="/legal/privacy" className="underline underline-offset-4 hover:text-fg-soft">
          {t('privacyLink')}
        </Link>{' '}
        {t('termsNoticeEnd')}
      </footer>
    </main>
  );
}
