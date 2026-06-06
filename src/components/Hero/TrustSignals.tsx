/**
 * TrustSignals — 블록 5: 신뢰 시그널 3종 (ADR-0041 D1 §블록 5, PLAN 4.13.c).
 *
 * RSC. 헌법 P3 투명성 above-the-fold 노출.
 * - trustNoAds: 헌법 §8 #4 (광고/비교 혼합 금지)
 * - trustAffiliateDisclosure: 헌법 P3 + ADR-0026 (수수료 공개)
 * - trustExcluded: 헌법 P3 + ADR-0011 (제외 공급사 공개)
 *
 * i18n: getTranslations (RSC) — 'home' 네임스페이스.
 * ADR-0041 D21: 강조 단어 = text-accent-dark (Bronze Gold, WCAG AA 4.5:1).
 */

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function TrustSignals() {
  // why: RSC 이므로 getTranslations 사용 (await 필요).
  const t = await getTranslations('home');

  return (
    <section
      aria-label="trust-signals"
      className="flex flex-col gap-2 text-sm text-fg-soft"
    >
      {/* 신호 1: 광고 0 (헌법 §8 #4) */}
      <p>
        <span className="font-semibold text-accent-dark">{t('trustNoAds')}</span>
      </p>

      {/* 신호 2: 어필리에이트 수수료 공개 (헌법 P3) */}
      <p>
        <Link
          href="/legal/affiliate-disclosure"
          className="font-semibold text-accent-dark underline-offset-4 hover:underline"
        >
          {t('trustAffiliateDisclosure')}
        </Link>
      </p>

      {/* 신호 3: 제외 공급사 공개 (헌법 P3 + ADR-0011) */}
      <p>
        <Link
          href="/data-sources"
          className="font-semibold text-accent-dark underline-offset-4 hover:underline"
        >
          {t('trustExcluded')}
        </Link>
      </p>
    </section>
  );
}
