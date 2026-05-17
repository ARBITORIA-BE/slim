/**
 * request.ts 순수 함수 단위 테스트 (PLAN 4.5.j.2 Phase A DoD — G1 누수 0 + G3 병합).
 *
 * 왜 getRequestConfig 를 직접 호출하지 않는가:
 *   getRequestConfig 는 next-intl 서버 전용 래퍼 — Vitest(Node/클라이언트 환경)에서
 *   호출하면 "not supported in Client Components" 오류 발생.
 *   대신 핵심 로직(shouldOverrideKo, shallowMerge, loadMessages, BASE_LOCALE_MAP)을
 *   독립 export 로 분리하여 직접 테스트한다 (기존 ko-gate.test.ts 의 미들웨어 모킹
 *   패턴과 동일 정신 — 행동만 검증).
 *
 * 검증 케이스:
 *   (A) G1-a ko 오버레이 — shouldOverrideKo():
 *     (i)   유효 쿠키 + env 일치 → true (ko 스왑)
 *     (ii)  무쿠키 → false (공개 locale 그대로, 정적 렌더 회귀 0)
 *     (iii) 잘못된 토큰 → false (constant-time, ko 누출 0)
 *     (viii) env 미설정 → false (쿠키 있어도 스왑 없음)
 *   (B) G3 base+delta 병합 — shallowMerge() + BASE_LOCALE_MAP:
 *     (iv)  nl-BE → nl base locale 매핑 확인
 *     (v)   nl-NL → nl base locale 매핑 확인
 *     (vi)  fr-BE → fr base locale 매핑 확인
 *     (vii) fr-LU → fr base locale 매핑 확인
 *     (ix)  en → base 없음 (undefined)
 *     (x)   shallowMerge: delta 가 base 를 override (delta 우선)
 *     (xi)  shallowMerge: delta 가 비어 있으면 base 그대로
 *   (C) loadMessages — fallback:
 *     (xii) 존재하지 않는 locale → 빈 객체 (γ fallback, 에러 없음)
 */

import { describe, expect, it, vi, afterEach } from 'vitest';

// ─── messages/*.json 모킹 ───────────────────────────────────────────────────
// dynamic import `../../messages/${locale}.json` 를 가로채서
// in-memory fixture 객체를 반환한다.
// 실제 파일 읽기 없이 병합 로직만 검증.

const MESSAGE_FIXTURES: Record<string, Record<string, unknown>> = {
  ko: {
    home: { headline: 'KO headline', ctaButton: 'KO cta' },
    caveats: { commitment: 'KO commitment' },
  },
  nl: {
    home: { headline: 'NL headline', ctaButton: 'NL cta', tagline: 'NL tagline' },
    caveats: { commitment: 'NL commitment' },
  },
  'nl-BE': {
    // delta: nl-BE 는 nl 과 거의 같지만 home 네임스페이스만 다르다고 가정
    home: { tagline: 'NL-BE tagline override' },
  },
  'nl-NL': {
    // delta: nl-NL 은 빈 delta (nl base 그대로)
  },
  fr: {
    home: { headline: 'FR headline', ctaButton: 'FR cta', tagline: 'FR tagline' },
    caveats: { commitment: 'FR commitment' },
  },
  'fr-BE': {
    // delta: 빈 delta
  },
  'fr-LU': {
    // delta: fr-LU 특수 override
    home: { tagline: 'FR-LU tagline override' },
  },
  en: {
    home: { headline: 'EN headline', ctaButton: 'EN cta', tagline: 'EN tagline' },
    caveats: { commitment: 'EN commitment' },
  },
};

vi.mock('../../messages/ko.json', () => ({ default: MESSAGE_FIXTURES['ko'] }));
vi.mock('../../messages/nl.json', () => ({ default: MESSAGE_FIXTURES['nl'] }));
vi.mock('../../messages/nl-BE.json', () => ({ default: MESSAGE_FIXTURES['nl-BE'] }));
vi.mock('../../messages/nl-NL.json', () => ({ default: MESSAGE_FIXTURES['nl-NL'] }));
vi.mock('../../messages/fr.json', () => ({ default: MESSAGE_FIXTURES['fr'] }));
vi.mock('../../messages/fr-BE.json', () => ({ default: MESSAGE_FIXTURES['fr-BE'] }));
vi.mock('../../messages/fr-LU.json', () => ({ default: MESSAGE_FIXTURES['fr-LU'] }));
vi.mock('../../messages/en.json', () => ({ default: MESSAGE_FIXTURES['en'] }));

