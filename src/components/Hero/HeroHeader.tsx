/**
 * HeroHeader — 블록 1: H1 + subheading (ADR-0041 D1 §블록 1, PLAN 4.13.c).
 *
 * RSC. 정체성 카피 노출 — 신규 방문자가 5초 안에 "통신 3사 비교"를 판독.
 * i18n: getTranslations (RSC) — 'home' 네임스페이스.
 *
 * WCAG: H1 text-fg (14:1 vs bg, AAA). subheading text-fg-soft (6.9:1 vs bg, AAA).
 */

import { getTranslations } from 'next-intl/server';

export async function HeroHeader() {
  // why: RSC 이므로 getTranslations 사용 (await 필요).
  const t = await getTranslations('home');

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <h1 className="font-display text-3xl font-medium tracking-tight text-fg md:text-5xl">
        {t('headline')}
      </h1>
      <p className="max-w-md text-center text-lg text-fg-soft">
        {t('subheading')}
      </p>
    </div>
  );
}
