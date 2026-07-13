/**
 * app/sitemap.ts 단위 테스트 (PLAN 3.5.4 DoD #2).
 *
 * [ADR-0033 Amd 6 + ADR-0036 Amd 1 갱신 — 5→3 locale 통합]:
 * [ADR-0051 §Amendment 1 갱신 — MDX 폐기, GUIDE_INDEX 정적 배열 통합]:
 *
 * 검증 범위:
 *   1. 8 정적 경로 + 가이드 인덱스 1 + 가이드 슬러그 N entries
 *   2. 색인 금지 URL (/r/...) 미포함
 *   3. 홈(/) priority = 1.0
 *   4. legal/data-sources priority = 0.5
 *   5. compare priority = 0.8
 *   6. nl(defaultLocale) entry URL 에 locale prefix 없음
 *   7. fr entry URL 에 /fr prefix 있음
 *   8. /legal/terms + /legal/privacy 포함 (PLAN 4.12.a/b)
 *   9. 각 entry 의 alternates.languages 에 3 locale 전부 있음
 *  10. /guides 인덱스 entry 존재 (ADR-0051 §D1)
 *  11. /guides/proximus-vs-telenet-vs-orange-be entry 존재 (ADR-0051 §D3 P1 스켈레톤)
 *
 * sitemap() 은 ADR-0051 §Amendment 1 이후 동기 함수 (GUIDE_INDEX 정적 배열
 * 소비 — fs.readdir 비동기 호출 제거). await 는 동기 반환값에도 안전하게
 * 적용되므로 호출부 변경 불필요.
 */

import { describe, expect, it } from 'vitest';
import sitemap from './sitemap';
import { routing } from '@/i18n/routing';
import { SITE_ORIGIN } from '@/lib/site';

const entries = sitemap();

describe('sitemap — 정적 8 경로 포함', () => {
  it('홈 / entry 존재', () => {
    const homeEntry = entries.find((e) => e.url === SITE_ORIGIN);
    expect(homeEntry).toBeDefined();
  });

  it('/compare entry 존재', () => {
    const e = entries.find((e) => e.url === `${SITE_ORIGIN}/compare`);
    expect(e).toBeDefined();
  });

  it('/compare/mobile entry 존재', () => {
    const e = entries.find((e) => e.url.includes('/compare/mobile'));
    expect(e).toBeDefined();
  });

  it('/compare/internet_fixed entry 존재', () => {
    const e = entries.find((e) => e.url.includes('/compare/internet_fixed'));
    expect(e).toBeDefined();
  });

  it('/data-sources entry 존재', () => {
    const e = entries.find((e) => e.url.includes('/data-sources'));
    expect(e).toBeDefined();
  });

  it('/legal/affiliate-disclosure entry 존재', () => {
    const e = entries.find((e) => e.url.includes('/legal/affiliate-disclosure'));
    expect(e).toBeDefined();
  });

  it('/legal/terms entry 존재 (PLAN 4.12.a)', () => {
    const e = entries.find((e) => e.url.includes('/legal/terms'));
    expect(e).toBeDefined();
  });

  it('/legal/privacy entry 존재 (PLAN 4.12.b)', () => {
    const e = entries.find((e) => e.url.includes('/legal/privacy'));
    expect(e).toBeDefined();
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

  it('alternates.languages 에 3 locale 전부 포함', () => {
    const langs = homeEntry?.alternates?.languages ?? {};
    for (const l of routing.locales) {
      expect(langs).toHaveProperty(l);
    }
  });

  it('nl 홈 URL = SITE_ORIGIN (prefix 없음 — defaultLocale)', () => {
    const langs = homeEntry?.alternates?.languages ?? {};
    expect(langs['nl']).toBe(SITE_ORIGIN);
  });

  it('fr 홈 URL = SITE_ORIGIN/fr', () => {
    const langs = homeEntry?.alternates?.languages ?? {};
    expect(langs['fr']).toBe(`${SITE_ORIGIN}/fr`);
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

describe('sitemap — 3 locale × 경로 매트릭스 (ADR-0033 Amd 6 5→3 통합)', () => {
  it('모든 entry 가 3 locale alternates.languages 를 가짐', () => {
    for (const entry of entries) {
      const langs = entry.alternates?.languages ?? {};
      expect(Object.keys(langs)).toHaveLength(routing.locales.length);
    }
  });

  it('fr 경로에 /fr prefix 있음 (홈 제외)', () => {
    const compareEntry = entries.find((e) => e.url === `${SITE_ORIGIN}/compare`);
    const langs = compareEntry?.alternates?.languages ?? {};
    expect(langs['fr']).toBe(`${SITE_ORIGIN}/fr/compare`);
  });

  it('en 경로에 /en prefix 있음', () => {
    const compareEntry = entries.find((e) => e.url === `${SITE_ORIGIN}/compare`);
    const langs = compareEntry?.alternates?.languages ?? {};
    expect(langs['en']).toBe(`${SITE_ORIGIN}/en/compare`);
  });
});

describe('sitemap — ADR-0051 §D1 가이드 통합', () => {
  it('/guides 인덱스 entry 존재', () => {
    const e = entries.find((e) => e.url === `${SITE_ORIGIN}/guides`);
    expect(e).toBeDefined();
  });

  it('/guides 인덱스 priority = 0.8', () => {
    const e = entries.find((e) => e.url === `${SITE_ORIGIN}/guides`);
    expect(e?.priority).toBe(0.8);
  });

  it('/guides/proximus-vs-telenet-vs-orange-be entry 존재 (P1 스켈레톤)', () => {
    const e = entries.find((e) =>
      e.url.includes('/guides/proximus-vs-telenet-vs-orange-be'),
    );
    expect(e).toBeDefined();
  });

  it('/guides/* entry 는 3 locale alternates 를 가짐', () => {
    const guideEntry = entries.find((e) =>
      e.url.includes('/guides/proximus-vs-telenet-vs-orange-be'),
    );
    const langs = guideEntry?.alternates?.languages ?? {};
    expect(Object.keys(langs)).toHaveLength(routing.locales.length);
  });

  it('/guides/proximus-vs-telenet-vs-orange-be priority = 0.7', () => {
    const e = entries.find((e) =>
      e.url.includes('/guides/proximus-vs-telenet-vs-orange-be'),
    );
    expect(e?.priority).toBe(0.7);
  });

  it('전체 entries 는 정적 8 + 가이드 인덱스 1 + 가이드 슬러그 N 이상', () => {
    // 최소 = 8 정적 + 1 가이드 인덱스 + 1 가이드 슬러그 = 10
    expect(entries.length).toBeGreaterThanOrEqual(10);
  });
});
