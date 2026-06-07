/**
 * ComparisonTable — 2층 비교 표 (PLAN 3.2, ADR-0021 §T2 2층 + §T5 caveats 매트릭스).
 *
 * 디자인:
 *   - Desktop (md:): native `<table>` — 정보 밀도 ↑.
 *   - Mobile (<md): 카드 stack.
 *
 * i18n: getTranslations (RSC) — 'result.table' 네임스페이스.
 *
 * 다크 패턴 회피 (헌법 §8 #3 + ADR-0021 §T5):
 *   - 색상 neutral. 절약액 강조 색상 X.
 */

import type { ResultRowData } from '@/db/queries/comparison';
import type { Confidence } from '@/db/schema/tariff_snapshot';
import type { TariffCategory } from '@/db/schema/tariff';
import { getTranslations } from 'next-intl/server';

import { formatRelativeTime } from '../_lib/stale';
import { AffiliateDisclosureLine } from './AffiliateDisclosureLine';

// ─── Props ────────────────────────────────────────────────────────────────

export interface ComparisonTableProps {
  readonly rows: readonly ResultRowData[];
  readonly now?: Date;
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
    // TV 채널 — TV 포함 카테고리만
    if (category === 'bundle_internet_tv' || category === 'bundle_mobile_internet_tv') {
      const tv = attrs['tv_channels'];
      if (typeof tv === 'number') parts.push(t('subtitleTvChannels', { value: tv }));
    }
    // 모바일 데이터 — 모바일 포함 번들
    if (category === 'bundle_mobile_internet' || category === 'bundle_mobile_internet_tv') {
      const d = attrs['data_gb'];
      if (d === 'unlimited') parts.push(t('subtitleDataUnlimited'));
      else if (typeof d === 'number') parts.push(t('subtitleDataGb', { value: d }));
    }
  }
  // ADR-0005 §Amendment 1 (2026-05-16): landline 분기 제거
  // ADR-0042 §D1 (2026-06-07): bundle_mobile_internet / bundle_mobile_internet_tv 추가
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

function SourceLink({
  href,
  fetchedAt,
  now,
  label,
  newTabLabel,
  checkedLabel,
}: {
  readonly href: string;
  readonly fetchedAt: Date;
  readonly now: Date;
  readonly label: string;
  readonly newTabLabel: string;
  readonly checkedLabel: string;
}) {
  const relative = formatRelativeTime(fetchedAt, now);
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
      <span className="text-fg-soft">{checkedLabel} {relative}</span>
    </a>
  );
}

