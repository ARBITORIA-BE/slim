/**
 * ComparisonTable — 수평 카드 리스트 (ADR-0050 §D2, 청크 4 잠금).
 *
 * 이전: desktop native table 7컬럼 + mobile card stack 분기.
 * 현재: 단일 <ul role="list"> 수평 카드 — 청크 4 (C1~C4) 모바일 우선.
 *
 * 청크 4 (Cowan 4±1, ADR-0050 원칙 2):
 *   C1 플랜  — 공급사·요금제명 + 약정 footnote
 *   C2 요금  — €XX/mo 큰 typography (text-accent-dark font-semibold)
 *   C3 절약  — SavingsBar 정규화 막대 + "+€X/mo" 텍스트
 *   C4 CTA   — "Change" 버튼 + ReliabilityDots 5점 도트
 *
 * ADR-0050 §D6 다크패턴 회피 잠금 (가장 중요):
 *   - 1위 카드 임의 하이라이트 0
 *   - "추천" 라벨 0
 *   - "X명이 보고 있어요" 류 0
 *   - 색상 다중화 0 (절약 막대 단일 bg-accent-dark 허용)
 *
 * i18n: getTranslations (RSC) — 'result.table' 네임스페이스.
 */

import type { ResultRowData } from '@/db/queries/comparison';
import type { Confidence } from '@/db/schema/tariff_snapshot';
import type { TariffCategory } from '@/db/schema/tariff';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { formatRelativeTime, type RelativeTimeLocale } from '../_lib/stale';
import { FreshnessRibbon } from './FreshnessRibbon';
import { SavingsBar } from './SavingsBar';
import { ReliabilityDots } from './ReliabilityDots';
import type { ReliabilityLevel } from './ReliabilityDots';
import { DisclosureFold } from './DisclosureFold';
import { AffiliateDisclosureLine } from './AffiliateDisclosureLine';

// ─── Props ────────────────────────────────────────────────────────────────

export interface ComparisonTableProps {
  readonly rows: readonly ResultRowData[];
  readonly now?: Date;
  /** /go/{shortId}/{itemId} CTA href 구성용. page.tsx 가 전달. */
  readonly shortId: string;
  /**
   * locale — formatRelativeTime locale 인자 전달 (ADR-0033 §T5 S2).
   * why: ComparisonTable 은 RSC 이므로 getLocale() 직접 호출 가능.
   *      하지만 CardProps 에 locale 을 내려주기 위해 상위에서 한 번만 호출.
   */
  readonly locale?: RelativeTimeLocale;
}

// ─── 표시 helper ──────────────────────────────────────────────────────────

function formatEuro(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const sub = abs % 100;
  return sub === 0 ? `${sign}€${euros}` : `${sign}€${euros}.${sub.toString().padStart(2, '0')}`;
}

type TableTranslator = Awaited<ReturnType<typeof getTranslations<'result.table'>>>;

function formatCommitment(months: number, t: TableTranslator): string {
  if (months === 0) return t('commitmentNone');
  return t('commitmentMonths', { months });
}

function formatSubtitle(
  category: TariffCategory,
  attrs: Record<string, unknown>,
  t: TableTranslator,
): string {
  const parts: string[] = [];
  if (category === 'mobile') {
    const d = attrs['data_gb'];
    if (d === 'unlimited') parts.push(t('subtitleDataUnlimited'));
    else if (typeof d === 'number') parts.push(t('subtitleDataGb', { value: d }));
    const v = attrs['voice_minutes'];
    if (v === 'unlimited') parts.push(t('subtitleVoiceUnlimited'));
    else if (typeof v === 'number') parts.push(t('subtitleVoiceMinutes', { value: v }));
  } else if (
    category === 'internet_fixed' ||
    category === 'bundle_internet_tv' ||
    category === 'bundle_mobile_internet' ||
    category === 'bundle_mobile_internet_tv'
  ) {
    // ADR-0042 §D1: bundle_mobile_internet / bundle_mobile_internet_tv 추가
    const down = attrs['download_mbps'];
    if (typeof down === 'number') parts.push(`${down} Mbps`);
    if (attrs['unlimited_data'] === true) parts.push(t('subtitleDataUnlimited'));
    if (category === 'bundle_internet_tv' || category === 'bundle_mobile_internet_tv') {
      const tv = attrs['tv_channels'];
      if (typeof tv === 'number') parts.push(t('subtitleTvChannels', { value: tv }));
    }
    if (category === 'bundle_mobile_internet' || category === 'bundle_mobile_internet_tv') {
      const d = attrs['data_gb'];
      if (d === 'unlimited') parts.push(t('subtitleDataUnlimited'));
      else if (typeof d === 'number') parts.push(t('subtitleDataGb', { value: d }));
    }
  }
  return parts.join(' · ');
}

