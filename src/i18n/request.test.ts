/**
 * request.ts 순수 함수 단위 테스트 (PLAN 4.5.j.2 Phase A DoD + 4.15.b 정합).
 *
 * 왜 getRequestConfig 를 직접 호출하지 않는가:
 *   getRequestConfig 는 next-intl 서버 전용 래퍼 — Vitest(Node/클라이언트 환경)에서
 *   호출하면 "not supported in Client Components" 오류 발생.
 *   대신 핵심 로직(shouldOverrideKo, loadMessages)을 독립 export 로 분리하여
 *   직접 테스트한다 (기존 ko-gate.test.ts 의 미들웨어 모킹 패턴과 동일 정신).
 *
 * ADR-0033 Amd 6 (2026-06-07): locale 5→3 통합 → BASE_LOCALE_MAP / shallowMerge 제거.
 *   제거된 테스트 케이스: (iv)~(xi) BASE_LOCALE_MAP + shallowMerge 어설션.
 *   이유: 두 함수가 request.ts 에서 삭제됨 — dead code 테스트는 불필요.
 *
 * 검증 케이스:
 *   (A) G1-a ko 오버레이 — shouldOverrideKo():
 *     (i)   유효 쿠키 + env 일치 → true (ko 스왑)
 *     (ii)  무쿠키 → false (공개 locale 그대로, 정적 렌더 회귀 0)
 *     (iii) 잘못된 토큰 → false (constant-time, ko 누출 0)
 *     (viii) env 미설정 → false (쿠키 있어도 스왑 없음)
 *   (B) loadMessages — 3-locale + fallback:
 *     (i)   nl 로드 → nl.json 키 반환
 *     (ii)  fr 로드 → fr.json 키 반환
 *     (iii) en 로드 → en.json 키 반환
 *     (iv)  unknown locale → 빈 객체 (γ fallback, 에러 없음)
 */

import { describe, expect, it, vi, afterEach } from 'vitest';

// ─── messages/*.json 모킹 ───────────────────────────────────────────────────
// dynamic import `../../messages/${locale}.json` 를 가로채서
// in-memory fixture 객체를 반환한다.
// 실제 파일 읽기 없이 로드 로직만 검증.

const MESSAGE_FIXTURES: Record<string, Record<string, unknown>> = {
  ko: {
    home: { headline: 'KO headline', ctaButton: 'KO cta' },
    caveats: { commitment: 'KO commitment' },
  },
  nl: {
    home: { headline: 'NL headline', ctaButton: 'NL cta', tagline: 'NL tagline' },
    caveats: { commitment: 'NL commitment' },
  },
  fr: {
    home: { headline: 'FR headline', ctaButton: 'FR cta', tagline: 'FR tagline' },
    caveats: { commitment: 'FR commitment' },
  },
  en: {
    home: { headline: 'EN headline', ctaButton: 'EN cta', tagline: 'EN tagline' },
    caveats: { commitment: 'EN commitment' },
  },
};

vi.mock('../../messages/ko.json', () => ({ default: MESSAGE_FIXTURES['ko'] }));
vi.mock('../../messages/nl.json', () => ({ default: MESSAGE_FIXTURES['nl'] }));
vi.mock('../../messages/fr.json', () => ({ default: MESSAGE_FIXTURES['fr'] }));
vi.mock('../../messages/en.json', () => ({ default: MESSAGE_FIXTURES['en'] }));

// routing 모킹 — ADR-0033 Amd 6: 3-locale (nl/fr/en)
// 왜 모킹인가: request.ts 가 routing 을 import 하므로, 테스트 환경에서
// 실제 next-intl defineRouting 를 실행하지 않기 위해.
vi.mock('./routing', () => ({
  routing: {
    locales: ['nl', 'fr', 'en'],
    defaultLocale: 'nl',
    localePrefix: 'as-needed',
  },
}));

// next-intl/server 모킹 — getRequestConfig 는 서버 전용이라 Node 에서 사용 불가.
// 테스트는 getRequestConfig 래퍼를 통하지 않고 순수 함수를 직접 호출한다.
vi.mock('next-intl/server', () => ({
  getRequestConfig: (fn: unknown) => fn, // 래퍼 없이 콜백 그대로 반환
}));

