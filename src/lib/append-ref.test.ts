/**
 * appendRefParam 단위 테스트 (PLAN 4.1.c).
 *
 * 검증:
 *   1. `?` 없는 URL → `?ref=<value>` 로 추가
 *   2. `?` 있는 URL → `&ref=<value>` 로 추가
 *   3. ref 값 encodeURIComponent 적용 (특수문자 포함)
 *   4. 빈 쿼리스트링이 있는 URL (`url?`) → `&ref=` (엣지)
 */

import { describe, expect, it } from 'vitest';

import { appendRefParam } from './append-ref';

describe('appendRefParam', () => {
  it('?가 없는 URL → ?ref= 로 추가', () => {
    expect(appendRefParam('https://proximus.be', 'slim-r-abc123def456')).toBe(
      'https://proximus.be?ref=slim-r-abc123def456',
    );
  });

  it('?가 있는 URL → &ref= 로 추가', () => {
    expect(
      appendRefParam('https://proximus.be/plans?lang=nl', 'slim-r-abc123def456'),
    ).toBe('https://proximus.be/plans?lang=nl&ref=slim-r-abc123def456');
  });

  it('ref 값에 특수문자가 있으면 encodeURIComponent 적용', () => {
    const result = appendRefParam('https://example.be', 'slim r+1');
    // encodeURIComponent('slim r+1') = 'slim%20r%2B1'
    expect(result).toBe('https://example.be?ref=slim%20r%2B1');
  });

  it('baseUrl 끝에 ? 가 있는 경우 → &ref= 로 추가 (? 포함 처리)', () => {
    expect(appendRefParam('https://proximus.be?', 'slim-r-xyz')).toBe(
      'https://proximus.be?&ref=slim-r-xyz',
    );
  });

  it('순수성 — 동일 입력 → 동일 출력', () => {
    const a = appendRefParam('https://proximus.be', 'slim-r-abc');
    const b = appendRefParam('https://proximus.be', 'slim-r-abc');
    expect(a).toBe(b);
  });
});
