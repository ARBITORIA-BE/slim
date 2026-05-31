/**
 * alternates 헬퍼 — hreflang + canonical 생성 (PLAN 3.5.4, ADR-0034 D5).
 *
 * 왜 이 함수가 필요한가?
 *   next-intl localePrefix='as-needed' 에서 defaultLocale(nl-BE)은 URL prefix 없음,
 *   그 외 4 locale 은 /nl-NL/... /fr-BE/... /fr-LU/... /en/... prefix 있음.
 *   Google hreflang 사양은 "모든 locale 의 절대 URL + x-default" 를 요구한다.
 *   페이지별로 수동 하드코딩하면 locale 추가 시 누락 위험 → 단일 함수로 추출.
 *
 * 단일 출처: routing.locales / routing.defaultLocale — 하드코딩 금지.
 * SITE_ORIGIN — src/lib/site.ts 에서 import (ADR-0020 §결정 7).
 *
 * ADR 근거: ADR-0034 D5, ADR-0033 §T1/§T2.
 */

import { SITE_ORIGIN } from '@/lib/site';
import { routing } from '@/i18n/routing';

/**
 * 주어진 경로(locale-prefix 제외, 예: '/compare')에 대해
 * 5 locale alternates.languages + canonical + x-default 를 도출한다.
 *
 * @param currentLocale - 현재 페이지의 locale (예: 'nl-BE', 'fr-BE')
 * @param pathSuffix    - locale prefix 없는 경로 (예: '/', '/compare', '/legal/terms')
 */
export function buildAlternates(
  currentLocale: string,
  pathSuffix: string,
): {
  canonical: string;
  languages: Record<string, string>;
} {
  // 경로 앞 슬래시 정규화 — '/' 로 시작 보장
  const suffix = pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`;

  /**
   * locale → 절대 URL 변환.
   * 왜 defaultLocale 만 prefix 없는가?
   *   localePrefix='as-needed' → defaultLocale URL 구조 보존 (ADR-0016 §T1).
   *   suffix === '/' 일 때 trailing slash 중복 방지 → '' 로 처리.
   */
  const url = (locale: string): string =>
    locale === routing.defaultLocale
      ? `${SITE_ORIGIN}${suffix === '/' ? '' : suffix}`
      : `${SITE_ORIGIN}/${locale}${suffix === '/' ? '' : suffix}`;

  // 5 locale 전부 포함 (routing.locales 단일 출처)
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = url(l);
  }
  // x-default = defaultLocale URL (Google 권장 — 지역/언어 미매칭 방문자 fallback)
  languages['x-default'] = url(routing.defaultLocale);

  return {
    canonical: url(currentLocale),
    languages,
  };
}
