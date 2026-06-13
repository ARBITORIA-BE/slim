/**
 * ReliabilityDots 단위 테스트 (ADR-0050 §D2 §D6 정합).
 *
 * 검증 범위:
 *   1. high → 4개 filled, 1개 empty
 *   2. medium → 3개 filled, 2개 empty
 *   3. low → 2개 filled, 3개 empty
 *   4. verified → 5개 filled (UI 확장)
 *   5. stub → 1개 filled, 4개 empty (UI 확장)
 *   6. ariaLabel 렌더 (접근성)
 *   7. ADR-0050 §D6: 색상 다중화 없음 — text-accent-dark 단일 잠금
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ReliabilityDots } from './ReliabilityDots';
import type { ReliabilityLevel } from './ReliabilityDots';

// ─── helper ───────────────────────────────────────────────────────────────

function countFilledDots(container: HTMLElement): number {
  return container.querySelectorAll('.text-accent-dark').length;
}

function countEmptyDots(container: HTMLElement): number {
  return container.querySelectorAll('.text-fg\\/20').length;
}

// ─── 1~5. 5단 매핑 정합 ───────────────────────────────────────────────────

const LEVEL_CASES: Array<[ReliabilityLevel, number, number]> = [
  ['verified', 5, 0],
  ['high', 4, 1],
  ['medium', 3, 2],
  ['low', 2, 3],
  ['stub', 1, 4],
];

describe('ReliabilityDots — 5단 매핑', () => {
  it.each(LEVEL_CASES)(
    'level=%s → filled=%d, empty=%d',
    (level, filled, empty) => {
      const { container } = render(
        <ReliabilityDots level={level} ariaLabel="test" />,
      );
      expect(countFilledDots(container)).toBe(filled);
      expect(countEmptyDots(container)).toBe(empty);
    },
  );
});

// ─── 6. 총 도트 수 = 5 ────────────────────────────────────────────────────

describe('ReliabilityDots — 도트 총 5개', () => {
  it.each(LEVEL_CASES as Array<[ReliabilityLevel, number, number]>)(
    'level=%s → 총 5개 도트',
    (level) => {
      const { container } = render(
        <ReliabilityDots level={level} ariaLabel="test" />,
      );
      const total = countFilledDots(container) + countEmptyDots(container);
      expect(total).toBe(5);
    },
  );
});

// ─── 7. ariaLabel 렌더 ────────────────────────────────────────────────────

describe('ReliabilityDots — 접근성', () => {
  it('ariaLabel 렌더', () => {
    render(
      <ReliabilityDots
        level="high"
        ariaLabel="신뢰도 4/5 — 높음"
      />,
    );
    expect(screen.getByLabelText('신뢰도 4/5 — 높음')).toBeInTheDocument();
  });
});

// ─── 8. §D6 단일 색상 잠금 ────────────────────────────────────────────────

describe('ReliabilityDots — ADR-0050 §D6 단일 색상 잠금', () => {
  it('채움 도트는 text-accent-dark만 사용', () => {
    const { container } = render(
      <ReliabilityDots level="high" ariaLabel="test" />,
    );
    // 채움 도트 (aria-hidden 스팬)에 text-red / text-green 류 없음
    const spans = container.querySelectorAll('span[aria-hidden="true"]');
    spans.forEach((span) => {
      const classes = Array.from(span.classList);
      const hasInvalidColor = classes.some(
        (c) => c.startsWith('text-') && c !== 'text-accent-dark' && c !== 'text-fg/20' && c !== 'text-[10px]',
      );
      expect(hasInvalidColor).toBe(false);
    });
  });
});
