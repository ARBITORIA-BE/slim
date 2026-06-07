/**
 * alternates 헬퍼 단위 테스트 (PLAN 3.5.4 DoD #1).
 *
 * [ADR-0033 Amd 6 + ADR-0036 Amd 1 갱신 — 5→3 locale 통합]:
 *
 * 검증 범위:
 *   1. pathSuffix '/' — 홈 URL (trailing slash 중복 없음)
 *   2. pathSuffix '/compare' — 일반 경로
 *   3. pathSuffix '/legal/affiliate-disclosure' — 깊은 경로
 *   4. 3 locale 전부 포함 (routing.locales 기반)
 *   5. x-default = defaultLocale(nl) URL
 *   6. defaultLocale(nl) 은 prefix 없음
 *   7. 비 defaultLocale 은 locale prefix 있음
 *   8. canonical = currentLocale URL
 *   9. pathSuffix 앞 슬래시 없어도 정규화됨
 */

import { describe, expect, it } from 'vitest';
import { buildAlternates } from './alternates';
import { routing } from '@/i18n/routing';
import { SITE_ORIGIN } from '@/lib/site';

// 단일 출처 검증용 상수
const DEFAULT_LOCALE = routing.defaultLocale; // 'nl'
const ALL_LOCALES = routing.locales;           // ['nl', 'fr', 'en']

describe('buildAlternates — pathSuffix "/"', () => {
  const result = buildAlternates(DEFAULT_LOCALE, '/');

  it('canonical = SITE_ORIGIN (trailing slash 없음)', () => {
    expect(result.canonical).toBe(SITE_ORIGIN);
  });

  it('x-default = SITE_ORIGIN (trailing slash 없음)', () => {
    expect(result.languages['x-default']).toBe(SITE_ORIGIN);
  });

  it('3 locale + x-default 포함 (총 4 키) (ADR-0033 Amd 6 5→3 통합)', () => {
    const keys = Object.keys(result.languages);
    expect(keys).toHaveLength(ALL_LOCALES.length + 1); // +1 for x-default
  });

  it('nl URL 에 prefix 없음 (defaultLocale)', () => {
    expect(result.languages['nl']).toBe(SITE_ORIGIN);
  });

  it('fr URL 에 /fr prefix 있음', () => {
    expect(result.languages['fr']).toBe(`${SITE_ORIGIN}/fr`);
  });

  it('en URL 에 /en prefix 있음', () => {
    expect(result.languages['en']).toBe(`${SITE_ORIGIN}/en`);
  });

  it('routing.locales 전부 languages 에 포함', () => {
    for (const l of ALL_LOCALES) {
      expect(result.languages).toHaveProperty(l);
    }
  });
});

describe('buildAlternates — pathSuffix "/compare"', () => {
  const result = buildAlternates('fr', '/compare');

  it('canonical = fr prefix + /compare', () => {
    expect(result.canonical).toBe(`${SITE_ORIGIN}/fr/compare`);
  });

  it('nl URL = SITE_ORIGIN/compare (prefix 없음)', () => {
    expect(result.languages['nl']).toBe(`${SITE_ORIGIN}/compare`);
  });

  it('x-default = nl URL', () => {
    expect(result.languages['x-default']).toBe(result.languages[DEFAULT_LOCALE]);
  });

  it('3 locale 전부 포함', () => {
    for (const l of ALL_LOCALES) {
      expect(result.languages).toHaveProperty(l);
    }
  });
});

describe('buildAlternates — pathSuffix "/legal/affiliate-disclosure"', () => {
  const result = buildAlternates('en', '/legal/affiliate-disclosure');

  it('canonical = en prefix + /legal/affiliate-disclosure', () => {
    expect(result.canonical).toBe(`${SITE_ORIGIN}/en/legal/affiliate-disclosure`);
  });

  it('nl URL = SITE_ORIGIN/legal/affiliate-disclosure (prefix 없음)', () => {
    expect(result.languages['nl']).toBe(
      `${SITE_ORIGIN}/legal/affiliate-disclosure`,
    );
  });

  it('x-default = defaultLocale(nl) URL', () => {
    expect(result.languages['x-default']).toBe(result.languages[DEFAULT_LOCALE]);
  });
});

describe('buildAlternates — pathSuffix 앞 슬래시 생략 허용', () => {
  it('"compare" 와 "/compare" 결과 동일', () => {
    const withSlash = buildAlternates('nl', '/compare');
    const withoutSlash = buildAlternates('nl', 'compare');
    expect(withSlash).toEqual(withoutSlash);
  });
});
