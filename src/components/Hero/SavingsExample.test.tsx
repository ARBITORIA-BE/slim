/**
 * SavingsExample 단위 테스트 (PLAN 4.13.c DoD, ADR-0041 D1 §블록 4).
 *
 * 검증:
 *   (1) savingsExamplePending 텍스트 렌더 (ADR-0029 §T2 정직성 토큰)
 *
 * Mock 전략:
 *   - next-intl/server: getTranslations mock
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const MOCK_PENDING = 'Voorbeeldbesparing — bèta-data wordt verzameld';

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => {
    const map: Record<string, string> = {
      savingsExamplePending: MOCK_PENDING,
    };
    return map[key] ?? key;
  }),
}));

import { SavingsExample } from './SavingsExample';

describe('SavingsExample', () => {
  it('savingsExamplePending 텍스트가 렌더됨 (ADR-0029 §T2 정직성 토큰)', async () => {
    const Component = await SavingsExample();
    render(Component);
    expect(screen.getByText(MOCK_PENDING)).toBeInTheDocument();
  });
});
