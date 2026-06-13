/**
 * FreshnessRibbon 단위 테스트 — PLAN 4.21 (ADR-0050 §D4).
 *
 * FreshnessRibbon 자체는 RSC async 컴포넌트 (next-intl getLocale/getTranslations 의존).
 * 직접 렌더 테스트 대신 formatRelativeTime + URL 파싱 로직을 단위 테스트.
 *
 * 검증:
 *   1. hostname 추출 로직 (URL 파싱)
 *   2. locale-aware 상대 시간 (formatRelativeTime 위임 — stale.test.ts 에서 충분)
 *   3. 잘못된 URL 방어 처리
 */

import { describe, expect, it } from 'vitest';

import { formatRelativeTime } from '../_lib/stale';

const NOW = new Date('2026-06-13T12:00:00Z');

// ─── hostname 추출 로직 (FreshnessRibbon 내부 동일 패턴) ─────────────────

function extractHostname(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname;
  } catch {
    return sourceUrl.slice(0, 30);
  }
}

describe('FreshnessRibbon — hostname 추출', () => {
  it('유효한 URL → hostname', () => {
    expect(extractHostname('https://www.proximus.be/tariffs')).toBe('www.proximus.be');
    expect(extractHostname('https://shop.orange.be/mobile/plans')).toBe('shop.orange.be');
  });

  it('잘못된 URL → 30자 slice 방어', () => {
    const bad = 'not-a-valid-url-at-all-12345678901234567890';
    expect(extractHostname(bad)).toBe(bad.slice(0, 30));
  });

  it('빈 문자열 → 빈 슬라이스', () => {
    expect(extractHostname('')).toBe('');
  });
});

// ─── locale-aware 신선도 시간 ─────────────────────────────────────────────

describe('FreshnessRibbon — locale-aware 신선도 시간', () => {
  const FETCHED_5MIN_AGO = new Date('2026-06-13T11:55:00Z');

  it('ko: 5분 전', () => {
    const result = formatRelativeTime(FETCHED_5MIN_AGO, NOW, 'ko');
    expect(result).toBe('5분 전');
  });

  it('en: 5 minutes ago', () => {
    const result = formatRelativeTime(FETCHED_5MIN_AGO, NOW, 'en');
    expect(result).toBe('5 minutes ago');
  });

  it('nl: 5 minuten geleden', () => {
    const result = formatRelativeTime(FETCHED_5MIN_AGO, NOW, 'nl');
    expect(result).toBe('5 minuten geleden');
  });

  it('fr: il y a 5 minutes', () => {
    const result = formatRelativeTime(FETCHED_5MIN_AGO, NOW, 'fr');
    expect(result).toBe('il y a 5 minutes');
  });
});

// ─── source_url + fetched_at 정합 (헌법 P1) ──────────────────────────────

describe('FreshnessRibbon — 헌법 P1 정합', () => {
  it('sourceUrl 이 빈 문자열이 아닌 경우 hostname 비어있지 않음', () => {
    const url = 'https://www.telenet.be/nl/mobile';
    expect(extractHostname(url)).toBeTruthy();
  });

  it('fetchedAt 이 유효한 Date 이면 formatRelativeTime 은 문자열 반환', () => {
    const fetchedAt = new Date('2026-06-13T10:00:00Z');
    const result = formatRelativeTime(fetchedAt, NOW, 'en');
    expect(typeof result).toBe('string');
    expect(result).toBe('2 hours ago');
  });
});