function formatPromoNote(
  promoPriceCents: number | null,
  promoMonths: number | null,
  t: TableTranslator,
): string | null {
  if (promoPriceCents === null || promoMonths === null) return null;
  return t('promoNote', { price: formatEuro(promoPriceCents), months: promoMonths });
}

function formatActivationNote(activationFeeCents: number, t: TableTranslator): string | null {
  if (activationFeeCents <= 0) return null;
  return t('activationNote', { amount: formatEuro(activationFeeCents) });
}

function formatSaving(cents: number, t: TableTranslator): string {
  if (cents > 0) return `+${formatEuro(cents)}`;
  if (cents === 0) return t('savingZero');
  return formatEuro(cents);
}

/** DB confidence (3단) → UI ReliabilityLevel (5단) 매핑. */
function confidenceToLevel(confidence: Confidence): ReliabilityLevel {
  // why: DB enum은 high/medium/low 3단.
  //      verified/stub은 UI 전용 확장 (ADR-0006 §T4 3단 유지 — 미래 fetcher 5단화 대비).
  //      현재는 DB 값을 그대로 매핑 (high=4/5, medium=3/5, low=2/5).
  return confidence;
}

// ─── SourceLink (기존 패턴 유지) ──────────────────────────────────────────

function SourceLink({
  href,
  fetchedAt,
  now,
  locale,
  label,
  newTabLabel,
  checkedLabel,
}: {
  readonly href: string;
  readonly fetchedAt: Date;
  readonly now: Date;
  readonly locale: RelativeTimeLocale;
  readonly label: string;
  readonly newTabLabel: string;
  readonly checkedLabel: string;
}) {
  // why: locale 인자 전달 — ADR-0033 §T5 S2 봉합.
  //      P2 에서 locale 누락 → 한국어 하드코딩 잔존. P3 에서 정합.
  const relative = formatRelativeTime(fetchedAt, now, locale);
  return (
    <a
      href={href}
      target="_blank"
      rel="nofollow noopener"
      className="inline-flex flex-col items-start text-xs text-primary underline-offset-4 hover:underline"
    >
      <span>
        {label} <span aria-hidden="true">↗</span>
        <span className="sr-only"> {newTabLabel}</span>
      </span>
      {/*
        PLAN 4.28: 갱신 시각은 카드 상단 FreshnessRibbon 이 이미 "N시간 전 갱신 ·
        출처: …" 로 말한다. 같은 카드 안에서 두 번 말하면 정보가 아니라 소음이다.
        스크린리더에는 링크 맥락으로 남겨 정보 손실 0 (sr-only).
      */}
      <span className="sr-only">{checkedLabel} {relative}</span>
    </a>
  );
}

// ─── 개별 카드 (청크 4) ───────────────────────────────────────────────────

interface CardProps {
  readonly r: ResultRowData;
  readonly now: Date;
  readonly locale: RelativeTimeLocale;
  readonly maxSavingCents: number;
  readonly t: TableTranslator;
  readonly sourceLinkLabel: string;
  readonly sourceLinkNewTab: string;
  readonly sourceChecked: string;
  readonly shortId?: string;
}

