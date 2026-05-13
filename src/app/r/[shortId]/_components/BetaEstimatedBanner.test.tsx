/**
 * BetaEstimatedBanner 단위 테스트 (PLAN 1.5.6.1 DoD §4).
 *
 * 검증:
 *   1. 제목 "베타 단계: 추정값" 렌더
 *   2. 본문 문구 렌더 (2026-05-09 수동 검증 추정값)
 *   3. 링크 "/data-sources" href
 *   4. role="status" a11y 속성
 *   5. 다크 패턴 자가 검사: 긴급성 표현("지금만", "마감") 0건
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { BetaEstimatedBanner } from './BetaEstimatedBanner';

describe('BetaEstimatedBanner', () => {
  it('제목 "베타 단계: 추정값" 렌더', () => {
    render(<BetaEstimatedBanner />);
    // h2 안에 텍스트 포함 (이모지 포함 가능)
    expect(
      screen.getByRole('heading', { level: 2 }),
    ).toHaveTextContent('베타 단계: 추정값');
  });

  it('본문 — 2026-05-09 수동 검증 추정값 문구 렌더', () => {
    render(<BetaEstimatedBanner />);
    expect(
      screen.getByText(/2026-05-09에 수동 검증한 추정값/),
    ).toBeInTheDocument();
  });

  it('본문 — 페이즈 5 이후 격상 문구 렌더', () => {
    render(<BetaEstimatedBanner />);
    expect(
      screen.getByText(/페이즈 5 이후 격상 예정/),
    ).toBeInTheDocument();
  });

  it('/data-sources 링크 존재 + href 정합 (discernible link name)', () => {
    render(<BetaEstimatedBanner />);
    const link = screen.getByRole('link', { name: /자세히/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/data-sources');
  });

  it('role="status" a11y 속성 — 정보성 (긴급 X)', () => {
    render(<BetaEstimatedBanner />);
    // role=status 요소 존재 확인
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('다크 패턴 자가 검사 — "지금만" 텍스트 0건', () => {
    const { container } = render(<BetaEstimatedBanner />);
    expect(container.textContent).not.toMatch(/지금만/);
  });

  it('다크 패턴 자가 검사 — "마감" 텍스트 0건', () => {
    const { container } = render(<BetaEstimatedBanner />);
    expect(container.textContent).not.toMatch(/마감/);
  });
});
