/**
 * load-smoke.test.ts — 순수 함수 단위 테스트 (PLAN 3.5.3.b 검증 요구사항)
 *
 * HTTP 발사 자체는 통합(integration) 테스트 범주라 여기서 다루지 않음.
 * 테스트 대상:
 *   1. percentile() — p50/p95 계산 정확성 + 경계 케이스
 *   2. isLocalhostHostname() — hostname 가드 판정
 *   3. aggregateSamples() — 집계 로직 정확성
 */

import { describe, it, expect } from 'vitest';

import {
  percentile,
  isLocalhostHostname,
  aggregateSamples,
} from './load-smoke';

// ─── percentile() 단위 테스트 ────────────────────────────────────────────────

describe('percentile()', () => {
  it('[1,2,3,4,5] → p50 = 3', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  it('[1,2,3,4,5] → p95 ≈ 4.8 (선형 보간)', () => {
    // p95 = idx = 0.95 × 4 = 3.8 → lo=3(4), hi=4(5), frac=0.8 → 4 + 0.8 = 4.8
    expect(percentile([1, 2, 3, 4, 5], 95)).toBeCloseTo(4.8, 5);
  });

  it('빈 배열 → 0 반환 (에러 없음)', () => {
    expect(percentile([], 50)).toBe(0);
  });

  it('단일 원소 → 그 값 반환', () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 95)).toBe(42);
    expect(percentile([42], 0)).toBe(42);
  });

  it('p0 → 최솟값, p100 → 최댓값', () => {
    const arr = [10, 20, 30, 40, 50];
    expect(percentile(arr, 0)).toBe(10);
    expect(percentile(arr, 100)).toBe(50);
  });

  it('[100, 200] → p50 = 150 (중간값)', () => {
    // idx = 0.5 × 1 = 0.5 → lo=0(100), hi=1(200), frac=0.5 → 150
    expect(percentile([100, 200], 50)).toBe(150);
  });
});

// ─── isLocalhostHostname() 단위 테스트 ──────────────────────────────────────

describe('isLocalhostHostname()', () => {
  it('localhost → true', () => {
    expect(isLocalhostHostname('localhost')).toBe(true);
  });

  it('127.0.0.1 → true', () => {
    expect(isLocalhostHostname('127.0.0.1')).toBe(true);
  });

  it('[::1] → true', () => {
    expect(isLocalhostHostname('[::1]')).toBe(true);
  });

  it('대소문자 무관 — LOCALHOST → true', () => {
    expect(isLocalhostHostname('LOCALHOST')).toBe(true);
  });

  it('slim.lu → false (production 도메인 거부)', () => {
    expect(isLocalhostHostname('slim.lu')).toBe(false);
  });

  it('vercel.app → false', () => {
    expect(isLocalhostHostname('my-app.vercel.app')).toBe(false);
  });

  it('192.168.0.1 → false (LAN IP 도 거부)', () => {
    // 허용 목록에 없으면 거부 (보수적)
    expect(isLocalhostHostname('192.168.0.1')).toBe(false);
  });

  it('빈 문자열 → false', () => {
    expect(isLocalhostHostname('')).toBe(false);
  });
});

// ─── aggregateSamples() 단위 테스트 ─────────────────────────────────────────

describe('aggregateSamples()', () => {
  it('정상 샘플 5개 — p50/에러율/avgBytes 계산 정확', () => {
    const samples = [
      { latencyMs: 100, status: 200, byteLength: 1000, vercelFunctionMs: null },
      { latencyMs: 200, status: 200, byteLength: 2000, vercelFunctionMs: null },
      { latencyMs: 300, status: 200, byteLength: 1000, vercelFunctionMs: null },
      { latencyMs: 400, status: 200, byteLength: 1000, vercelFunctionMs: null },
      { latencyMs: 500, status: 200, byteLength: 1000, vercelFunctionMs: null },
    ];
    const result = aggregateSamples('테스트 라우트', '/test', samples);

    expect(result.p50Ms).toBe(300); // 중앙값 300ms
    expect(result.errorRate).toBe(0); // 에러 없음
    expect(result.avgBytes).toBe(1200); // (1000+2000+1000+1000+1000)/5 = 1200
    expect(result.sampleCount).toBe(5);
    expect(result.errorCount).toBe(0);
    expect(result.maxMs).toBe(500);
  });

  it('에러 포함 — 에러율 계산 정확', () => {
    const samples = [
      { latencyMs: 100, status: 200, byteLength: 500, vercelFunctionMs: null },
      { latencyMs: 200, status: 500, byteLength: 100, vercelFunctionMs: null }, // 에러
      { latencyMs: 50, status: 0, byteLength: 0, vercelFunctionMs: null },     // 타임아웃
      { latencyMs: 150, status: 200, byteLength: 500, vercelFunctionMs: null },
    ];
    const result = aggregateSamples('에러 테스트', '/api/test', samples);

    expect(result.errorCount).toBe(2);
    expect(result.errorRate).toBeCloseTo(0.5, 5); // 2/4 = 0.5
    expect(result.sampleCount).toBe(4);
  });

  it('빈 샘플 배열 — 에러율 1.0, 0 값', () => {
    const result = aggregateSamples('빈 라우트', '/empty', []);
    expect(result.sampleCount).toBe(0);
    expect(result.errorRate).toBe(1); // 샘플 없음 = 완전 실패
    expect(result.p50Ms).toBe(0);
    expect(result.p95Ms).toBe(0);
    expect(result.avgBytes).toBe(0);
  });

  it('label 과 path 를 그대로 전달', () => {
    const samples = [
      { latencyMs: 100, status: 200, byteLength: 100, vercelFunctionMs: null },
    ];
    const result = aggregateSamples('라벨', '/path', samples);
    expect(result.label).toBe('라벨');
    expect(result.path).toBe('/path');
  });
});
