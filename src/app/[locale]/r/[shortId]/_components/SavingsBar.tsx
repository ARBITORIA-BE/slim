/**
 * SavingsBar — 정규화 절약 막대 (pre-attentive 발현, ADR-0050 §D6).
 *
 * 설계:
 *   - 단일 색상 `bg-accent-dark` 잠금 — 색상 다중화 전면 금지 (ADR-0050 §D6).
 *   - 1위 임의 하이라이트 / "추천" 라벨 금지 — 막대 길이 자체가 유일한 pre-attentive 채널.
 *   - aria-label: ICU placeholder "savings: +€{amount}/mo, {pct}% of best".
 *   - 절약 0 이하 = 막대 0% 표시 (음수 절약은 시각적으로 빈 막대).
 *
 * i18n: 호출자가 aria-label 문자열을 번역 후 전달 (RSC 트리 밖 사용 대비).
 */

// ─── Props ────────────────────────────────────────────────────────────────

export interface SavingsBarProps {
  /** 이 행의 절약액 (cents). 음수 허용 (= 현재보다 비쌈). */
  readonly savingCents: number;
  /** 비교 결과 내 최대 절약액 (cents). 정규화 기준. 0이면 막대 미표시. */
  readonly maxSavingCents: number;
  /** aria-label (번역된 문자열, 호출자가 ICU 치환 후 전달). */
  readonly ariaLabel: string;
  /** 표시 텍스트 (예: "+€5/mo"). 호출자가 formatEuro 후 전달. */
  readonly savingText: string;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────

export function SavingsBar({
  savingCents,
  maxSavingCents,
  ariaLabel,
  savingText,
}: SavingsBarProps) {
  // why: maxSavingCents=0 이거나 savingCents<=0 이면 막대 의미 없음 → 0%.
  const pct =
    maxSavingCents > 0 && savingCents > 0
      ? Math.min(100, Math.round((savingCents / maxSavingCents) * 100))
      : 0;

  return (
    <div className="flex flex-col gap-1" aria-label={ariaLabel}>
      {/* 막대 컨테이너 — 고정 높이로 visual rhythm 잠금 (ADR-0050 원칙 7). */}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-fg/10"
        aria-hidden="true"
      >
        <div
          // why: bg-accent-dark 단일 색상 잠금 — §D6 색상 다중화 0.
          className="h-full rounded-full bg-accent-dark transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* 절약 텍스트 — 막대 아래 작은 숫자. */}
      <span className="text-xs font-medium text-accent-dark">{savingText}</span>
    </div>
  );
}
