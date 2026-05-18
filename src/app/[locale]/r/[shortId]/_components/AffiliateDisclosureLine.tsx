/**
 * AffiliateDisclosureLine — 결과 카드 하단 제휴 수수료 디스클로저 (PLAN 4.3.c).
 *
 * ADR-0026 §T4 + §검토 5 (UCPD + BE CDE VI.99).
 *
 * i18n: getTranslations (RSC) — 'result.affiliateDisclosure' 네임스페이스.
 *
 * RSC (서버 컴포넌트) — 'use client' 불필요.
 */

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import type { AffiliateStatus } from '@/db/schema/provider';
import { getRateForProvider } from '@/data/affiliate-rates';
import { formatEuroCents } from '@/lib/format-eur';

// ─── Props ─────────────────────────────────────────────────────────────────

export interface AffiliateDisclosureLineProps {
  readonly providerId: string;
  readonly providerName: string;
  readonly affiliateStatus: AffiliateStatus;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────

export async function AffiliateDisclosureLine({
  providerId,
  providerName,
  affiliateStatus,
}: AffiliateDisclosureLineProps) {
  // why: RSC 이므로 getTranslations 사용. 'result.affiliateDisclosure' 네임스페이스.
  const t = await getTranslations('result.affiliateDisclosure');

  const isActive =
    affiliateStatus === 'active_b2b_intra_eu' ||
    affiliateStatus === 'active_b2b_domestic_be';

  if (!isActive) {
    return (
      <div
        aria-label={`${providerName} ${t('noCommission')}`}
        className="border-t border-fg/10 pt-2 mt-3 text-xs text-fg-soft"
      >
        {t('noCommissionDetail')}
      </div>
    );
  }

  const rate = getRateForProvider(providerId, affiliateStatus);

  if (rate === null) {
    return (
      <div
        // why: t() ICU — {providerName} 을 각 언어 번역에 주입.
        aria-label={t('disclosureAriaLabel', { providerName })}
        className="border-t border-fg/10 pt-2 mt-3 text-xs text-fg-soft"
      >
        {t('commissionUnknown', { providerName })}{' '}
        <Link
          href="/legal/affiliate-disclosure"
          className="underline-offset-4 hover:underline"
        >
          {t('policyLink')}
        </Link>
      </div>
    );
  }

  const formattedAmount = formatEuroCents(rate.amountCents);

  return (
    <div
      // why: t() ICU — {providerName} 을 각 언어 번역에 주입.
      aria-label={t('disclosureAriaLabel', { providerName })}
      className="border-t border-fg/10 pt-2 mt-3 text-xs text-fg-soft"
    >
      {t('commissionKnown', { providerName, amount: formattedAmount })}{' '}
      <Link
        href="/legal/affiliate-disclosure"
        className="underline-offset-4 hover:underline"
      >
        {t('policyLink')}
      </Link>
    </div>
  );
}
