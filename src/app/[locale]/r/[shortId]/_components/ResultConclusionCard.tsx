/**
 * ResultConclusionCard — 페이지 1층 결론 카드 (PLAN 3.1, ADR-0021 §T2 1층).
 *
 * i18n: getTranslations (RSC) — 'result.conclusionCard' 네임스페이스.
 *
 * 표시:
 *   - 1위 공급사 + 요금제명 (heading)
 *   - 핵심 메시지 (4 상태별 — positive saving / zero / negative / new subscriber)
 *   - 월 비용 (12개월 평균) + 예상 절약 (positive 만)
 *   - 신뢰도 배지 (confidence != 'high' 시 노출)
 *   - caveats 리스트
 *   - 변경하기 CTA placeholder
 *
 * 다크 패턴 회피 (헌법 §8 #3 + ADR-0021 §T5):
 *   - 색상 *neutral*
 *   - "X명이 지금 보고 있어요" 류 0.
 *   - 절약액 부풀리지 않음.
 */

import type { Confidence } from '@/db/schema/tariff_snapshot';
import type { AffiliateStatus } from '@/db/schema/provider';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

import { AffiliateDisclosureLine } from './AffiliateDisclosureLine';

// ─── Props ────────────────────────────────────────────────────────────────

export interface ResultConclusionCardProps {
  readonly providerName: string;
  readonly tariffName: string;
  readonly monthlySavingCents: number;
  readonly yearlySavingCents: number;
  readonly monthlyAvg12Cents: number;
  readonly confidence: Confidence;
  readonly caveats: readonly string[];
  readonly isNewSubscriber: boolean;
  readonly ctaHref: string | null;
  readonly providerId: string;
  readonly affiliateStatus: AffiliateStatus;
}

// ─── 표시 helper ──────────────────────────────────────────────────────────

function formatEuro(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const sub = abs % 100;
  return sub === 0 ? `${sign}€${euros}` : `${sign}€${euros}.${sub.toString().padStart(2, '0')}`;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────

export async function ResultConclusionCard(props: ResultConclusionCardProps) {
  // why: RSC 이므로 getTranslations 사용. 'result.conclusionCard' 네임스페이스.
  const t = await getTranslations('result.conclusionCard');

  const {
    providerName,
    tariffName,
    monthlySavingCents,
    yearlySavingCents,
    monthlyAvg12Cents,
    confidence,
    caveats,
    isNewSubscriber,
    ctaHref,
    providerId,
    affiliateStatus,
  } = props;

  // verdict 결정 — t() 로 텍스트 조회
  let verdictHeadline: string;
  let showSavings: boolean;
  if (isNewSubscriber) {
    verdictHeadline = t('verdicts.newSubscriber');
    showSavings = false;
  } else if (monthlySavingCents > 0) {
    verdictHeadline = t('verdicts.positiveSaving', { amount: formatEuro(monthlySavingCents) });
    showSavings = true;
  } else if (monthlySavingCents === 0) {
    verdictHeadline = t('verdicts.zero');
    showSavings = false;
  } else {
    verdictHeadline = t('verdicts.negative');
    showSavings = false;
  }

  const confidenceLabel = t(`confidenceLabels.${confidence}` as Parameters<typeof t>[0]);

  return (
    <article
      aria-labelledby="conclusion-heading"
      className="flex flex-col gap-4 rounded-2xl border border-fg/10 bg-bg-warm/60 p-6"
    >
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">
          {t('rankLabel')}
        </span>
        <h2
          id="conclusion-heading"
          className="font-display text-2xl font-semibold tracking-tight text-fg"
        >
          {providerName} — {tariffName}
        </h2>
      </div>

      <p className="text-base leading-relaxed text-fg">{verdictHeadline}</p>

      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-fg-soft">{t('monthlyCostLabel')}</dt>
        <dd className="text-fg">{formatEuro(monthlyAvg12Cents)} {t('monthlyCostUnit')}</dd>
        {showSavings && (
          <>
            <dt className="text-fg-soft">{t('savingsLabel')}</dt>
            <dd className="text-fg">
              {formatEuro(monthlySavingCents)} {t('monthlyCostUnit')} · {formatEuro(yearlySavingCents)}
            </dd>
          </>
        )}
      </dl>

      {confidence !== 'high' && (
        // PLAN 3.7.b — 인쇄 시 배경색 안 보임 → border 로 배지 구분 유지.
        <p className="inline-flex w-fit items-center gap-2 rounded-full border border-fg/15 bg-bg px-3 py-1 text-xs text-fg-soft print:border-current">
          <span className="sr-only">{t('confidenceAriaPrefix')}</span>
          <span aria-hidden="true">●</span>
          {confidenceLabel}
        </p>
      )}

      {caveats.length > 0 && (
        <section aria-labelledby="conclusion-caveats">
          <h3
            id="conclusion-caveats"
            className="text-sm font-semibold text-fg"
          >
            {t('caveatsHeading')}
          </h3>
          <ul className="mt-1 flex list-inside list-disc flex-col gap-1 text-sm text-fg">
            {caveats.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </section>
      )}

      {/* PLAN 4.1.c — "변경하기" CTA 활성화. */}
      {ctaHref ? (
        <Link
          href={ctaHref}
          className="print:hidden inline-flex w-fit items-center justify-center rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-bg transition hover:bg-primary"
        >
          {t('ctaButton')}
        </Link>
      ) : (
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={t('ctaDisabledTitle')}
          className="print:hidden inline-flex w-fit cursor-not-allowed items-center justify-center rounded-full border border-fg/15 bg-bg px-5 py-2.5 text-sm font-medium text-fg-soft opacity-70"
        >
          {t('ctaButton')}
        </button>
      )}

      {/* PLAN 4.3.c — 결론 카드 하단 슬롯: 디스클로저 라인 */}
      <AffiliateDisclosureLine
        providerId={providerId}
        providerName={providerName}
        affiliateStatus={affiliateStatus}
      />
    </article>
  );
}
