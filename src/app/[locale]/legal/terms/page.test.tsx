/**
 * /legal/terms 페이지 단위 테스트 (PLAN 4.12.a DoD).
 *
 * 검증 범위:
 *   1. 초안(draft) 알림 note 존재
 *   2. 어필리에이트 cross-ref 링크 존재 (/legal/affiliate-disclosure)
 *   3. 개인정보처리방침 cross-ref 링크 존재 (/legal/privacy)
 *   4. LEGAL_ENTITY legalName 렌더 (운영자 식별)
 *   5. LEGAL_ENTITY contactEmail 렌더 (mailto 링크)
 *   6. 다크패턴 자가 검사 — "지금만 / 오늘만 / 마감 / Hurry" 류 0건
 *   7. generateMetadata — pageTitle / canonical 정합
 *
 * mock 전략:
 *   - next-intl/server: getTranslations → 키 그대로 반환하는 spy
 *   - @/i18n/navigation: Link → next/link
 *   - @/lib/legal: LEGAL_ENTITY 상수 실값 사용 (mock 불필요)
 *
 * NOTE: RSC async 컴포넌트는 await 후 render.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ─── next-intl/server mock ──────────────────────────────────────────────────
// getTranslations: 키를 그대로 반환 (i18n 실값 로딩 없이 구조만 검증)
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockImplementation(
    async ({ namespace }: { namespace: string }) => {
      return (key: string) => `${namespace}.${key}`;
    },
  ),
  setRequestLocale: vi.fn(),
}));

// ─── @/i18n/navigation mock ─────────────────────────────────────────────────
vi.mock('@/i18n/navigation', () => ({
  Link: require('next/link').default,
}));

// page.tsx 는 mock 이후에 import 해야 mock 된 모듈을 사용
import TermsPage from './page';
import { generateMetadata } from './page';

// ─── 헬퍼 ──────────────────────────────────────────────────────────────────

/**
 * RSC async 컴포넌트를 렌더하기 위한 헬퍼.
 * params Promise 를 생성해 전달한다.
 */
async function renderTermsPage(locale = 'ko') {
  const element = await TermsPage({
    params: Promise.resolve({ locale }),
  });
  return render(element);
}

// ─── 1. draft 알림 note ─────────────────────────────────────────────────────

describe('TermsPage — draft 알림', () => {
  it('role="note" draft notice 존재', async () => {
    await renderTermsPage();
    const note = screen.getByRole('note', { name: /draft notice/ });
    expect(note).toBeInTheDocument();
    // 내용이 namespace.key 형태로 렌더됨 (mock 반환값 검증)
    expect(note.textContent).toContain('legal.terms.draftNotice');
  });
});

// ─── 2. 어필리에이트 cross-ref 링크 ─────────────────────────────────────────

describe('TermsPage — 어필리에이트 cross-ref', () => {
  it('/legal/affiliate-disclosure 링크 존재', async () => {
    await renderTermsPage();
    const link = screen.getByRole('link', {
      name: /legal\.terms\.affiliateLinkText/,
    });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/legal/affiliate-disclosure');
  });
});

// ─── 3. 개인정보처리방침 cross-ref 링크 ─────────────────────────────────────

describe('TermsPage — 개인정보처리방침 cross-ref', () => {
  it('/legal/privacy 링크 존재', async () => {
    await renderTermsPage();
    const link = screen.getByRole('link', {
      name: /legal\.terms\.privacyLinkText/,
    });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/legal/privacy');
  });
});

// ─── 4. LEGAL_ENTITY legalName 렌더 ─────────────────────────────────────────

describe('TermsPage — 운영자 식별', () => {
  it('LEGAL_ENTITY.legalName "Kim Wonmin" 렌더', async () => {
    await renderTermsPage();
    expect(screen.getByText('Kim Wonmin')).toBeInTheDocument();
  });
});

// ─── 5. LEGAL_ENTITY contactEmail 렌더 ──────────────────────────────────────

describe('TermsPage — contactEmail 링크', () => {
  it('mailto:kim.wonmin91@gmail.com 링크 존재', async () => {
    await renderTermsPage();
    const mailtoLink = screen.getByRole('link', {
      name: /kim\.wonmin91@gmail\.com/,
    });
    expect(mailtoLink).toHaveAttribute('href', 'mailto:kim.wonmin91@gmail.com');
  });
});

// ─── 6. 다크패턴 자가 검사 ──────────────────────────────────────────────────

describe('TermsPage — 다크패턴 부재', () => {
  const DARK_PATTERNS = ['지금만', '오늘만', '마감', 'Hurry', 'Limited', '마지막'];

  beforeEach(async () => {
    await renderTermsPage();
  });

  it.each(DARK_PATTERNS)('다크패턴 문구 "%s" 없음', (pattern) => {
    expect(document.body.textContent).not.toContain(pattern);
  });
});

// ─── 7. generateMetadata ─────────────────────────────────────────────────────

describe('generateMetadata', () => {
  it('pageTitle 과 canonical /legal/terms 반환', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ locale: 'en' }),
    });
    // mock: 'legal.terms.pageTitle'
    expect(meta.title).toBe('legal.terms.pageTitle');
    expect(meta.alternates?.canonical).toBe('/legal/terms');
  });
});
