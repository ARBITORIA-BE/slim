import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriceWithSource } from './PriceWithSource';

describe('PriceWithSource', () => {
  it('가격을 EUR로 포맷팅한다', () => {
    render(
      <PriceWithSource
        amount={42.5}
        currency="EUR"
        fetchedAt={new Date().toISOString()}
        sourceUrl="https://example.com/tariff"
        confidence="high"
      />,
    );
    expect(screen.getByText(/42,50/)).toBeInTheDocument();
  });

  it('원본 링크가 새 탭으로 열린다', () => {
    render(
      <PriceWithSource
        amount={10}
        currency="EUR"
        fetchedAt={new Date().toISOString()}
        sourceUrl="https://engie.be"
        confidence="high"
      />,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });
});
