/**
 * ExcludedProvidersSection — 비교 제외 공급사 노출 (PLAN 3.4, ADR-0021 §T6).
 *
 * 헌법 §3 P3 + ADR-0011 §T2 항목 3 동형 — "비교에서 제외된 공급사도 이름 공개".
 *
 * i18n: getTranslations (RSC) — 'result.excludedProviders' 네임스페이스.
 *
 * 0건 시 섹션 자체 비노출 (정보 noise 회피).
 */

import { getTranslations } from 'next-intl/server';
import type { ExcludedProvider } from '@/db/queries/providers';

export interface ExcludedProvidersSectionProps {
  readonly providers: readonly ExcludedProvider[];
}

export async function ExcludedProvidersSection({
  providers,
}: ExcludedProvidersSectionProps) {
  if (providers.length === 0) return null;

  // why: RSC 이므로 getTranslations 사용.
  const t = await getTranslations('result.excludedProviders');

  return (
    <section
      aria-labelledby="excluded-providers-heading"
      className="flex flex-col gap-3 rounded-2xl border border-fg/10 bg-bg p-6"
    >
      <h2
        id="excluded-providers-heading"
        className="font-display text-lg font-semibold tracking-tight text-fg"
      >
        {t('heading')}
      </h2>
      <p className="text-sm text-fg-soft">
        {t('body')}
      </p>
      <ul className="flex flex-col gap-2 text-sm">
        {providers.map((p) => (
          <li
            key={p.id}
            className="flex flex-col gap-0.5 border-t border-fg/10 pt-2 first:border-t-0 first:pt-0"
          >
            <span className="font-medium text-fg">{p.name}</span>
            <span className="text-fg-soft">{p.excludedReason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