// why: confidence prop 제거 — 레이블을 외부에서 조회해 label 로만 받음.
// confidence 값 자체는 aria-label / 표시 텍스트에 불필요. label 이 이미 정보 포함.
function ConfidenceBadge({ label }: { label: string }) {
  return (
    // PLAN 3.7.b — 인쇄 시 bg 안 보임 → print:border-current 로 배지 경계선 유지
    <span
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-full border border-fg/15 bg-bg px-2 py-0.5 text-xs text-fg-soft print:border-current"
    >
      <span aria-hidden="true">●</span>
      {label}
    </span>
  );
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────

export async function ComparisonTable({ rows, now }: ComparisonTableProps) {
  // why: RSC 이므로 getTranslations 사용.
  const t = await getTranslations('result.table');
  const ref = now ?? new Date();

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

  const confidenceLabels: Record<Confidence, string> = {
    high: t('confidenceAriaPrefix') + t('confidenceLabels.high'),
    medium: t('confidenceAriaPrefix') + t('confidenceLabels.medium'),
    low: t('confidenceAriaPrefix') + t('confidenceLabels.low'),
  };

  return (
    <>
      {/* Desktop: native table. */}
      <div className="hidden overflow-x-auto rounded-2xl border border-fg/10 md:block print:block">
        <table
          aria-label={t('ariaLabel')}
          className="w-full border-collapse text-sm"
        >
          <thead className="bg-bg-warm/60 text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('columns.rank')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('columns.provider')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('columns.monthlyCost')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('columns.commitment')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('columns.saving')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('columns.confidence')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('columns.source')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const subtitle = formatSubtitle(r.category, r.attributes, t);
              const promoNote = formatPromoNote(r.promoPriceCents, r.promoMonths, t);
              const actNote = formatActivationNote(r.activationFeeCents, t);
              const savingYearly = t('savingYearly', { amount: formatSaving(r.yearlySavingCents, t) });
              return (
                <tr
                  key={r.tariffSnapshotId}
                  className="border-t border-fg/10 align-top"
                >
                  <th
                    scope="row"
                    className="px-4 py-3 text-left text-sm font-medium text-fg-soft"
                  >
                    #{r.rank}
                  </th>
                  <td className="px-4 py-3">
                    <div className="font-medium text-fg">{r.providerName}</div>
                    <div className="text-fg">{r.tariffName}</div>
                    {subtitle && (
                      <div className="mt-0.5 text-xs text-fg-soft">{subtitle}</div>
                    )}
                    <AffiliateDisclosureLine
                      providerId={r.providerId}
                      providerName={r.providerName}
                      affiliateStatus={r.affiliateStatus}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-fg">{formatEuro(r.monthlyAvg12Cents)} {t('monthlyCostUnit')}</div>
                    {(promoNote ?? actNote) && (
                      <div className="mt-0.5 text-xs text-fg-soft">
                        {[promoNote, actNote].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-fg">
                    {formatCommitment(r.commitmentMonths, t)}
                  </td>
                  <td className="px-4 py-3 text-fg">
                    {formatSaving(r.monthlySavingCents, t)} {t('savingMonthly')}
                    <div className="mt-0.5 text-xs text-fg-soft">
                      {savingYearly}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ConfidenceBadge label={confidenceLabels[r.confidence] ?? r.confidence} />
                  </td>
                  <td className="px-4 py-3">
                    <SourceLink
                      href={r.sourceUrl}
                      fetchedAt={r.fetchedAt}
                      now={ref}
                      label={sourceLinkLabel}
                      newTabLabel={sourceLinkNewTab}
                      checkedLabel={sourceChecked}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: card stack. */}
      <ul aria-label={t('mobileAriaLabel')} className="flex flex-col gap-3 md:hidden print:hidden">
        {rows.map((r) => {
          const subtitle = formatSubtitle(r.category, r.attributes, t);
          const promoNote = formatPromoNote(r.promoPriceCents, r.promoMonths, t);
          const actNote = formatActivationNote(r.activationFeeCents, t);
          const savingYearly = t('savingYearly', { amount: formatSaving(r.yearlySavingCents, t) });
          return (
            <li key={r.tariffSnapshotId}>
              <article className="flex flex-col gap-2 rounded-2xl border border-fg/10 bg-bg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-medium text-muted">#{r.rank}</span>
                    <h3 className="font-display text-base font-semibold text-fg">
                      {r.providerName} — {r.tariffName}
                    </h3>
                    {subtitle && (
                      <p className="mt-0.5 text-xs text-fg-soft">{subtitle}</p>
                    )}
                  </div>
                  <ConfidenceBadge label={confidenceLabels[r.confidence] ?? r.confidence} />
                </div>
                <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-fg-soft">{t('columns.monthlyCost')}</dt>
                  <dd className="text-fg">
                    {formatEuro(r.monthlyAvg12Cents)} {t('monthlyCostUnit')}
                    {(promoNote ?? actNote) && (
                      <span className="ml-2 text-xs text-fg-soft">
                        {[promoNote, actNote].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </dd>
                  <dt className="text-fg-soft">{t('columns.commitment')}</dt>
                  <dd className="text-fg">{formatCommitment(r.commitmentMonths, t)}</dd>
                  <dt className="text-fg-soft">{t('columns.saving')}</dt>
                  <dd className="text-fg">
                    {formatSaving(r.monthlySavingCents, t)} {t('savingMonthly')} · {savingYearly}
                  </dd>
                </dl>
                <div className="mt-1 border-t border-fg/10 pt-2">
                  <SourceLink
                    href={r.sourceUrl}
                    fetchedAt={r.fetchedAt}
                    now={ref}
                    label={sourceLinkLabel}
                    newTabLabel={sourceLinkNewTab}
                    checkedLabel={sourceChecked}
                  />
                </div>
                <AffiliateDisclosureLine
                  providerId={r.providerId}
                  providerName={r.providerName}
                  affiliateStatus={r.affiliateStatus}
                />
              </article>
            </li>
          );
        })}
      </ul>
    </>
  );
}
