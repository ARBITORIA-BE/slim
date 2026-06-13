/**
 * stale — 상대 시간 포맷터 (PLAN 3.3 "마지막 확인: X시간 전").
 *
 * 순수 함수 — `now` 주입 가능해 vitest 단위 테스트 + RSC SSR 결정성 확보.
 *
 * P3 (ADR-0050 §D4 + ADR-0033 §T5 S2): locale 인자 추가.
 *   - 기존: 한국어 하드코딩 → 영어 페이지에서 "1시간 전" 한국어 잔존 원인.
 *   - 변경: locale(ko/en/nl/fr) → `Intl.RelativeTimeFormat` 위임.
 *   - 하위 호환: locale 기본값 = 'ko' (기존 호출자 무변경).
 *
 * 경계 (Intl.RelativeTimeFormat 위임):
 *   - < 1분  → unit=second, value=-59 (approximately "지금")
 *   - < 60분 → unit=minute
 *   - < 24h  → unit=hour
 *   - < 30일 → unit=day
 *   - ≥ 30일 → unit=day, value=-30 (≥30일 보수 표시)
 *
 * 음수 diff (target 이 미래) → unit=second, value=0 보수 처리.
 */

/**
 * 4 locale 지원 (ADR-0033 §T5 S2 정합).
 * 'ko' | 'en' | 'nl' | 'fr' — 그 외 locale 은 'en' fallback.
 */
export type RelativeTimeLocale = 'ko' | 'en' | 'nl' | 'fr';

/**
 * formatRelativeTime — 상대 시간 문자열.
 *
 * @param target  비교 기준 시각 (과거)
 * @param now     현재 시각 (테스트 주입용, 기본=new Date())
 * @param locale  출력 locale (기본='ko', 하위 호환)
 */
export function formatRelativeTime(
  target: Date,
  now: Date = new Date(),
  locale: RelativeTimeLocale = 'ko',
): string {
  const diffMs = now.getTime() - target.getTime();

  // 음수 diff (미래 타임스탬프) → 보수 처리: "방금 전" / "just now"
  if (diffMs <= 0) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      0,
      'second',
    );
  }

  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (minutes < 1) {
    // < 1분: 초 단위 — numeric='auto' 에서 -59s 는 "59 seconds ago" 등
    return rtf.format(-Math.floor(diffMs / 1000), 'second');
  }
  if (minutes < 60) {
    return rtf.format(-minutes, 'minute');
  }
  if (hours < 24) {
    return rtf.format(-hours, 'hour');
  }
  if (days < 30) {
    return rtf.format(-days, 'day');
  }
  // ≥ 30일: -30일 보수 표시 (헌법 P3 정직성 — "30일 이상" 최대 표현)
  return rtf.format(-30, 'day');
}
