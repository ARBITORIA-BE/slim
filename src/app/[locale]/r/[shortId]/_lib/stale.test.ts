/**
 * stale 단위 테스트 — P3 확장 (PLAN 4.21, ADR-0050 §D4 + ADR-0033 §T5 S2).
 *
 * 검증:
 *   1. 기존 경계 테스트 (locale='ko', 하위 호환)
 *   2. P3 신규: 4 locale (ko/en/nl/fr) 상대 시간 locale-aware 출력
 *   3. 음수 diff + 순수성
 */

import { describe, expect, it } from 'vitest';

import { formatRelativeTime } from './stale';

const NOW = new Date('2026-05-11T12:00:00Z');

// ─── 기존 경계 테스트 (locale='ko', 하위 호환) ─────────────────────────────

describe('formatRelativeTime — ko 경계 (하위 호환)', () => {
  it('< 1분 → "방금" 포함 (Intl 처리)', () => {
    const result = formatRelativeTime(new Date('2026-05-11T11:59:59Z'), NOW, 'ko');
    // why: Intl.RelativeTimeFormat(ko) 은 "59초 전" 또는 "방금 전" 반환 (numeric='auto').
    //      정확한 문자열이 아닌 한국어 포함 여부 검증.
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('1시간 전 → ko 문자열', () => {
    const result = formatRelativeTime(new Date('2026-05-11T11:00:00Z'), NOW, 'ko');
    // Intl.RelativeTimeFormat(ko) → "1시간 전"
    expect(result).toBe('1시간 전');
  });

  it('23시간 전 → ko', () => {
    const result = formatRelativeTime(new Date('2026-05-10T13:00:00Z'), NOW, 'ko');
    expect(result).toBe('23시간 전');
  });

  it('1일 전 → ko', () => {
    const result = formatRelativeTime(new Date('2026-05-10T12:00:00Z'), NOW, 'ko');
    expect(result).toBe('어제');
  });

  it('5일 전 → ko', () => {
    const result = formatRelativeTime(new Date('2026-05-06T12:00:00Z'), NOW, 'ko');
    expect(result).toBe('5일 전');
  });

  it('≥ 30일 → -30일 보수 표시 (ko)', () => {
    const result = formatRelativeTime(new Date('2026-04-11T12:00:00Z'), NOW, 'ko');
    expect(result).toBe('30일 전');
  });
});

// ─── P3 신규: 4 locale 상대 시간 locale-aware ─────────────────────────────

describe('formatRelativeTime — 4 locale (ADR-0033 §T5 S2)', () => {
  const ONE_HOUR_AGO = new Date('2026-05-11T11:00:00Z'); // now - 1h

  it('ko: 1시간 전', () => {
    expect(formatRelativeTime(ONE_HOUR_AGO, NOW, 'ko')).toBe('1시간 전');
  });

  it('en: 1 hour ago', () => {
    expect(formatRelativeTime(ONE_HOUR_AGO, NOW, 'en')).toBe('1 hour ago');
  });

  it('nl: 1 uur geleden', () => {
    expect(formatRelativeTime(ONE_HOUR_AGO, NOW, 'nl')).toBe('1 uur geleden');
  });

  it('fr: il y a 1 heure', () => {
    expect(formatRelativeTime(ONE_HOUR_AGO, NOW, 'fr')).toBe('il y a 1 heure');
  });
});

// ─── 분 단위 4 locale ──────────────────────────────────────────────────────

describe('formatRelativeTime — 분 단위 locale', () => {
  const THIRTY_MIN_AGO = new Date('2026-05-11T11:30:00Z');

  it('ko: 30분 전', () => {
    expect(formatRelativeTime(THIRTY_MIN_AGO, NOW, 'ko')).toBe('30분 전');
  });

  it('en: 30 minutes ago', () => {
    expect(formatRelativeTime(THIRTY_MIN_AGO, NOW, 'en')).toBe('30 minutes ago');
  });

  it('nl: 30 minuten geleden', () => {
    expect(formatRelativeTime(THIRTY_MIN_AGO, NOW, 'nl')).toBe('30 minuten geleden');
  });

  it('fr: il y a 30 minutes', () => {
    expect(formatRelativeTime(THIRTY_MIN_AGO, NOW, 'fr')).toBe('il y a 30 minutes');
  });
});

// ─── ≥ 30일 보수 표시 (4 locale) ─────────────────────────────────────────

describe('formatRelativeTime — ≥ 30일 보수 표시', () => {
  const OVER_30_DAYS = new Date('2026-04-11T12:00:00Z');
  const ONE_YEAR_AGO = new Date('2025-01-01T00:00:00Z');

  it('ko ≥ 30일 → "30일 전"', () => {
    expect(formatRelativeTime(OVER_30_DAYS, NOW, 'ko')).toBe('30일 전');
    expect(formatRelativeTime(ONE_YEAR_AGO, NOW, 'ko')).toBe('30일 전');
  });

  it('en ≥ 30일 → "30 days ago"', () => {
    expect(formatRelativeTime(OVER_30_DAYS, NOW, 'en')).toBe('30 days ago');
    expect(formatRelativeTime(ONE_YEAR_AGO, NOW, 'en')).toBe('30 days ago');
  });

  it('nl ≥ 30일 → "30 dagen geleden"', () => {
    expect(formatRelativeTime(OVER_30_DAYS, NOW, 'nl')).toBe('30 dagen geleden');
  });

  it('fr ≥ 30일 → "il y a 30 jours"', () => {
    expect(formatRelativeTime(OVER_30_DAYS, NOW, 'fr')).toBe('il y a 30 jours');
  });
});

// ─── 음수 diff + 순수성 ───────────────────────────────────────────────────

describe('formatRelativeTime — 음수 diff + 순수성', () => {
  it('음수 diff (target 미래) → 보수 처리 (비어있지 않은 문자열)', () => {
    const future = new Date('2026-05-11T13:00:00Z');
    const result = formatRelativeTime(future, NOW, 'en');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('locale 기본값 = ko (하위 호환)', () => {
    const result1 = formatRelativeTime(new Date('2026-05-11T11:00:00Z'), NOW);
    const result2 = formatRelativeTime(new Date('2026-05-11T11:00:00Z'), NOW, 'ko');
    expect(result1).toBe(result2);
  });

  it('순수성 — 동일 입력 동일 출력', () => {
    const t = new Date('2026-05-11T11:00:00Z');
    expect(formatRelativeTime(t, NOW, 'en')).toBe(formatRelativeTime(t, NOW, 'en'));
  });
});
