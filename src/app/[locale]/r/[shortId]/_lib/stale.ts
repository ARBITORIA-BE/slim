/**
 * stale — 상대 시간 포맷터 (PLAN 3.3 "마지막 확인: X시간 전").
 *
 * 순수 함수 — `now` 주입 가능해 vitest 단위 테스트 + RSC SSR 결정성 확보.
 *
 * 경계:
 *   - < 1분  → '방금 전'
 *   - < 60분 → 'X분 전'
 *   - < 24시간 → 'X시간 전'
 *   - < 30일  → 'X일 전'
 *   - ≥ 30일  → '30일 이상 전'
 *
 * 음수 diff (target 이 미래) → '방금 전' 보수 처리. 시스템 시간 오차 방어.
 */

export function formatRelativeTime(
  target: Date,
  now: Date = new Date(),
): string {
  const diffMs = now.getTime() - target.getTime();
  if (diffMs < 60_000) return '방금 전';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return '30일 이상 전';
}
