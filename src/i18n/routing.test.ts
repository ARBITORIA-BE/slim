/**
 * next-intl 라우팅 설정 단위 테스트 (PLAN 4.15.b DoD — 5→3 locale 통합).
 *
 * 검증 범위 (ADR-0033 Amd 6 + ADR-0036 Amd 1):
 *   1. locales 배열 = 3개 통합 locale (nl / fr / en)
 *   2. defaultLocale = 'nl' (무프리픽스 슬롯)
 *   3. ko 가 locales 에 없음 (ADR-0033 §T2 — request.ts G1-a 오버레이 담당)
 *   4. localePrefix = 'as-needed' (기존 URL 구조 보존)
 *   5. Locale 타입 = routing.locales 유니온 (타입 레벨 테스트)
 */

import { describe, expect, it } from 'vitest';
import { routing } from './routing';
import type { Locale } from './routing';

describe('routing — ADR-0033 Amd 6 5→3 locale 통합 검증', () => {
  it('locales 는 3개 통합 locale (nl / fr / en)', () => {
    expect(routing.locales).toEqual(['nl', 'fr', 'en']);
    expect(routing.locales).toHaveLength(3);
  });

  it('defaultLocale 은 nl (무프리픽스 슬롯)', () => {
    expect(routing.defaultLocale).toBe('nl');
  });

  it('ko 는 locales 에 없음 (ADR-0033 §T2 — request.ts G1-a 오버레이 담당)', () => {
    // @builder-justification: as const assertion 없이도 includes 타입 호환
    expect((routing.locales as readonly string[]).includes('ko')).toBe(false);
  });

  it('localePrefix 는 as-needed (기존 URL 구조 보존 — ADR-0033 §T1 회귀 0)', () => {
    expect(routing.localePrefix).toBe('as-needed');
  });

  it('deprecated 5-locale 코드 (nl-BE / nl-NL / fr-BE / fr-LU) 는 locales 에 없음', () => {
    const deprecated = ['nl-BE', 'nl-NL', 'fr-BE', 'fr-LU'];
    for (const d of deprecated) {
      expect((routing.locales as readonly string[]).includes(d)).toBe(false);
    }
  });
});

// 타입 레벨 검증 — Locale 유니온이 locales 요소와 동일.
// routing.locales[number] 가 Locale 에 할당 가능한지 컴파일러가 검사.
// 이 파일이 typecheck 를 통과하면 Locale 타입 계약 성립.
describe('Locale 타입 — routing.locales 와 동기화', () => {
  it('routing.defaultLocale 은 Locale 타입에 속함', () => {
    // defaultLocale 을 Locale 변수에 할당 — 타입 에러 없으면 계약 성립
    const locale: Locale = routing.defaultLocale;
    expect(locale).toBe('nl');
  });
});
