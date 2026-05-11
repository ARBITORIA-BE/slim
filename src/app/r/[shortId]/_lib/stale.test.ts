/**
 * stale 단위 테스트 — 라운드 c (PLAN 3.3).
 *
 * 검증: 모든 경계 + 음수 diff + now 주입 + 순수성.
 */

import { describe, expect, it } from 'vitest';

import { formatRelativeTime } from './stale';

const NOW = new Date('2026-05-11T12:00:00Z');

describe('formatRelativeTime', () => {
  it('< 1분 → 방금 전', () => {
    expect(formatRelativeTime(new Date('2026-05-11T11:59:59Z'), NOW)).toBe(
      '방금 전',
    );
    expect(formatRelativeTime(new Date('2026-05-11T11:59:01Z'), NOW)).toBe(
      '방금 전',
    );
  });

  it('1분~59분 → X분 전', () => {
    expect(formatRelativeTime(new Date('2026-05-11T11:59:00Z'), NOW)).toBe(
      '1분 전',
    );
    expect(formatRelativeTime(new Date('2026-05-11T11:01:00Z'), NOW)).toBe(
      '59분 전',
    );
  });

  it('1시간~23시간 → X시간 전', () => {
    expect(formatRelativeTime(new Date('2026-05-11T11:00:00Z'), NOW)).toBe(
      '1시간 전',
    );
    expect(formatRelativeTime(new Date('2026-05-10T13:00:00Z'), NOW)).toBe(
      '23시간 전',
    );
  });

  it('1일~29일 → X일 전', () => {
    expect(formatRelativeTime(new Date('2026-05-10T12:00:00Z'), NOW)).toBe(
      '1일 전',
    );
    expect(formatRelativeTime(new Date('2026-04-12T12:00:00Z'), NOW)).toBe(
      '29일 전',
    );
  });

  it('30일 이상 → 30일 이상 전', () => {
    expect(formatRelativeTime(new Date('2026-04-11T12:00:00Z'), NOW)).toBe(
      '30일 이상 전',
    );
    expect(formatRelativeTime(new Date('2025-01-01T00:00:00Z'), NOW)).toBe(
      '30일 이상 전',
    );
  });

  it('음수 diff (target 미래) → 방금 전 (보수 처리)', () => {
    expect(formatRelativeTime(new Date('2026-05-11T13:00:00Z'), NOW)).toBe(
      '방금 전',
    );
  });

  it('순수성 — 동일 입력 동일 출력', () => {
    const t = new Date('2026-05-11T11:00:00Z');
    const a = formatRelativeTime(t, NOW);
    const b = formatRelativeTime(t, NOW);
    expect(a).toBe(b);
  });
});
