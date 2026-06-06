/**
 * SavingsExample — 블록 4: 예시 절약액 placeholder (ADR-0041 D1 §블록 4, Q4 옵션 A, PLAN 4.13.c).
 *
 * RSC. 0 데이터 정직 표시 (ADR-0029 §T2 정직성 토큰 보존).
 * 실데이터 격상은 별 PR (4.13 범위 밖, 4.7 SCRAPING 14/14 실데이터 누적 후).
 *
 * i18n: getTranslations (RSC) — 'home' 네임스페이스.
 * WCAG AA: text-muted.
 */

import { getTranslations } from 'next-intl/server';

export async function SavingsExample() {
  // why: RSC 이므로 getTranslations 사용 (await 필요).
  const t = await getTranslations('home');

  return (
    <section
      aria-label="savings-example"
      className="rounded-xl border border-fg/10 bg-bg-warm/50 px-6 py-4 text-center"
    >
      {/* ADR-0029 §T2 정직성 토큰 — "최고/유일/혁신" 0, 데이터 부재 솔직 표기 */}
      <p className="text-sm text-muted italic">
        {t('savingsExamplePending')}
      </p>
    </section>
  );
}
