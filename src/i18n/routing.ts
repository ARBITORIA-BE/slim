/**
 * next-intl 라우팅 설정 (ADR-0033 §T1 + §T2).
 *
 * locales: CLAUDE.md §5 확정 목록 그대로.
 * defaultLocale: nl-BE (베네룩스 1차 시장 — ADR-0009 BE ≥ 75%).
 * localePrefix: 'as-needed' — defaultLocale(nl-BE) URL prefix 없음.
 *   - 기존 URL 구조 보존 (ADR-0016 §T1 / ADR-0021 구조 보존).
 *   - 베타 사용자(한인)는 prefix 없이 접근 (기존 URL 그대로).
 *   - nl/fr/en 사용자는 /nl-NL/... /fr-BE/... /en/... prefix.
 *   - 공유 링크 결정성 보존 (ADR-0033 §T1 근거).
 *
 * ko: locale 목록 비포함 (ADR-0033 §T2).
 *   - ko는 베타 콘텐츠 언어 — messages/ko.json 운영하되
 *     defaultLocale(nl-BE) 메시지를 ko 내용으로 채움 (베타 단순화).
 *   - 런치(4.9)에서 nl-BE 실 콘텐츠로 교체 + messages/ko.json 제거.
 */

import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['nl-BE', 'nl-NL', 'fr-BE', 'fr-LU', 'en'],
  defaultLocale: 'nl-BE',
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];
