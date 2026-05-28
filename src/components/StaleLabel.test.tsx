/**
 * StaleLabel 단위 테스트.
 *
 * 컴포넌트가 'use client' + useTranslations / useLocale 을 사용하므로
 * next-intl 을 vi.mock 으로 교체한다.
 *
 * 왜 vi.mock('next-intl') 인가?
 *   useTranslations / useLocale 은 IntlProvider 컨텍스트 필요.
 *   JSDOM 환경에 Provider 없음 → PriceWithSource.test.tsx 와 동일 패턴 적용.
 *
 * 검증 범위:
 *   1. ageMinutes < 60 → text-xs text-muted 클래스, Intl.RelativeTimeFormat 산출
 *   2. 1h <= ageHours < 24 → text-xs text-muted, 시간 단위 산출
 *   3. ageDays >= 1 → text-xs text-amber-600 + ⚠️ + t('staleData') 보간 포함
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// next-intl client 훅 mock
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

import { StaleLabel } from './StaleLabel';

/** fetchedAt 생성 헬퍼 — 현재 시각에서 ms 만큼 과거 */
function msAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('StaleLabel', () => {
  it('30분 전 데이터 — text-muted 클래스, 분 단위 RTF 표시', () => {
    render(<StaleLabel fetchedAt={msAgo(30 * MIN)} />);
    const el = screen.getByText(/min|minut|ago|geleden|seit/i);
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('text-muted');
  });

  it('3시간 전 데이터 — text-muted 클래스, 시간 단위 RTF 표시', () => {
    render(<StaleLabel fetchedAt={msAgo(3 * HOUR)} />);
    // nl-BE 로케일: "3 uur geleden" 등 hour 관련 텍스트
    const el = screen.getByText(/uur|hour|heure|stund/i);
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('text-muted');
  });

  it('2일 전 데이터 — text-amber-600 + staleData ICU 보간 포함', () => {
    render(<StaleLabel fetchedAt={msAgo(2 * DAY)} />);
    // t('staleData', { relative: '...' }) 산출: "{relative} (stale data)"
    const el = screen.getByText(/stale data/i);
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('text-amber-600');
    // ⚠️ 이모지도 같은 span 에 포함
    expect(el.textContent).toMatch(/⚠️/);
  });
});
