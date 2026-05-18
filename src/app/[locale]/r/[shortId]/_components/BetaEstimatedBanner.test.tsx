/**
 * BetaEstimatedBanner 단위 테스트 (PLAN 1.5.6.1 DoD §4).
 *
 * 컴포넌트가 async RSC (4.5.j.4.A i18n 마이그레이션 후)이므로
 * 테스트는 await 로 JSX를 resolve 한 뒤 render 한다.
 * why: Vitest/JSDOM 환경에서 async server component는 await로 호출해야
 *      실제 JSX를 반환 — 직접 render(<AsyncComp />) 는 Promise를 렌더해 빈 DOM.
 *
 * next-intl/server mock: getTranslations 를 ko.json 메시지로 직접 주입.
 * why: next-intl server functions (getTranslations 등)은 Next.js request context
 *      없이는 JSDOM 환경에서 동작하지 않는다. vi.mock 으로 ko 메시지를 직접 주입.
 *
 * 검증:
 *   1. 제목 "베타 단계: 추정값" 렌더
 *   2. 본문 문구 렌더 (2026-05-09 수동 검증 추정값)
 *   3. 링크 "/data-sources" href
 *   4. role="status" a11y 속성
 *   5. 다크 패턴 자가 검사: 긴급성 표현("지금만", "마감") 0건
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// next-intl/server mock — JSDOM 환경에서 request context 없이 ko 메시지 주입
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    // 네임스페이스 경로를 점(.) 기준으로 분해해 ko.json 값 반환
    // 단순 구현: 'result.betaBanner' → betaBanner 키 반환
    const ko = {
      'result.betaBanner': {
        heading: '베타 단계: 추정값',
        body: '가격은 운영자가 2026-05-09에 수동 검증한 추정값입니다. 실시간 가격은 페이즈 5 이후 격상 예정.',
        link: '자세히: /data-sources',
      },
    };
    const messages = (ko as Record<string, Record<string, string>>)[namespace] ?? {};
    return (key: string) => messages[key] ?? key;
  },
  setRequestLocale: vi.fn(),
}));

import { BetaEstimatedBanner } from './BetaEstimatedBanner';

describe('BetaEstimatedBanner', () => {
  it('제목 "베타 단계: 추정값" 렌더', async () => {
    const jsx = await BetaEstimatedBanner();
    render(jsx);
    expect(
      screen.getByRole('heading', { level: 2 }),
    ).toHaveTextContent('베타 단계: 추정값');
  });

  it('본문 — 2026-05-09 수동 검증 추정값 문구 렌더', async () => {
    const jsx = await BetaEstimatedBanner();
    render(jsx);
    expect(
      screen.getByText(/2026-05-09에 수동 검증한 추정값/),
    ).toBeInTheDocument();
  });

  it('본문 — 페이즈 5 이후 격상 문구 렌더', async () => {
    const jsx = await BetaEstimatedBanner();
    render(jsx);
    expect(
      screen.getByText(/페이즈 5 이후 격상 예정/),
    ).toBeInTheDocument();
  });

  it('/data-sources 링크 존재 + href 정합 (discernible link name)', async () => {
    const jsx = await BetaEstimatedBanner();
    render(jsx);
    const link = screen.getByRole('link', { name: /자세히/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/data-sources');
  });

  it('role="status" a11y 속성 — 정보성 (긴급 X)', async () => {
    const jsx = await BetaEstimatedBanner();
    render(jsx);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('다크 패턴 자가 검사 — "지금만" 텍스트 0건', async () => {
    const jsx = await BetaEstimatedBanner();
    const { container } = render(jsx);
    expect(container.textContent).not.toMatch(/지금만/);
  });

  it('다크 패턴 자가 검사 — "마감" 텍스트 0건', async () => {
    const jsx = await BetaEstimatedBanner();
    const { container } = render(jsx);
    expect(container.textContent).not.toMatch(/마감/);
  });
});
