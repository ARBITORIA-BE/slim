/**
 * ko 게이트 단위 테스트.
 *
 * 4.5.j.1 DoD D5 6 케이스 → 4.5.j.2 Phase A 게이트 해제 후 갱신.
 *
 * [게이트 해제 변경 (ADR-0033 §A2.7 A3 + §A2.3 필수 스위치)]:
 *   isKoGateTarget 이 항상 false → 무프리픽스 경로 포함 전체 = 게이트 비대상.
 *   handleKoGate 는 여전히 존재하나 더 이상 호출되지 않음.
 *   따라서:
 *     - 케이스 (ii): 무토큰 / → 401 → 200 (게이트 해제, intl 위임)
 *     - 케이스 (vi): 잘못된 토큰 → 401 → 200 (게이트 해제)
 *     - 케이스 (iii): 유효 쿠키 → 여전히 200 (intl 위임 — 게이트 없이 통과)
 *   ko 보호는 이제 request.ts G1-a 오버레이 쿠키가 담당.
 *   이 테스트 파일은 middleware.ts 의 라우팅 로직만 검증.
 *   G1-a 오버레이는 request.test.ts 가 담당.
 *
 * ADR-0033 §A2.5 D5 — 게이트 누수 0 검증 케이스 (Phase A 갱신):
 *   (i)   env 미설정 → pass-through (200) — 핫픽스 10dee59 + Phase A 정합
 *   (ii)  무토큰 → [Phase A] 게이트 해제 → 200 (intl 위임)
 *   (iii) 유효 쿠키 → 200 (게이트 해제 후에도 pass-through)
 *   (iv)  공개 prefix 경로 → 200 (게이트 비대상)
 *   (v)   /api/* → matcher 기 제외
 *   (vi)  잘못된 토큰 → [Phase A] 게이트 해제 → 200 (intl 위임)
 *
 * 학습자 코멘트:
 *   게이트 해제 = "middleware 가 더 이상 무프리픽스 경로를 막지 않음".
 *   nl-BE 슬롯이 실 nl 콘텐츠로 교체됐으니 막을 이유가 없다.
 *   ko 접근 보호는 request.ts 의 메시지 스왑 레이어로 이동.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';

// next/server 를 모킹 — Edge runtime 의존성 없이 테스트 가능하게.
vi.mock('next/server', () => {
  const MockNextResponse = class {
    public status: number;
    public body: string;
    public headers: Map<string, string>;
    private _cookies: Map<string, { value: string; options: object }>;

    constructor(body: string, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = new Map(Object.entries(init?.headers ?? {}));
      this._cookies = new Map();
    }

    cookies = {
      set: (name: string, value: string, options: object) => {
        this._cookies.set(name, { value, options });
      },
      get: (name: string) => this._cookies.get(name),
    };

    getSetCookies() {
      return Array.from(this._cookies.entries()).map(([name, { value }]) => ({
        name,
        value,
      }));
    }

    static redirect(url: URL | string) {
      const res = new MockNextResponse('', { status: 307 });
      res.headers.set('location', url.toString());
      return res;
    }
  };

  return {
    NextResponse: MockNextResponse,
    NextRequest: class {},
  };
});

// next-intl/middleware 모킹 — "통과" 를 200 으로 표현.
vi.mock('next-intl/middleware', () => ({
  default: () => (_req: { nextUrl: { pathname: string } }) => {
    return new (require('next/server').NextResponse)('intl-pass', { status: 200 });
  },
}));

import { middleware } from './middleware';

// ─── 헬퍼: 가짜 NextRequest 생성 ─────────────────────────────────────────────

function makeFakeRequest({
  pathname,
  cookieValue,
  queryToken,
}: {
  pathname: string;
  cookieValue?: string;
  queryToken?: string;
}) {
  const searchParams = new URLSearchParams();
  if (queryToken) searchParams.set('ko_token', queryToken);

  const url = `https://slim.be${pathname}${queryToken ? `?ko_token=${queryToken}` : ''}`;

  return {
    nextUrl: {
      pathname,
      searchParams,
      clone() {
        return {
          pathname,
          searchParams: new URLSearchParams(searchParams.toString()),
          delete: (k: string) => searchParams.delete(k),
          toString() {
            return url;
          },
        };
      },
      toString() {
        return url;
      },
    },
    cookies: {
      get(name: string) {
        if (name === 'ko_gate_token' && cookieValue !== undefined) {
          return { value: cookieValue };
        }
        return undefined;
      },
    },
  };
}

// ─── 테스트 ───────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('ko 게이트 — Phase A 게이트 해제 후 정합 (PLAN 4.5.j.2 A3)', () => {
  /**
   * 케이스 (i): env 미설정 → 게이트 비활성 (pass-through, 200).
   * 핫픽스 10dee59 + Phase A 게이트 해제로 더욱 명확히 정합.
   */
  it('(i) env KO_GATE_TOKEN 미설정 → 루트 / pass-through (200)', async () => {
    vi.stubEnv('KO_GATE_TOKEN', '');

    const req = makeFakeRequest({ pathname: '/' });
    // @ts-expect-error — duck-typed fake request
    const res = middleware(req);

    expect(res.status).toBe(200);
  });

  /**
   * 케이스 (ii-a/b): 무토큰 → [Phase A 게이트 해제] → 200 (intl 위임).
   * 4.5.j.1 에서 401 이었으나 4.5.j.2 게이트 해제로 200 으로 변경.
   * 이유: nl-BE 슬롯이 실 nl 콘텐츠로 교체됐으므로 더 이상 막을 필요 없음.
   * ko 보호는 request.ts G1-a 오버레이가 담당.
   */
  it('(ii-a) 무토큰 / → [게이트 해제] 200 (intl 위임)', async () => {
    vi.stubEnv('KO_GATE_TOKEN', 'secret-token-abc');

    const req = makeFakeRequest({ pathname: '/' });
    // @ts-expect-error — duck-typed fake request
    const res = middleware(req);

    // 4.5.j.2 게이트 해제 → isKoGateTarget = false → intl 위임 = 200
    expect(res.status).toBe(200);
  });

  it('(ii-b) 무토큰 /compare → [게이트 해제] 200 (intl 위임)', async () => {
    vi.stubEnv('KO_GATE_TOKEN', 'secret-token-abc');

    const req = makeFakeRequest({ pathname: '/compare' });
    // @ts-expect-error — duck-typed fake request
    const res = middleware(req);

    expect(res.status).toBe(200);
  });

  /**
   * 케이스 (iii): 유효 쿠키 토큰 → 여전히 200 (게이트 해제, intl 위임).
   * 4.5.j.1 과 동일 결과 — 게이트가 없어도 intl 에 위임.
   */
  it('(iii) 유효 ko_gate_token 쿠키 → 통과 (200, 게이트 해제와 무관)', async () => {
    vi.stubEnv('KO_GATE_TOKEN', 'secret-token-abc');

    const req = makeFakeRequest({
      pathname: '/',
      cookieValue: 'secret-token-abc',
    });
    // @ts-expect-error — duck-typed fake request
    const res = middleware(req);

    expect(res.status).toBe(200);
  });

  /**
   * 케이스 (iv): 공개 locale prefix 경로 → 200 (게이트 비대상, 변경 없음).
   */
  it('(iv-a) /en/* → 게이트 없이 통과 (200)', async () => {
    vi.stubEnv('KO_GATE_TOKEN', 'secret-token-abc');

    const req = makeFakeRequest({ pathname: '/en' });
    // @ts-expect-error — duck-typed fake request
    const res = middleware(req);

    expect(res.status).toBe(200);
  });

  it('(iv-b) /nl-NL/compare/internet → 게이트 없이 통과 (200)', async () => {
    vi.stubEnv('KO_GATE_TOKEN', 'secret-token-abc');

    const req = makeFakeRequest({ pathname: '/nl-NL/compare/internet' });
    // @ts-expect-error — duck-typed fake request
    const res = middleware(req);

    expect(res.status).toBe(200);
  });

  it('(iv-c) /fr-BE 경로 → 게이트 없이 통과 (200)', async () => {
    vi.stubEnv('KO_GATE_TOKEN', 'secret-token-abc');

    const req = makeFakeRequest({ pathname: '/fr-BE' });
    // @ts-expect-error — duck-typed fake request
    const res = middleware(req);

    expect(res.status).toBe(200);
  });

  /**
   * 케이스 (v): /api/* → matcher 기 제외.
   */
  it('(v) /api/compare → matcher 에서 /api/ 제외 확인', async () => {
    vi.stubEnv('KO_GATE_TOKEN', 'secret-token-abc');

    const { config } = await import('./middleware');
    const matcherPattern = config.matcher.join('|');
    expect(matcherPattern).toContain('api');
    expect(matcherPattern).toMatch(/\?!.*api/);
  });

  /**
   * 케이스 (vi): 잘못된 토큰 → [Phase A 게이트 해제] → 200 (intl 위임).
   * 4.5.j.1 에서 401 이었으나 게이트 해제로 200.
   * ko 보호는 request.ts G1-a 에서 constantTimeEqual 로 처리.
   */
  it('(vi) 잘못된 쿠키 토큰 → [게이트 해제] 200 (미들웨어 레이어는 통과)', async () => {
    vi.stubEnv('KO_GATE_TOKEN', 'secret-token-abc');

    const req = makeFakeRequest({
      pathname: '/',
      cookieValue: 'secret-token-abd', // 마지막 글자만 다름
    });
    // @ts-expect-error — duck-typed fake request
    const res = middleware(req);

    // 게이트 해제 → middleware 는 intl 위임. 잘못된 토큰 = request.ts G1-a 에서 ko 스왑 0.
    expect(res.status).toBe(200);
  });
});
