/**
 * /compare — 카테고리 선택 (ADR-0016 §T2, ADR-0041 Amendment 1 D7, PLAN 4.13.c).
 *
 * RSC. CategoryGrid variant="full" 재사용 — DRY 원칙 (ADR-0041 Q8 옵션 A).
 *
 * Amendment 1 변경:
 *   - max-w-3xl → max-w-5xl (D7.1 — 우측 빈 공간 해소)
 *   - grid md:grid-cols-2 → md:grid-cols-3 (D7.2 — 3 카드 한 줄)
 *   - 카피 친근화 (D7.3 — headingFriendly / supportNoteShort / stepBadgeReduced)
 *   - 카드 가격 예시 (D7.4 — showExamples)
 *   - 아이콘 h-14 w-14 / 카테고리명 text-xl (D7.5 — density="full")
 *
 * 헌법 §8 #3: 다크패턴 0. "추천" 라벨 / 색상 강조 0 (CategoryGrid 내에서 보장).
 * ADR-0034 D2: 통신 BE만, 다른 카테고리 placeholder 0.
 * i18n: getTranslations (RSC) — 'compare' 네임스페이스.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';

import { buildAlternates } from '@/lib/alternates';
import { CategoryGrid } from '@/components/Hero/CategoryGrid';

/**
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
    // ADR-0041 D7.1: max-w-3xl → max-w-5xl (우측 빈 공간 해소)
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-4 py-10 md:px-6 md:py-16">
      {/* CategoryGrid variant="full" — 헤더 포함, 가격 예시, 3컬럼 그리드 */}
      <CategoryGrid variant="full" showExamples density="full" />

      {/* 이용약관 + 개인정보처리방침 동의 간주 문구 (PLAN 4.12.d.(가)) */}
      <footer className="border-t border-fg/10 pt-6 text-xs text-muted">
        {t('termsNotice')}{' '}
        <Link href="/legal/terms" className="underline underline-offset-4 hover:text-fg-soft">
          {t('termsLink')}
        </Link>{' '}
        {/* 개인정보처리방침 링크 추가 (PLAN 4.12.d.(가)) */}
        {t('termsAndPrivacyConnector')}{' '}
        <Link href="/legal/privacy" className="underline underline-offset-4 hover:text-fg-soft">
          {t('privacyLink')}
        </Link>{' '}
        {t('termsNoticeEnd')}
      </footer>
    </main>
  );
}
