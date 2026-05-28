/**
 * PriceWithSource 단위 테스트.
 *
 * 컴포넌트가 'use client' + useTranslations / useLocale 을 사용하므로
 * next-intl 을 vi.mock 으로 교체한다.
 *
 * 왜 vi.mock('next-intl') 인가?
 *   next-intl 의 useTranslations / useLocale 은 IntlProvider 컨텍스트가
 *   필요하다. JSDOM 테스트 환경에는 Provider 없음 → 훅이 throw.
 *   AffiliateDisclosureLine.test.tsx 의 vi.mock('next-intl/server') 패턴과
 *   동일한 접근 방식 — client 훅은 'next-intl' 을 mock.
 *
 * 검증 범위:
 *   1. EUR 포맷 (/42,50/ 포함)
 *   2. 원본 링크가 새 탭으로 열림 (target="_blank", rel="noreferrer")
 *   3. t('viewSource') 산출값 ("View source" — mock 반환) 이 링크 텍스트로 표시
 *   4. confidence prop 이 data-confidence 속성으로 전달
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// next-intl client 훅 mock — ko.json dataDisplay 값 주입
vi.mock('next-intl', () => ({
  useLocale: () => 'nl-BE',
  useTranslations: (namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      dataDisplay: {
        viewSource: 'View source',
        staleData: '{relative} (stale data)',
      },
    };
    const ns = messages[namespace] ?? {};
    // ICU {variable} 간단 보간
    return (key: string, vars?: Record<string, string>) => {
      let text = ns[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
        }
      }
      return text;
    };
  },
}));

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

  it('링크 텍스트가 t("viewSource") 산출값을 표시한다', () => {
    render(
      <PriceWithSource
        amount={10}
        currency="EUR"
        fetchedAt={new Date().toISOString()}
        sourceUrl="https://engie.be"
        confidence="high"
      />,
    );
    // mock 에서 'View source' 반환
    expect(screen.getByRole('link')).toHaveTextContent('View source');
  });

  it('confidence prop 이 data-confidence 속성으로 전달된다', () => {
    render(
      <PriceWithSource
        amount={10}
        currency="EUR"
        fetchedAt={new Date().toISOString()}
        sourceUrl="https://engie.be"
        confidence="medium"
      />,
    );
    // 금액 표시 span 에 data-confidence 속성
    const priceSpan = screen.getByText(/10/).closest('[data-confidence]');
    expect(priceSpan).toHaveAttribute('data-confidence', 'medium');
  });
});
