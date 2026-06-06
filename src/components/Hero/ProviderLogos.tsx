/**
 * ProviderLogos — 블록 3: 공급사 텍스트 폴백 (ADR-0041 D1 §블록 3, Q3 옵션 C, PLAN 4.13.c).
 *
 * RSC. Q3 디폴트 A(공식 press kit 로고 시도)를 채택했으나 4.13.b legal 검수 미완 상태이므로
 * 텍스트 폴백(옵션 C) 1차 진입. 향후 별 PR에서 SVG 교체.
 *
 * 헌법 P1: 시장 점유율 데이터 = source (Mordor Intelligence Q1 2025) 명시.
 * WCAG AA: text-fg-soft (6.9:1 vs bg). 캡션 text-muted.
 */

import { getTranslations } from 'next-intl/server';

/** 벨기에 통신 3사 (ADR-0034 D4 Amendment 1 — Voo 흡수, 3사 final). */
const PROVIDERS = [
  { name: 'Proximus', slug: 'proximus' },
  { name: 'Telenet', slug: 'telenet' },
  { name: 'Orange BE', slug: 'orange-be' },
] as const;

/**
 * 데이터 신선도 표시용 날짜.
 * Mordor Q1 2025 시장 점유율 데이터 = 고정 출처. 페이지 빌드 시각 기준.
 * why: P1 fetched_at — 가격 데이터가 아닌 시장조사 인용이므로 고정 날짜 사용.
 */
const MORDOR_DATA_DATE = '2025-04-01';

export async function ProviderLogos() {
  // why: RSC 이므로 getTranslations 사용 (await 필요).
  const t = await getTranslations('home');

  const updatedLabel = t('providersUpdatedAtLabel', { date: MORDOR_DATA_DATE });

  return (
    <section
      aria-label="coverage-providers"
      className="flex flex-col items-center gap-3"
    >
      {/* 공급사 3사 텍스트 표시 (Q3 옵션 C 1차 — SVG 교체는 4.13.b 이후 별 PR) */}
      <div className="flex flex-wrap items-center justify-center gap-6">
        {PROVIDERS.map(({ name, slug }) => (
          <span
            key={slug}
            className="rounded-lg border border-fg/10 bg-bg-warm px-4 py-2 text-sm font-semibold text-fg"
            aria-label={name}
          >
            {name}
          </span>
        ))}
      </div>

      {/* 헌법 P1: 출처 + 신선도 명시 */}
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-xs text-fg-soft">
          {t('providersCaption')}
        </p>
        <p className="text-xs text-muted">
          {updatedLabel}
        </p>
      </div>
    </section>
  );
}
