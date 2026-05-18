/**
 * CalculationDetails — 계산 근거 펼치기 (ADR-0021 §T7).
 *
 * HTML `<details>` + `<summary>` native — JS 0, a11y 표준.
 *
 * i18n: getTranslations (RSC) — 'result.calculationDetails' 네임스페이스.
 *
 * 노출 구성:
 *   1. 사용한 가정
 *   2. 사용량 수치
 *   3. 적용 산식
 *   4. 주의사항
 *   5. 주의사항 트리거 조건
 *   6. 엔진 버전
 */

import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import type { UsageProfile } from '@/engine/types';
import type {
  HouseholdTypeInput,
  TariffCategoryInput,
} from '@/types/comparison-input';

import type { CaveatTriggerRow } from '../_lib/caveat-triggers';

// ─── Props ────────────────────────────────────────────────────────────────

export interface CalculationBreakdown {
  readonly monthlyAvg12Cents: number;
  readonly monthlyAvg24Cents: number;
  readonly activationAmortizedPerMonthCents: number;
}

export interface CalculationDetailsProps {
  readonly category: TariffCategoryInput;
  readonly householdType: HouseholdTypeInput | undefined;
  readonly inputAttributes: Readonly<Record<string, unknown>>;
  readonly usageProfile: UsageProfile;
  readonly breakdown: CalculationBreakdown;
  readonly caveats: readonly string[];
  readonly triggerRows?: readonly CaveatTriggerRow[] | undefined;
  readonly inputsAbsent?: boolean;
  readonly engineVersion: string;
  readonly estimatorVersion: string;
}

// ─── 표시 helper ──────────────────────────────────────────────────────────

