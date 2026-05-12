/**
 * 사이트 전역 상수 — 단일 진실 원천.
 *
 * 왜 이 파일이 필요한가?
 *   /r/[shortId]/page.tsx 에 `SITE_ORIGIN = 'https://slim.lu'` 가 하드코딩돼 있었고,
 *   3.5.2.a 에서 layout.tsx 의 metadataBase 에도 같은 도메인이 필요해졌다.
 *   두 곳이 각자 문자열을 갖는 순간 도메인 변경 시 누락 위험 → 한 곳으로 추출.
 *
 * ADR 근거: ADR-0020 §결정 7 / ADR-0021 §T8 (도메인 slim.lu 결정).
 */

export const SITE_ORIGIN = 'https://slim.lu';
