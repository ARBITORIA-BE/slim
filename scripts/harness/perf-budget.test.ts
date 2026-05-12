/**
 * perf-budget.ts 단위 테스트 — PLAN 3.5.1.a
 *
 * 측정 로직은 Playwright + Lighthouse 런타임 의존이라 단위 테스트 범위 밖.
 * 임계값 참고 상수와 메트릭 추출 규칙을 순수 함수로 분리해 검증한다.
 *
 * 임계값 판정(exit 1) 로직은 3.5.1.b 몫 — 그 sub-task 에서 순수 함수 + 테스트 추가 예정.
 */

import { describe, expect, it } from 'vitest';

// ─── 임계값 상수 (perf-budget.ts 에서 복사 — 3.5.1.b 에서 공유 모듈로 추출 예정) ──

const HARD_LCP_MS = 2500;
const HARD_TBT_MS = 200;
const SOFT_PERF   = 90;
const SOFT_A11Y   = 95;

// ─── 임계값 비교 순수 함수 (3.5.1.b 에서 perf-budget.ts 에 추가될 로직 선검증) ──

function isLcpPass(ms: number): boolean {
  return ms <= HARD_LCP_MS;
}

function isTbtPass(ms: number): boolean {
  return ms <= HARD_TBT_MS;
}

function isPerfPass(score: number): boolean {
  return score >= SOFT_PERF;
}

function isA11yPass(score: number): boolean {
  return score >= SOFT_A11Y;
}

// ─── 메트릭 추출 헬퍼 (lighthouse numericValue → ms 반올림) ───────────────────

function toRoundedMs(v: number | undefined | null): number | null {
  return typeof v === 'number' ? Math.round(v) : null;
}

function toScore(v: number | null | undefined): number | null {
  return typeof v === 'number' ? Math.round(v * 100) : null;
}

// ─── 테스트 ────────────────────────────────────────────────────────────────────

describe('LCP 임계값 판정 (hard, 헌법 P2)', () => {
  it('2500ms 이하는 통과', () => {
    expect(isLcpPass(2500)).toBe(true);
    expect(isLcpPass(1200)).toBe(true);
    expect(isLcpPass(0)).toBe(true);
  });

  it('2501ms 이상은 실패', () => {
    expect(isLcpPass(2501)).toBe(false);
    expect(isLcpPass(5000)).toBe(false);
  });
});

describe('TBT 임계값 판정 (hard, FID lab proxy — ADR-0023 T4)', () => {
  it('200ms 이하는 통과', () => {
    expect(isTbtPass(200)).toBe(true);
    expect(isTbtPass(0)).toBe(true);
    expect(isTbtPass(150)).toBe(true);
  });

  it('201ms 이상은 실패', () => {
    expect(isTbtPass(201)).toBe(false);
    expect(isTbtPass(500)).toBe(false);
  });
});

describe('Perf 점수 판정 (soft, PLAN 페이즈 3 검증 라인)', () => {
  it('90 이상은 통과', () => {
    expect(isPerfPass(90)).toBe(true);
    expect(isPerfPass(100)).toBe(true);
  });

  it('89 이하는 soft 경고 대상', () => {
    expect(isPerfPass(89)).toBe(false);
    expect(isPerfPass(0)).toBe(false);
  });
});

describe('A11y 점수 판정 (soft)', () => {
  it('95 이상은 통과', () => {
    expect(isA11yPass(95)).toBe(true);
    expect(isA11yPass(100)).toBe(true);
  });

  it('94 이하는 soft 경고 대상', () => {
    expect(isA11yPass(94)).toBe(false);
  });
});

describe('메트릭 ms 반올림 (toRoundedMs)', () => {
  it('정수 입력은 그대로', () => {
    expect(toRoundedMs(1234)).toBe(1234);
  });

  it('소수점은 반올림', () => {
    expect(toRoundedMs(1234.7)).toBe(1235);
    expect(toRoundedMs(999.4)).toBe(999);
  });

  it('null/undefined 는 null 반환', () => {
    expect(toRoundedMs(null)).toBe(null);
    expect(toRoundedMs(undefined)).toBe(null);
  });
});

describe('Lighthouse 점수 0~1 → 0~100 변환 (toScore)', () => {
  it('0.9 → 90', () => {
    expect(toScore(0.9)).toBe(90);
  });

  it('0.953 → 95 (반올림)', () => {
    expect(toScore(0.953)).toBe(95);
  });

  it('null/undefined → null', () => {
    expect(toScore(null)).toBe(null);
    expect(toScore(undefined)).toBe(null);
  });

  it('1.0 → 100', () => {
    expect(toScore(1.0)).toBe(100);
  });

  it('0 → 0', () => {
    expect(toScore(0)).toBe(0);
  });
});
