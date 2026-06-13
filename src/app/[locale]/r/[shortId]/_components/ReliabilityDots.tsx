/**
 * ReliabilityDots — 신뢰도 5점 도트 시각 (ADR-0050 §D2, §D6).
 *
 * 설계:
 *   - DB confidence enum (high/medium/low) → UI 5단 매핑.
 *   - 색상: 단일 `text-accent-dark` — §D6 색상 다중화 금지.
 *   - aria-label: "Reliability {n}/5 — {confidence}" (i18n, 호출자 전달).
 *   - `verified` / `stub` = DB enum에 없으므로 UI 확장 타입으로 보존
 *     (미래 fetcher 신뢰도 정밀화 대비).
 *
 * 5단 매핑:
 *   verified → 5/5 ●●●●●
 *   high     → 4/5 ●●●●○
 *   medium   → 3/5 ●●●○○
 *   low      → 2/5 ●●○○○
 *   stub     → 1/5 ●○○○○
 */

import type { Confidence } from '@/db/schema/tariff_snapshot';

// ─── UI 5단 타입 (DB 3단 + 미래 확장 2단) ────────────────────────────────

export type ReliabilityLevel = Confidence | 'verified' | 'stub';

// ─── Props ────────────────────────────────────────────────────────────────

export interface ReliabilityDotsProps {
  /** DB confidence (high/medium/low) 또는 UI 확장값. */
  readonly level: ReliabilityLevel;
  /** aria-label (번역된 문자열, 호출자가 ICU 치환 후 전달). */
  readonly ariaLabel: string;
}

// ─── 매핑 테이블 ──────────────────────────────────────────────────────────

const LEVEL_TO_SCORE: Record<ReliabilityLevel, number> = {
  verified: 5,
  high: 4,
  medium: 3,
  low: 2,
  stub: 1,
};

const TOTAL_DOTS = 5;

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────

export function ReliabilityDots({ level, ariaLabel }: ReliabilityDotsProps) {
  const score = LEVEL_TO_SCORE[level] ?? 3; // fallback = medium

  return (
    <span
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5"
    >
      {Array.from({ length: TOTAL_DOTS }, (_, i) => {
        const filled = i < score;
        return (
          <span
            key={i}
            aria-hidden="true"
            // why: 단일 text-accent-dark 잠금 — §D6 색상 다중화 0.
            //      빈 도트는 opacity 낮춤으로만 구분 (색상 변경 X).
            className={
              filled
                ? 'text-[10px] text-accent-dark'
                : 'text-[10px] text-fg/20'
            }
          >
            ●
          </span>
        );
      })}
    </span>
  );
}
