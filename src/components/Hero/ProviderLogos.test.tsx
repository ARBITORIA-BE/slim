/**
 * ProviderLogos 단위 테스트 (PLAN 4.13.c DoD, ADR-0041 D1 §블록 3).
 *
 * 검증:
 *   (1) Proximus, Telenet, Orange BE 3사 텍스트 렌더
 *   (2) 헌법 P1 캡션 (Mordor 출처) 렌더
 *   (3) providersUpdatedAtLabel 렌더
 *
 * Mock 전략:
 *   - next-intl/server: getTranslations mock
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string, params?: Record<string, string>) => {
    const map: Record<string, string> = {
      providersCaption: 'Belgische top 3 telecoms met ≥ 97,5% marktaandeel (Mordor Intelligence Q1 2025)',
      providersUpdatedAtLabel: `Prijs bijgewerkt: ${params?.date ?? '2025-04-01'}`,
    };
    return map[key] ?? key;
  }),
}));

import { ProviderLogos } from './ProviderLogos';

describe('ProviderLogos', () => {
  it('Proximus, Telenet, Orange BE 3사가 텍스트로 렌더됨', async () => {
    const Component = await ProviderLogos();
    render(Component);
    expect(screen.getByText('Proximus')).toBeInTheDocument();
    expect(screen.getByText('Telenet')).toBeInTheDocument();
    expect(screen.getByText('Orange BE')).toBeInTheDocument();
  });

  it('Mordor 출처 캡션이 렌더됨', async () => {
    const Component = await ProviderLogos();
    render(Component);
    expect(screen.getByText(/mordor intelligence/i)).toBeInTheDocument();
  });

  it('가격 갱신 날짜 라벨이 렌더됨', async () => {
    const Component = await ProviderLogos();
    render(Component);
    expect(screen.getByText(/2025-04-01/i)).toBeInTheDocument();
  });
});