function ComparisonCard({
  r,
  now,
  locale,
  maxSavingCents,
  t,
  sourceLinkLabel,
  sourceLinkNewTab,
  sourceChecked,
  shortId,
}: CardProps) {
  const subtitle = formatSubtitle(r.category, r.attributes, t);
  const promoNote = formatPromoNote(r.promoPriceCents, r.promoMonths, t);
  const actNote = formatActivationNote(r.activationFeeCents, t);
  const savingText = `${formatSaving(r.monthlySavingCents, t)} ${t('savingMonthly')}`;

  const level = confidenceToLevel(r.confidence);
  const levelLabel = t(`reliability.levels.${r.confidence}`);
  const dotsScore = level === 'verified' ? 5 : level === 'high' ? 4 : level === 'medium' ? 3 : level === 'stub' ? 1 : 2;
  const dotsAriaLabel = t('reliability.dots.ariaLabel', {
    n: dotsScore,
    confidence: levelLabel,
  });

  const savingPct =
    maxSavingCents > 0 && r.monthlySavingCents > 0
      ? Math.min(100, Math.round((r.monthlySavingCents / maxSavingCents) * 100))
      : 0;
  const savingsBarAriaLabel = t('savingsBar.ariaLabel', {
    amount: formatSaving(r.monthlySavingCents, t),
    pct: savingPct,
  });

  const disclosureSummaryLabel = t('disclosure.summary');
  const disclosureAriaLabel = t('disclosure.ariaLabel', { providerName: r.providerName });

  // CTA href — shortId가 있으면 /go/ 경로, 없으면 sourceUrl fallback.
  const ctaHref = shortId ? `/go/${shortId}/${r.itemId}` : r.sourceUrl;

  return (
    <li>
      {/* FreshnessRibbon — 카드 상단 신선도 띠 (ADR-0050 §D4, 헌법 P1). */}
      {/* why: FreshnessRibbon 은 RSC async 컴포넌트. 카드 li 상단에 위치. */}
      <FreshnessRibbon
        fetchedAt={r.fetchedAt}
        sourceUrl={r.sourceUrl}
        now={now}
      />
      <article
        // why: min-h 고정 — ADR-0050 원칙 7 visual rhythm 행 균일 잠금.
        //      flex-col md:flex-row — 모바일 stack / 데스크톱 수평.
        //      rounded-t-none — FreshnessRibbon 이 상단 둥글기 담당.
        className="flex min-h-[88px] flex-col gap-3 rounded-b-2xl border border-t-0 border-fg/10 bg-bg p-4 md:flex-row md:items-center"
      >
        {/* C1 플랜 — 공급사·요금제 + 약정 footnote */}
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
            #{r.rank}
          </span>
          <p className="font-display text-sm font-semibold leading-snug text-fg">
            {r.providerName}
          </p>
          <p className="text-sm text-fg">{r.tariffName}</p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-fg-soft">{subtitle}</p>
          )}
          <p className="mt-0.5 text-xs text-fg-soft">
            {formatCommitment(r.commitmentMonths, t)}
          </p>
        </div>

        {/* C2 요금 — €XX/mo 큰 typography */}
        <div className="flex flex-col gap-0.5 md:w-28 md:items-end">
          {/* why: text-accent-dark font-semibold — ADR-0041 §D21 가격 강조. */}
          <span className="text-base font-semibold text-accent-dark">
            {formatEuro(r.monthlyAvg12Cents)}{' '}
            <span className="text-xs font-normal">{t('monthlyCostUnit')}</span>
          </span>
          {/*
            PLAN 4.28: 이 숫자는 **12개월 평균**이다 — 프로모 요금제라면 어느 달에도
            실제로 청구되지 않는 금액이다 (예: 6개월 €14.99 → 이후 €16.99 → 평균 €15.99).
            결론 카드에는 라벨이 있었는데 표에는 "/ mo" 만 있어 현재가처럼 읽혔다.
          */}
          <span className="text-[10px] text-fg-soft">{t('monthlyAvgLabel')}</span>
          {(promoNote ?? actNote) && (
            <span className="text-[10px] text-fg-soft">
              {[promoNote, actNote].filter(Boolean).join(' · ')}
            </span>
          )}
          <SourceLink
            href={r.sourceUrl}
            fetchedAt={r.fetchedAt}
            now={now}
            locale={locale}
            label={sourceLinkLabel}
            newTabLabel={sourceLinkNewTab}
            checkedLabel={sourceChecked}
          />
        </div>

        {/* C3 절약 막대 — pre-attentive (ADR-0050 §D6 허용) */}
        <div className="md:w-36">
          <SavingsBar
            savingCents={r.monthlySavingCents}
            maxSavingCents={maxSavingCents}
            ariaLabel={savingsBarAriaLabel}
            savingText={savingText}
          />
          <p className="mt-0.5 text-[10px] text-fg-soft">
            {t('savingYearly', { amount: formatSaving(r.yearlySavingCents, t) })}
          </p>
        </div>

        {/* C4 CTA + ReliabilityDots */}
        <div className="flex flex-col items-start gap-2 md:items-end">
          <Link
            href={ctaHref}
            className="inline-flex items-center justify-center rounded-full bg-fg px-5 py-2 text-sm font-medium text-bg transition hover:bg-primary"
          >
            {t('ctaButton')}
          </Link>
          <ReliabilityDots
            level={level}
            ariaLabel={dotsAriaLabel}
          />
        </div>
      </article>

      {/* 디스클로저 펼침 — AffiliateDisclosureLine 래핑 (원칙 6 extraneous load 외화). */}
      {/* why: DisclosureFold 로 감싸 행 높이 균일 잠금 유지.
              AffiliateDisclosureLine 은 RSC async → DisclosureFold 내부에서 await 렌더. */}
      <DisclosureFold
        summaryLabel={disclosureSummaryLabel}
        summaryAriaLabel={disclosureAriaLabel}
      >
        <AffiliateDisclosureLine
          providerId={r.providerId}
          providerName={r.providerName}
          affiliateStatus={r.affiliateStatus}
        />
      </DisclosureFold>
    </li>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────