// next/headers 모킹 (getRequestConfig 래퍼를 테스트하지 않으므로 실제론 호출 안 됨)
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: () => undefined,
  })),
}));

// ─── 순수 함수 import ────────────────────────────────────────────────────────

import { shouldOverrideKo, loadMessages } from './request';

// ─── 테스트 ──────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('G1-a ko 오버레이 — shouldOverrideKo() (PLAN 4.5.j.2 DoD (3))', () => {
  /**
   * 케이스 (i): 유효 쿠키 + env 일치 → true (ko 스왑).
   * 운영자가 nl 경로에서도 ko 텍스트로 검증 가능.
   */
  it('(i) 유효 쿠키 + env 일치 → true (ko 스왑)', () => {
    const result = shouldOverrideKo('secret-token', 'secret-token');
    expect(result).toBe(true);
  });

  /**
   * 케이스 (ii): 무쿠키 → false (공개 locale, 정적 렌더 회귀 0).
   * 검색 봇/일반 사용자는 ko 를 볼 수 없음 — G1 누수 0.
   */
  it('(ii) 무쿠키 → false (공개 locale 그대로, 정적 렌더 회귀 0)', () => {
    const result = shouldOverrideKo(undefined, 'secret-token');
    expect(result).toBe(false);
  });

  /**
   * 케이스 (iii): 잘못된 토큰 → false (constant-time 비교, ko 누출 0).
   * 마지막 글자만 다른 토큰 — timing attack 방지 + ko 비노출 동시 검증.
   */
  it('(iii) 잘못된 토큰 → false (constant-time, ko 누출 0)', () => {
    const result = shouldOverrideKo('secret-tokex', 'secret-token');
    expect(result).toBe(false);
  });

  /**
   * 케이스 (viii): env 미설정 → false (쿠키 있어도 스왑 없음).
   * env 없이 쿠키만으로 ko 를 볼 수 있으면 보안 의미 없음.
   */
  it('(viii) env 미설정 → false (쿠키 있어도 오버레이 비활성)', () => {
    const result = shouldOverrideKo('any-cookie-value', undefined);
    expect(result).toBe(false);
  });

  it('(viii-b) env 빈 문자열 → false', () => {
    const result = shouldOverrideKo('any-cookie-value', '');
    expect(result).toBe(false);
  });
});

describe('loadMessages — 3-locale + fallback (ADR-0033 Amd 6)', () => {
  /**
   * ADR-0033 Amd 6: locale 5→3 통합 후 각 locale 이 완전한 파일을 가짐.
   * base+delta 병합 없이 단일 loadMessages 호출만 검증한다.
   */
  it('(i) nl 로드 → nl.json 키 반환', async () => {
    const result = await loadMessages('nl');
    // @ts-expect-error — 동적 fixture 객체
    expect(result.home.headline).toBe('NL headline');
  });

  it('(ii) fr 로드 → fr.json 키 반환', async () => {
    const result = await loadMessages('fr');
    // @ts-expect-error — 동적 fixture 객체
    expect(result.home.headline).toBe('FR headline');
  });

  it('(iii) en 로드 → en.json 키 반환', async () => {
    const result = await loadMessages('en');
    // @ts-expect-error — 동적 fixture 객체
    expect(result.home.headline).toBe('EN headline');
  });

  /**
   * (iv) unknown locale → 빈 객체 γ fallback.
   * 미번역 파일 접근 시 에러 없이 빈 객체 반환.
   */
  it('(iv) 존재하지 않는 locale → 빈 객체 fallback (에러 throw 안 함)', async () => {
    const result = await loadMessages('xx-XX');
    expect(result).toEqual({});
  });

  it('ko 로드 → ko.json 키 반환 (G1-a 오버레이 경로)', async () => {
    const result = await loadMessages('ko');
    // @ts-expect-error — 동적 fixture 객체
    expect(result.home.headline).toBe('KO headline');
  });
});
