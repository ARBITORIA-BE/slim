interface Props { fetchedAt: string }

/**
 * 24h 이상 된 데이터에 자동으로 "X시간 전" 표시 (P1 — 신선도 강제).
 */
export function StaleLabel({ fetchedAt }: Props) {
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  const ageHours = Math.floor(ageMs / (1000 * 60 * 60));

  if (ageHours < 1) return <span className="text-xs text-muted">방금 전</span>;
  if (ageHours < 24) return <span className="text-xs text-muted">{ageHours}시간 전</span>;
  const ageDays = Math.floor(ageHours / 24);
  return <span className="text-xs text-amber-600">⚠️ {ageDays}일 전 데이터</span>;
}