export async function ComparisonTable({ rows, now, shortId, locale: localeProp }: ComparisonTableProps) {
  // why: RSC 이므로 getTranslations + getLocale 사용.
  //      locale 은 props 로 받거나 getLocale() 로 자동 획득.
  const [t, rawLocale] = await Promise.all([
    getTranslations('result.table'),
    localeProp ? Promise.resolve(localeProp) : getLocale(),
  ]);
  const ref = now ?? new Date();

  // why: locale → RelativeTimeLocale 좁힘 ('ko'|'en'|'nl'|'fr' 외 → 'en' fallback).
  const locale: RelativeTimeLocale =
    rawLocale === 'ko' || rawLocale === 'en' || rawLocale === 'nl' || rawLocale === 'fr'
      ? rawLocale
      : 'en';

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-fg/10 bg-bg-warm/40 p-6 text-sm text-fg-soft">
        {t('emptyMessage')}
      </p>
    );
  }

  const sourceLinkLabel = t('sourceLink');
  const sourceLinkNewTab = t('sourceLinkNewTab');
  const sourceChecked = t('sourceChecked');

  // why: 정규화 기준 — 이 비교 결과 내 최대 절약액. 음수 포함 시 0 처리.
  const maxSavingCents = Math.max(0, ...rows.map((r) => r.monthlySavingCents));

  // why: shortId는 URL에서 사용할 수 없으므로 CTA href는 itemId 기반 구성.
  //      page.tsx 가 shortId를 props로 안 넘기므로 itemId fallback = sourceUrl 사용.
  //      (page.tsx 수정 없이 ComparisonTable props 확장 불필요 — itemId는 rows에 있음)

  return (
    <ul
      aria-label={t('ariaLabel')}
      role="list"
      className="flex flex-col gap-3"
    >
      {rows.map((r) => (
        <ComparisonCard
          key={r.tariffSnapshotId}
          r={r}
          now={ref}
          locale={locale}
          maxSavingCents={maxSavingCents}
          t={t}
          sourceLinkLabel={sourceLinkLabel}
          sourceLinkNewTab={sourceLinkNewTab}
          sourceChecked={sourceChecked}
          shortId={shortId}
        />
      ))}
    </ul>
  );
}
