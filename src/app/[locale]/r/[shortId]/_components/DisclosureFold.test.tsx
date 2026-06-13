/**
 * DisclosureFold 단위 테스트 (ADR-0050 원칙 6 — extraneous load 외화).
 *
 * 검증 범위:
 *   1. <details> 요소 렌더 (HTML native)
 *   2. <summary> + summaryLabel 텍스트
 *   3. summaryAriaLabel 렌더 (접근성)
 *   4. children 펼침 본문 렌더
 *   5. 닫힌 상태 = open 속성 없음
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { DisclosureFold } from './DisclosureFold';

// ─── 1. <details> 요소 존재 ───────────────────────────────────────────────

describe('DisclosureFold — 구조', () => {
  it('<details> 요소 렌더', () => {
    const { container } = render(
      <DisclosureFold summaryLabel="공개" summaryAriaLabel="Proximus 수수료 정보">
        <span>본문</span>
      </DisclosureFold>,
    );
    expect(container.querySelector('details')).toBeInTheDocument();
  });

  it('<summary> 존재 + summaryLabel 텍스트', () => {
    render(
      <DisclosureFold summaryLabel="제휴 수수료 공개" summaryAriaLabel="test">
        <span>본문</span>
      </DisclosureFold>,
    );
    expect(screen.getByText('제휴 수수료 공개')).toBeInTheDocument();
  });
});

// ─── 2. 접근성 ───────────────────────────────────────────────────────────

describe('DisclosureFold — 접근성', () => {
  it('summaryAriaLabel 렌더', () => {
    render(
      <DisclosureFold
        summaryLabel="공개"
        summaryAriaLabel="Proximus 수수료 정보"
      >
        <span>본문</span>
      </DisclosureFold>,
    );
    expect(screen.getByLabelText('Proximus 수수료 정보')).toBeInTheDocument();
  });
});

// ─── 3. children 렌더 ────────────────────────────────────────────────────

describe('DisclosureFold — children', () => {
  it('children 본문 렌더', () => {
    render(
      <DisclosureFold summaryLabel="공개" summaryAriaLabel="test">
        <span>수수료 없음 본문</span>
      </DisclosureFold>,
    );
    expect(screen.getByText('수수료 없음 본문')).toBeInTheDocument();
  });
});

// ─── 4. 닫힌 상태 — open 속성 없음 ──────────────────────────────────────

describe('DisclosureFold — 초기 상태', () => {
  it('초기 렌더 시 open 속성 없음 (닫힘)', () => {
    const { container } = render(
      <DisclosureFold summaryLabel="공개" summaryAriaLabel="test">
        <span>본문</span>
      </DisclosureFold>,
    );
    const details = container.querySelector('details');
    expect(details).not.toHaveAttribute('open');
  });
});