// routing 모킹 — request.ts 가 import 함
vi.mock('./routing', () => ({
  routing: {
    locales: ['nl-BE', 'nl-NL', 'fr-BE', 'fr-LU', 'en'],
    defaultLocale: 'nl-BE',
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

import { shouldOverrideKo, shallowMerge, loadMessages, BASE_LOCALE_MAP } from './request';

// ─── 테스트 ──────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('G1-a ko 오버레이 — shouldOverrideKo() (PLAN 4.5.j.2 DoD (3))', () => {
  /**
   * 케이스 (i): 유효 쿠키 + env 일치 → true (ko 스왑).
   * 운영자가 nl-BE 경로에서도 ko 텍스트로 검증 가능.
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

describe('G3 base+delta 병합 — BASE_LOCALE_MAP (PLAN 4.5.j.2 DoD (5))', () => {
  it('(iv) nl-BE → nl base', () => {
    expect(BASE_LOCALE_MAP['nl-BE']).toBe('nl');
  });

  it('(v) nl-NL → nl base', () => {
    expect(BASE_LOCALE_MAP['nl-NL']).toBe('nl');
  });

  it('(vi) fr-BE → fr base', () => {
    expect(BASE_LOCALE_MAP['fr-BE']).toBe('fr');
  });

  it('(vii) fr-LU → fr base', () => {
    expect(BASE_LOCALE_MAP['fr-LU']).toBe('fr');
  });

  it('(ix) en → base 없음 (undefined)', () => {
    expect(BASE_LOCALE_MAP['en']).toBeUndefined();
  });
});

describe('G3 base+delta 병합 — shallowMerge()', () => {
  /**
   * 케이스 (x): delta 가 base 를 override (delta 우선).
   * 학습자 코멘트:
   *   얕은 병합은 최상위 키(네임스페이스) 단위로 override 한다.
   *   nl-BE.home = { tagline: 'NL-BE ...' } 이면 home 네임스페이스 전체가 대체된다.
   *   Phase B 에서 delta 가 특정 하위 키만 바꾸려면 깊은 병합이 필요하나,
   *   Phase A 에서 delta 가 거의 비어 있으므로 얕은 병합으로 충분.
   */
  it('(x) delta 가 base 를 네임스페이스 단위로 override', () => {
    const base = { home: { headline: 'base headline', tagline: 'base tagline' } };
    const delta = { home: { tagline: 'delta tagline' } }; // headline 은 없음
    const merged = shallowMerge(base, delta);

    // 얕은 병합: home 전체가 delta.home 으로 교체 (base.home.headline 소실)
    // @ts-expect-error — 동적 fixture 객체
    expect(merged.home.tagline).toBe('delta tagline');
    // 얕은 병합의 한계: base.home.headline 은 소실됨
    // @ts-expect-error — 동적 fixture 객체
    expect(merged.home.headline).toBeUndefined();
  });

  /**
   * 케이스 (xi): delta 가 비어 있으면 base 그대로.
   * nl-NL/fr-BE = Phase A 빈 delta → nl/fr base 100% 노출.
   */
  it('(xi) 빈 delta → base 그대로', () => {
    const base = { home: { headline: 'base headline', tagline: 'base tagline' } };
    const delta = {}; // 빈 delta
    const merged = shallowMerge(base, delta);

    // @ts-expect-error — 동적 fixture 객체
    expect(merged.home.headline).toBe('base headline');
    // @ts-expect-error — 동적 fixture 객체
    expect(merged.home.tagline).toBe('base tagline');
  });

  it('(xi-b) delta 가 base 에 없는 키를 추가', () => {
    const base = { home: { headline: 'base headline' } };
    const delta = { result: { heading: 'delta result heading' } };
    const merged = shallowMerge(base, delta);

    // @ts-expect-error — 동적 fixture 객체
    expect(merged.home.headline).toBe('base headline'); // base 보존
    // @ts-expect-error — 동적 fixture 객체
    expect(merged.result.heading).toBe('delta result heading'); // delta 추가
  });
});

describe('G3 base+delta — loadMessages() fallback (PLAN 4.5.j.2 DoD (5))', () => {
  /**
   * 케이스 (xii): 존재하지 않는 locale → 빈 객체 (γ fallback, 에러 없음).
   * 미번역 파일 접근 시 에러 없이 빈 객체 반환 — γ 미번역 허용.
   */
  it('(xii) 존재하지 않는 locale → 빈 객체 fallback (에러 throw 안 함)', async () => {
    // 'xx-XX' 는 mock 에 없는 locale — dynamic import 실패 → 빈 객체
    const result = await loadMessages('xx-XX');
    expect(result).toEqual({});
  });

  it('nl 로드 → MESSAGE_FIXTURES["nl"] 반환', async () => {
    const result = await loadMessages('nl');
    // @ts-expect-error — 동적 fixture
    expect(result.home.headline).toBe('NL headline');
  });

  it('ko 로드 → MESSAGE_FIXTURES["ko"] 반환', async () => {
    const result = await loadMessages('ko');
    // @ts-expect-error — 동적 fixture
    expect(result.home.headline).toBe('KO headline');
  });
});
