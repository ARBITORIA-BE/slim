/**
 * SavingsBar 단위 테스트 (ADR-0050 §D2 §D6 정합).
 *
 * 검증 범위:
 *   1. maxSavingCents=0 → 막대 width 0% (나누기 0 안전)
 *   2. savingCents <= 0 → 막대 width 0%
 *   3. savingCents=maxSavingCents → 막대 100%
 *   4. 정규화 중간값 (50%) 계산 정합
 *   5. ariaLabel / savingText 렌더
 *   6. ADR-0050 §D6: bg-accent-dark 단일 색상 잠금 — 다중 bg 클래스 부재
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SavingsBar } from './SavingsBar';

// ─── 1. maxSavingCents=0 → 0% ────────────────────────────────────────────

describe('SavingsBar — maxSavingCents=0', () => {
  it('막대 width 0% (나누기 0 안전)', () => {
    const { container } = render(
      <SavingsBar
        savingCents={500}
        maxSavingCents={0}
        ariaLabel="test"
        savingText="+€5/mo"
      />,
    );
    const bar = container.querySelector('.bg-accent-dark');
    expect(bar).toHaveStyle({ width: '0%' });
  });
});

// ─── 2. savingCents <= 0 → 0% ────────────────────────────────────────────

describe('SavingsBar — savingCents <= 0', () => {
  it('savingCents=0 → 막대 0%', () => {
    const { container } = render(
      <SavingsBar
        savingCents={0}
        maxSavingCents={1000}
        ariaLabel="test"
        savingText="Same"
      />,
    );
    const bar = container.querySelector('.bg-accent-dark');
    expect(bar).toHaveStyle({ width: '0%' });
  });

  it('savingCents=-500 (음수) → 막대 0%', () => {
    const { container } = render(
      <SavingsBar
        savingCents={-500}
        maxSavingCents={1000}
        ariaLabel="test"
        savingText="-€5/mo"
      />,
    );
    const bar = container.querySelector('.bg-accent-dark');
    expect(bar).toHaveStyle({ width: '0%' });
  });
});

// ─── 3. savingCents=maxSavingCents → 100% ────────────────────────────────

describe('SavingsBar — 최대값', () => {
  it('savingCents=maxSavingCents → 100%', () => {
    const { container } = render(
      <SavingsBar
        savingCents={1000}
        maxSavingCents={1000}
        ariaLabel="test"
        savingText="+€10/mo"
      />,
    );
    const bar = container.querySelector('.bg-accent-dark');
    expect(bar).toHaveStyle({ width: '100%' });
  });
});

// ─── 4. 정규화 중간값 50% ────────────────────────────────────────────────

describe('SavingsBar — 중간값', () => {
  it('savingCents=500, maxSavingCents=1000 → 50%', () => {
    const { container } = render(
      <SavingsBar
        savingCents={500}
        maxSavingCents={1000}
        ariaLabel="test"
        savingText="+€5/mo"
      />,
    );
    const bar = container.querySelector('.bg-accent-dark');
    expect(bar).toHaveStyle({ width: '50%' });
  });

  it('정규화 값은 100% 초과 불가 (안전 상한)', () => {
    const { container } = render(
      <SavingsBar
        savingCents={2000}
        maxSavingCents={1000}
        ariaLabel="test"
        savingText="+€20/mo"
      />,
    );
    const bar = container.querySelector('.bg-accent-dark');
    expect(bar).toHaveStyle({ width: '100%' });
  });
});

// ─── 5. ariaLabel / savingText 렌더 ──────────────────────────────────────

describe('SavingsBar — 접근성 + 텍스트', () => {
  it('ariaLabel 렌더', () => {
    render(
      <SavingsBar
        savingCents={500}
        maxSavingCents={1000}
        ariaLabel="절약액: +€5/mo, 50% of best"
        savingText="+€5/mo"
      />,
    );
    expect(screen.getByLabelText('절약액: +€5/mo, 50% of best')).toBeInTheDocument();
  });

  it('savingText 표시', () => {
    render(
      <SavingsBar
        savingCents={500}
        maxSavingCents={1000}
        ariaLabel="test"
        savingText="+€5/mo"
      />,
    );
    expect(screen.getByText('+€5/mo')).toBeInTheDocument();
  });
});

// ─── 6. §D6 단일 색상 잠금 ────────────────────────────────────────────────

describe('SavingsBar — ADR-0050 §D6 단일 색상 잠금', () => {
  it('막대 요소에 bg-accent-dark 클래스 1개만 존재', () => {
    const { container } = render(
      <SavingsBar
        savingCents={700}
        maxSavingCents={1000}
        ariaLabel="test"
        savingText="+€7/mo"
      />,
    );
    const bars = container.querySelectorAll('[class*="bg-"]');
    // bg-fg/10 (컨테이너) + bg-accent-dark (채움) = 2개. bg-red / bg-green 류 없음.
    const bgClasses = Array.from(bars).flatMap((el) =>
      Array.from(el.classList).filter((c) => c.startsWith('bg-')),
    );
    const hasMultipleColors = bgClasses.some(
      (c) => c !== 'bg-fg/10' && c !== 'bg-accent-dark',
    );
    expect(hasMultipleColors).toBe(false);
  });
});
