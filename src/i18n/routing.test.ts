/**
 * next-intl 라우팅 설정 단위 테스트 (PLAN 4.5.j DoD — 새 함수 최소 1케이스).
 *
 * 검증 범위 (ADR-0033 §T1/§T2):
 *   1. locales 배열 = 5개 BENL 지원 로케일
 *   2. defaultLocale = 'nl-BE' (베네룩스 1차 시장)
 *   3. ko 가 locales 에 없음 (ADR-0033 §T2 — 베타 콘텐츠 전략)
 *   4. localePrefix = 'as-needed' (기존 URL 구조 보존)
 *   5. Locale 타입 = routing.locales 유니온 (타입 레벨 테스트)
 */

import { describe, expect, it } from 'vitest';
import { routing } from './routing';
import type { Locale } from './routing';

describe('routing — ADR-0033 §T1 설정 검증', () => {
  it('locales 는 5개 BENL 지원 locale 포함', () => {
    expect(routing.locales).toEqual(['nl-BE', 'nl-NL', 'fr-BE', 'fr-LU', 'en']);
    expect(routing.locales).toHaveLength(5);
  });

  it('defaultLocale 은 nl-BE', () => {
    expect(routing.defaultLocale).toBe('nl-BE');
  });

  it('ko 는 locales 에 없음 (ADR-0033 §T2 — 베타 단순화)', () => {
    // @builder-justification: as const assertion 없이도 includes 타입 호환
    expect((routing.locales as readonly string[]).includes('ko')).toBe(false);
  });

  it('localePrefix 는 as-needed (기존 URL 구조 보존)', () => {
    expect(routing.localePrefix).toBe('as-needed');
  });
});

// 타입 레벨 검증 — Locale 유니온이 locales 요소와 동일.
// routing.locales[number] 가 Locale 에 할당 가능한지 컴파일러가 검사.
// 이 파일이 typecheck 를 통과하면 Locale 타입 계약 성립.
describe('Locale 타입 — routing.locales 와 동기화', () => {
  it('routing.defaultLocale 은 Locale 타입에 속함', () => {
    // defaultLocale 을 Locale 변수에 할당 — 타입 에러 없으면 계약 성립
    const locale: Locale = routing.defaultLocale;
    expect(locale).toBe('nl-BE');
  });
});
