/**
 * HeroHeader 단위 테스트 (PLAN 4.13.c DoD, ADR-0041 D1 §블록 1).
 *
 * 검증:
 *   (1) h1 요소에 headline 텍스트 렌더
 *   (2) subheading paragraph 렌더
 *
 * Mock 전략:
 *   - next-intl: getTranslations → 고정 문자열 반환 (RSC context 없이 테스트)
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const MOCK_HEADLINE = 'Benelux telecom comparison, in 5 minutes';
const MOCK_SUBHEADING = 'Compare Belgian mobile, internet, and bundle plans at official prices.';

// next-intl/server mock
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => {
    const map: Record<string, string> = {
      headline: MOCK_HEADLINE,
      subheading: MOCK_SUBHEADING,
    };
    return map[key] ?? key;
  }),
}));

import { HeroHeader } from './HeroHeader';

describe('HeroHeader', () => {
  it('h1 에 headline 텍스트가 렌더됨', async () => {
    const Component = await HeroHeader();
    render(Component);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(MOCK_HEADLINE);
  });

  it('subheading paragraph 가 렌더됨', async () => {
    const Component = await HeroHeader();
    render(Component);
    expect(screen.getByText(MOCK_SUBHEADING)).toBeInTheDocument();
  });
});
