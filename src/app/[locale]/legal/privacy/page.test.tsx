/**
 * /legal/privacy 페이지 단위 테스트 (PLAN 4.12.b DoD).
 *
 * 검증 범위:
 *   1. 초안(draft) 알림 note 존재
 *   2. Art.13 §1(a) 컨트롤러 — LEGAL_ENTITY legalName 렌더
 *   3. Art.13 §1(a) 컨트롤러 — contactEmail mailto 링크 존재
 *   4. Art.13 섹션 헤딩 키 존재 (processingHeading, rightsHeading,
 *      supervisoryHeading, automatedDecisionHeading)
 *   5. contactHeading + contactEmail 연락처 렌더
 *   6. 다크패턴 자가 검사 — "지금만 / 오늘만 / 마감 / Hurry" 류 0건
 *   7. generateMetadata — pageTitle / canonical 정합
 *
 * mock 전략:
 *   - next-intl/server: getTranslations → 키 그대로 반환
 *   - @/i18n/navigation: Link → next/link
 *   - @/lib/legal: 실값 사용 (LEGAL_ENTITY)
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ─── next-intl/server mock ──────────────────────────────────────────────────
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

import PrivacyPage from './page';
import { generateMetadata } from './page';

// ─── 헬퍼 ──────────────────────────────────────────────────────────────────

async function renderPrivacyPage(locale = 'ko') {
  const element = await PrivacyPage({
    params: Promise.resolve({ locale }),
  });
  return render(element);
}

// ─── 1. draft 알림 note ─────────────────────────────────────────────────────

describe('PrivacyPage — draft 알림', () => {
  it('role="note" draft notice 존재', async () => {
    await renderPrivacyPage();
    const note = screen.getByRole('note', { name: /draft notice/ });
    expect(note).toBeInTheDocument();
    expect(note.textContent).toContain('legal.privacy.draftNotice');
  });
});

// ─── 2. Art.13 §1(a) 컨트롤러 legalName ─────────────────────────────────────

describe('PrivacyPage — 컨트롤러 신원', () => {
  it('LEGAL_ENTITY.legalName "Kim Wonmin" 렌더', async () => {
    await renderPrivacyPage();
    // legalName 은 여러 곳(terms, privacy 연락처 등)에 등장 가능 — 최소 1개 이상
    const elements = screen.getAllByText('Kim Wonmin');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── 3. Art.13 §1(a) contactEmail mailto 링크 ───────────────────────────────

describe('PrivacyPage — contactEmail 링크', () => {
  it('mailto:kim.wonmin91@gmail.com 링크 복수 존재 (컨트롤러 + 연락처)', async () => {
    await renderPrivacyPage();
    const mailtoLinks = screen.getAllByRole('link', {
      name: /kim\.wonmin91@gmail\.com/,
    });
    // 컨트롤러 섹션 + 연락처 섹션 = 2개 이상
    expect(mailtoLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of mailtoLinks) {
      expect(link).toHaveAttribute('href', 'mailto:kim.wonmin91@gmail.com');
    }
  });
});

// ─── 4. Art.13 섹션 헤딩 키 ─────────────────────────────────────────────────

describe('PrivacyPage — Art.13 섹션 헤딩', () => {
  const REQUIRED_SECTION_KEYS = [
    'legal.privacy.processingHeading',
    'legal.privacy.rightsHeading',
    'legal.privacy.supervisoryHeading',
    'legal.privacy.automatedDecisionHeading',
    'legal.privacy.controllerHeading',
    'legal.privacy.retentionHeading',
  ];

  it.each(REQUIRED_SECTION_KEYS)('섹션 헤딩 "%s" 존재', async (key) => {
    await renderPrivacyPage();
    // mock 이 키 그대로 반환하므로 textContent 에서 검색
    expect(document.body.textContent).toContain(key);
  });
});

// ─── 5. 연락처 섹션 ──────────────────────────────────────────────────────────

describe('PrivacyPage — 연락처', () => {
  it('contactHeading 섹션 존재', async () => {
    await renderPrivacyPage();
    expect(document.body.textContent).toContain('legal.privacy.contactHeading');
  });
});

// ─── 6. 다크패턴 자가 검사 ──────────────────────────────────────────────────

describe('PrivacyPage — 다크패턴 부재', () => {
  const DARK_PATTERNS = ['지금만', '오늘만', '마감', 'Hurry', 'Limited', '마지막'];

  beforeEach(async () => {
    await renderPrivacyPage();
  });

  it.each(DARK_PATTERNS)('다크패턴 문구 "%s" 없음', (pattern) => {
    expect(document.body.textContent).not.toContain(pattern);
  });
});

// ─── 7. generateMetadata ─────────────────────────────────────────────────────

describe('generateMetadata', () => {
  it('pageTitle 과 canonical 절대 URL 반환 (PLAN 3.5.4 hreflang 확장)', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ locale: 'en' }),
    });
    expect(meta.title).toBe('legal.privacy.pageTitle');
    // PLAN 3.5.4: buildAlternates 가 절대 URL 반환 — en locale prefix 포함
    expect(meta.alternates?.canonical).toBe('https://slim.lu/en/legal/privacy');
    // hreflang languages 5 locale + x-default = 6개 포함 검증
    expect(Object.keys(meta.alternates?.languages ?? {})).toHaveLength(6);
  });
});