function formatEuro(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const sub = abs % 100;
  return sub === 0 ? `${sign}€${euros}` : `${sign}€${euros}.${sub.toString().padStart(2, '0')}`;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

// ─── 핵심 컴포넌트 ────────────────────────────────────────────────────────

export async function CalculationDetails(props: CalculationDetailsProps) {
  // why: RSC 이므로 getTranslations 사용. 'result.calculationDetails' 네임스페이스.
  const t = await getTranslations('result.calculationDetails');

  const {
    category,
    householdType,
    inputAttributes,
    usageProfile,
    breakdown,
    caveats,
    triggerRows,
    inputsAbsent = false,
    engineVersion,
    estimatorVersion,
  } = props;

  const hasInputAttrs = Object.keys(inputAttributes).length > 0;
  const usageSource = inputsAbsent
    ? t('assumptions.usageSourceAnonymized', { version: estimatorVersion })
    : hasInputAttrs
      ? t('assumptions.usageSourceDirect')
      : t('assumptions.usageSourceEstimated', { version: estimatorVersion });

  const categoryLabel = t(`categoryLabels.${category}` as Parameters<typeof t>[0]);
  const householdLabel = householdType
    ? t(`householdLabels.${householdType}` as Parameters<typeof t>[0])
    : t('assumptions.householdUnknown');

  // UsageList — 카테고리별 usage 필드 노출
  const usageItems: { label: string; value: string }[] = [];
  if (category === 'mobile') {
    if (usageProfile.data_gb_used !== undefined) usageItems.push({ label: t('usageLabels.dataGb'), value: `${usageProfile.data_gb_used} ${t('usageLabels.dataGbUnit')}` });
    if (usageProfile.voice_minutes_used !== undefined) usageItems.push({ label: t('usageLabels.voiceMinutes'), value: `${usageProfile.voice_minutes_used} ${t('usageLabels.voiceMinutesUnit')}` });
    if (usageProfile.sms_count !== undefined) usageItems.push({ label: t('usageLabels.sms'), value: `${usageProfile.sms_count} ${t('usageLabels.smsUnit')}` });
    if (usageProfile.eu_roaming_needed !== undefined) {
      usageItems.push({ label: t('usageLabels.euRoaming'), value: usageProfile.eu_roaming_needed ? t('usageLabels.euRoamingNeeded') : t('usageLabels.euRoamingNotNeeded') });
    }
  }
  if (category === 'internet_fixed' || category === 'bundle_internet_tv') {
    if (usageProfile.download_mbps_needed !== undefined) usageItems.push({ label: t('usageLabels.downloadMbps'), value: `${usageProfile.download_mbps_needed} ${t('usageLabels.downloadMbpsUnit')}` });
    if (usageProfile.household_devices !== undefined) usageItems.push({ label: t('usageLabels.devices'), value: `${usageProfile.household_devices} ${t('usageLabels.devicesUnit')}` });
    if (usageProfile.streaming_4k !== undefined) {
      usageItems.push({ label: t('usageLabels.streaming4k'), value: usageProfile.streaming_4k ? t('usageLabels.streaming4kNeeded') : t('usageLabels.streaming4kNotNeeded') });
    }
  }
  if (category === 'bundle_internet_tv') {
    if (usageProfile.tv_channels_needed !== undefined) usageItems.push({ label: t('usageLabels.tvChannels'), value: `${usageProfile.tv_channels_needed} ${t('usageLabels.tvChannelsUnit')}` });
    if (usageProfile.tv_4k_needed !== undefined) {
      usageItems.push({ label: t('usageLabels.tv4k'), value: usageProfile.tv_4k_needed ? t('usageLabels.tv4kNeeded') : t('usageLabels.tv4kNotNeeded') });
    }
  }
  // ADR-0005 §Amendment 1 (2026-05-16): landline 분기 제거

  return (
    <details className="rounded-2xl border border-fg/10 bg-bg-warm/30 p-4">
      <summary className="cursor-pointer select-none text-sm font-medium text-fg outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
        {t('summary')}
      </summary>

      <div className="mt-4 flex flex-col gap-5">
        {inputsAbsent && (
          <p className="rounded-lg border border-fg/10 bg-bg/60 px-3 py-2 text-xs leading-relaxed text-fg-soft">
            {t('anonymizedWarning')}
          </p>
        )}
        <Section title={t('assumptions.heading')}>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-fg-soft">{t('assumptions.categoryLabel')}</dt>
            <dd className="text-fg">{categoryLabel}</dd>
            <dt className="text-fg-soft">{t('assumptions.householdLabel')}</dt>
            <dd className="text-fg">{householdLabel}</dd>
            <dt className="text-fg-soft">{t('assumptions.usageSourceLabel')}</dt>
            <dd className="text-fg">{usageSource}</dd>
          </dl>
        </Section>

        <Section title={t('usageHeading')}>
          {usageItems.length === 0 ? (
            <p className="text-sm text-fg-soft">{t('usageEmpty')}</p>
          ) : (
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
              {usageItems.map(({ label, value }) => (
                <div key={label} className="contents">
                  <dt className="text-fg-soft">{label}</dt>
                  <dd className="text-fg">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </Section>

        <Section title={t('formulaHeading')}>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-fg-soft">{t('formulaLabels.monthly12')}</dt>
            <dd className="text-fg">{formatEuro(breakdown.monthlyAvg12Cents)} {t('formulaLabels.monthly12Unit')}</dd>
            <dt className="text-fg-soft">{t('formulaLabels.monthly24')}</dt>
            <dd className="text-fg">{formatEuro(breakdown.monthlyAvg24Cents)} {t('formulaLabels.monthly24Unit')}</dd>
            <dt className="text-fg-soft">{t('formulaLabels.activationAmortize')}</dt>
            <dd className="text-fg">{formatEuro(breakdown.activationAmortizedPerMonthCents)} {t('formulaLabels.activationAmortizeUnit')}</dd>
          </dl>
        </Section>

        {caveats.length > 0 && (
          <Section title={t('caveatsHeading')}>
            <ul className="flex list-inside list-disc flex-col gap-1 text-sm text-fg">
              {caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </Section>
        )}

        {triggerRows && triggerRows.length > 0 && (
          <Section title={t('triggerHeading')}>
            <p className="text-xs text-muted">
              {t('triggerNote')}
            </p>
            <ul className="mt-1 flex flex-col gap-1.5 text-sm">
              {triggerRows.map((r, i) => (
                <li key={i} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                  <span
                    aria-hidden="true"
                    className={
                      r.triggered
                        ? 'mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-fg/60 sm:mt-0'
                        : 'mt-0.5 inline-block size-1.5 shrink-0 rounded-full border border-fg/30 sm:mt-0'
                    }
                  />
                  <span className="text-fg">{r.condition}</span>
                  <span className="text-fg-soft">— {r.note}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title={t('engineHeading')}>
          <code className="rounded bg-bg px-2 py-1 font-mono text-xs text-fg-soft">
            {engineVersion} / {estimatorVersion}
          </code>
          <p className="text-xs text-muted">
            {t('engineNote')}
          </p>
        </Section>
      </div>
    </details>
  );
}
