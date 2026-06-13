/**
 * FreshnessRibbon — 개별 카드 상단 신선도 띠 (ADR-0050 §D4, 헌법 P1 정직성).
 *
 * 설계:
 *   - 각 ResultRowData 의 fetchedAt + sourceUrl 를 카드별로 표시.
 *   - "Price refreshed N min ago · source: {url}" 형식.
 *   - RSC — getTranslations + getLocale 사용.
 *   - locale-aware: formatRelativeTime(locale) 으로 4 locale 지원 (ADR-0033 §T5 S2).
 *   - 모바일 fold 1 노출 (ADR-0050 §D7): 항상 표시 (접힘 없음).
 *   - 얇은 띠: bg-bg-warm text-xs (디자인 토큰만 사용, 새 의존성 0).
 *   - 인쇄: 그대로 표시 (P1 투명성 — 데이터 신선도는 인쇄물에도 중요).
 *
 * i18n: getTranslations (RSC) — 'result.freshnessRibbon' 네임스페이스.
 *
 * 헌법 P1 정합: source_url + fetched_at 노출.
 */

import { getLocale, getTranslations } from 'next-intl/server';

import { formatRelativeTime, type RelativeTimeLocale } from '../_lib/stale';

// ─── Props ────────────────────────────────────────────────────────────────

export interface FreshnessRibbonProps {
  /** tariff_snapshot.fetched_at — 데이터 수집 시각. */
  readonly fetchedAt: Date;
  /** tariff_snapshot.source_url — 출처 URL (헌법 P1). */
  readonly sourceUrl: string;
  /** 현재 시각 (테스트 주입용, 기본=new Date()). */
  readonly now?: Date;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────

export async function FreshnessRibbon({
  fetchedAt,
  sourceUrl,
  now,
}: FreshnessRibbonProps) {
  // why: RSC 이므로 getTranslations + getLocale 사용.
  const [t, locale] = await Promise.all([
    getTranslations('result.freshnessRibbon'),
    getLocale(),
  ]);

  const ref = now ?? new Date();

  // why: locale → RelativeTimeLocale 좁힘.
  //      'ko'|'en'|'nl'|'fr' 외 locale(이론상 없음) → 'en' fallback.
  const safeLocale: RelativeTimeLocale =
    locale === 'ko' || locale === 'en' || locale === 'nl' || locale === 'fr'
      ? locale
      : 'en';

  const relativeTime = formatRelativeTime(fetchedAt, ref, safeLocale);

  // sourceUrl 표시: 도메인만 (최대 30자 + 생략) — 긴 URL 모바일 overflow 방지.
  let displaySource: string;
  try {
    displaySource = new URL(sourceUrl).hostname;
  } catch {
    // why: 잘못된 URL 이면 그대로 표시 (이론상 DB에 들어올 수 없지만 방어).
    displaySource = sourceUrl.slice(0, 30);
  }

  return (
    // why: bg-bg-warm 얇은 띠. rounded-t-2xl 상단만 둥글게 (카드 상단 정합).
    //      ADR-0050 §D7 — 모바일 fold 1 노출 잠금: 항상 표시.
    <div className="rounded-t-2xl bg-bg-warm px-4 py-1">
      <p className="flex flex-wrap items-center gap-x-1 text-[10px] text-fg-soft">
        <span>
          {t('refreshed', { time: relativeTime })}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {t('source')}:{' '}
          <a
            href={sourceUrl}
            target="_blank"
            rel="nofollow noopener"
            className="underline-offset-2 hover:underline"
          >
            {displaySource}
          </a>
        </span>
      </p>
    </div>
  );
}
