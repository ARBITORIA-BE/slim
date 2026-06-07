/**
 * next-intl 라우팅 설정 (ADR-0033 §T1 + §T2 + Amd 6).
 *
 * locales: 5 → 3 통합 (ADR-0033 Amd 6 + ADR-0036 Amd 1, 2026-06-07).
 *   - nl  : 네덜란드어 (nl-BE + nl-NL 통합) — URL prefix 없음 (defaultLocale).
 *   - fr  : 프랑스어  (fr-BE + fr-LU 통합) — /fr/* prefix.
 *   - en  : 영어                             — /en/* prefix.
 * defaultLocale: 'nl' — 무프리픽스 슬롯 (기존 URL 구조 100% 보존).
 * localePrefix: 'as-needed' — defaultLocale(nl) URL prefix 없음.
 *   - 기존 URL 구조 보존 (ADR-0016 §T1 / ADR-0021 구조 보존).
 *   - fr 사용자는 /fr/* prefix, en 사용자는 /en/* prefix.
 *   - deprecated prefix (nl-BE/nl-NL/fr-BE/fr-LU) → middleware 301 redirect.
 *   - 공유 링크 결정성 보존 (ADR-0033 §T1 근거).
 *
 * ko: locale 목록 비포함 (ADR-0033 §T2).
 *   - request.ts G1-a 오버레이 쿠키가 ko 보호 담당 (미들웨어 레이어 아님).
 *   - messages/ko.json 유지 (4.15.d 트랙에서 delta 처리).
 */

import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['nl', 'fr', 'en'],
  defaultLocale: 'nl',
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];
