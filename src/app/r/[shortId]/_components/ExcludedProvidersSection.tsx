/**
 * ExcludedProvidersSection — 비교 제외 공급사 노출 (PLAN 3.4, ADR-0021 §T6).
 *
 * 헌법 §3 P3 + ADR-0011 §T2 항목 3 동형 — "비교에서 제외된 공급사도 이름 공개".
 * 같은 카테고리/국가의 `provider.excluded_reason IS NOT NULL` 행을 표시. UI 만
 * 다르고 데이터는 /data-sources 페이지와 동일.
 *
 * 0건 시 섹션 자체 비노출 (정보 noise 회피). 운영자가 excluded_reason 을 채우면
 * 자동으로 노출됨.
 *
 * Orange BE (`provider.excluded_reason = '페이즈 5 평가 후 추가 예정'`) 도 본 섹션
 * 에 자연 포함 — 마스터 데이터로 처리, 특수 분기 코드 0 (ADR-0009 §결정 1 정합).
 */

import type { ExcludedProvider } from '@/db/queries/providers';

export interface ExcludedProvidersSectionProps {
  readonly providers: readonly ExcludedProvider[];
}

export function ExcludedProvidersSection({
  providers,
}: ExcludedProvidersSectionProps) {
  if (providers.length === 0) return null;
  return (
    <section
      aria-labelledby="excluded-providers-heading"
      className="flex flex-col gap-3 rounded-2xl border border-fg/10 bg-bg p-6"
    >
      <h2
        id="excluded-providers-heading"
        className="font-display text-lg font-semibold tracking-tight text-fg"
      >
        비교에서 제외된 공급사
      </h2>
      <p className="text-sm text-fg-soft">
        아래 공급사는 본 비교에 포함되지 않았습니다. 사유는 마스터 데이터 그대로
        노출됩니다 (헌법 §3 P3). /data-sources 페이지에서 동일 데이터를 표 형식으로
        볼 수 있습니다.
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
