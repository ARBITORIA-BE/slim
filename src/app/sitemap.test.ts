/**
 * app/sitemap.ts 단위 테스트 (PLAN 3.5.4 DoD #2).
 *
 * 검증 범위:
 *   1. 8 경로 × 5 locale = 40 hreflang entry (alternates.languages)
 *   2. 색인 금지 URL (/r/...) 미포함
 *   3. 홈(/) priority = 1.0
 *   4. legal/data-sources priority = 0.5
 *   5. compare priority = 0.8
 *   6. nl-BE(defaultLocale) entry URL 에 locale prefix 없음
 *   7. nl-NL entry URL 에 /nl-NL prefix 있음
 *   8. /legal/terms + /legal/privacy 포함 (PLAN 4.12.a/b)
 *   9. 각 entry 의 alternates.languages 에 5 locale 전부 있음
 */

import { describe, expect, it } from 'vitest';
import sitemap from './sitemap';
import { routing } from '@/i18n/routing';
import { SITE_ORIGIN } from '@/lib/site';

const entries = sitemap();

describe('sitemap — entry 수', () => {
  it('8 경로 entry 반환', () => {
    // INDEXABLE_PATHS 배열 크기 = 8
    expect(entries).toHaveLength(8);
  });
});

describe('sitemap — 색인 금지 URL 미포함', () => {
  it('/r/ 패턴 URL 없음 (ADR-0021 §T8)', () => {
    const hasShortId = entries.some((e) => e.url.includes('/r/'));
    expect(hasShortId).toBe(false);
  });
});

describe('sitemap — 홈 entry', () => {
  const homeEntry = entries.find((e) => e.url === SITE_ORIGIN);

  it('홈 entry 존재', () => {
    expect(homeEntry).toBeDefined();
  });

  it('priority = 1.0', () => {
    expect(homeEntry?.priority).toBe(1.0);
  });

  it('alternates.languages 에 5 locale 전부 포함', () => {
    const langs = homeEntry?.alternates?.languages ?? {};
    for (const l of routing.locales) {
      expect(langs).toHaveProperty(l);
    }
  });

  it('nl-BE 홈 URL = SITE_ORIGIN (prefix 없음)', () => {
    const langs = homeEntry?.alternates?.languages ?? {};
    expect(langs['nl-BE']).toBe(SITE_ORIGIN);
  });

  it('nl-NL 홈 URL = SITE_ORIGIN/nl-NL', () => {
    const langs = homeEntry?.alternates?.languages ?? {};
    expect(langs['nl-NL']).toBe(`${SITE_ORIGIN}/nl-NL`);
  });
});

describe('sitemap — legal/data-sources priority', () => {
  it('/legal/affiliate-disclosure priority = 0.5', () => {
    const e = entries.find((e) => e.url.includes('/legal/affiliate-disclosure'));
    expect(e?.priority).toBe(0.5);
  });

  it('/data-sources priority = 0.5', () => {
    const e = entries.find((e) => e.url.includes('/data-sources'));
    expect(e?.priority).toBe(0.5);
  });

  it('/legal/terms priority = 0.5', () => {
    const e = entries.find((e) => e.url.includes('/legal/terms'));
    expect(e?.priority).toBe(0.5);
  });

  it('/legal/privacy priority = 0.5', () => {
    const e = entries.find((e) => e.url.includes('/legal/privacy'));
    expect(e?.priority).toBe(0.5);
  });
});

describe('sitemap — compare priority', () => {
  it('/compare priority = 0.8', () => {
    const e = entries.find((e) => e.url === `${SITE_ORIGIN}/compare`);
    expect(e?.priority).toBe(0.8);
  });

  it('/compare/mobile priority = 0.8', () => {
    const e = entries.find((e) => e.url.includes('/compare/mobile'));
    expect(e?.priority).toBe(0.8);
  });
});

describe('sitemap — PLAN 4.12 페이지 포함', () => {
  it('/legal/terms entry 존재', () => {
    const e = entries.find((e) => e.url.includes('/legal/terms'));
    expect(e).toBeDefined();
  });

  it('/legal/privacy entry 존재', () => {
    const e = entries.find((e) => e.url.includes('/legal/privacy'));
    expect(e).toBeDefined();
  });
});

describe('sitemap — 5 locale × 8 경로 매트릭스', () => {
  it('모든 entry 가 5 locale alternates.languages 를 가짐', () => {
    for (const entry of entries) {
      const langs = entry.alternates?.languages ?? {};
      expect(Object.keys(langs)).toHaveLength(routing.locales.length);
    }
  });

  it('nl-NL 경로에 /nl-NL prefix 있음 (홈 제외)', () => {
    const compareEntry = entries.find((e) => e.url === `${SITE_ORIGIN}/compare`);
    const langs = compareEntry?.alternates?.languages ?? {};
    expect(langs['nl-NL']).toBe(`${SITE_ORIGIN}/nl-NL/compare`);
  });

  it('fr-BE 경로에 /fr-BE prefix 있음', () => {
    const compareEntry = entries.find((e) => e.url === `${SITE_ORIGIN}/compare`);
    const langs = compareEntry?.alternates?.languages ?? {};
    expect(langs['fr-BE']).toBe(`${SITE_ORIGIN}/fr-BE/compare`);
  });
});
