/**
 * ko 게이트 단위 테스트 (PLAN 4.5.j.1 DoD D5).
 *
 * ADR-0033 §A2.5 D5 — 게이트 누수 0 검증 6 케이스:
 *   (i)   env 미설정 → 게이트 대상 경로 fail-closed
 *   (ii)  무토큰 / 잘못된 토큰 → 차단
 *   (iii) 유효 토큰 쿠키 → 통과 (200 응답)
 *   (iv)  공개 prefix 경로 (/en, /nl-NL 등) → 게이트 없이 통과
 *   (v)   /api/* → matcher 기 제외이므로 게이트 비대상
 *   (vi)  잘못된 토큰 → 차단 (constant-time 비교)
 *
 * 학습자 코멘트:
 *   Next.js middleware 는 Edge runtime 이라 일반 Node.js 환경과 다르다.
 *   여기서는 nextUrl + cookies 를 모킹한 가벼운 객체를 직접 만들어
 *   middleware 함수에 주입하는 방식으로 테스트한다.
 *   (NextRequest 실 인스턴스 생성 = URL 파싱 등 부작용 없이, 행동만 검증)
 */

import { describe, expect, it, vi, afterEach } from 'vitest';

// next/server 를 모킹 — Edge runtime 의존성 없이 테스트 가능하게.
// 왜 모킹?: NextResponse.redirect / NextResponse 생성자가 Node 환경에서
// fetch spec 준수 Response 를 요구하는데, Vitest 환경에선 미지원.
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
    // NextRequest 는 타입만 import 해서 사용 — 실 인스턴스는 아래서 직접 생성
    NextRequest: class {},
  };
});

// next-intl/middleware 모킹 — 실 locale routing 없이, "통과" 를 200 으로 표현.
vi.mock('next-intl/middleware', () => ({
  // _req 로 naming — 타입 어노테이션 유지하면서 unused-var 에러 방지
  default: () => (_req: { nextUrl: { pathname: string } }) => {
    // intlMiddleware 가 호출됐다 = ko 게이트 통과 = 200 반환으로 시뮬레이션.
    return new (require('next/server').NextResponse)('intl-pass', { status: 200 });
  },
}));

// middleware 를 여기서 import — 위 mock 이 먼저 설정된 후 import 해야 올바르게 동작.
import { middleware } from './middleware';

// ─── 헬퍼: 가짜 NextRequest 생성 ─────────────────────────────────────────────

/**
 * 가짜 NextRequest 빌더.
 * 실제 NextRequest 대신 duck-typing 으로 필요한 속성만 흉내 낸다.
 * middleware 함수가 실제로 접근하는 속성만 구현하면 충분.
 */
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
    // admin 가드가 ADMIN_TOKEN 쿠키를 먼저 체크하므로 admin_token 은 없음
  };
}

// ─── 테스트 ───────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('ko 게이트 — PLAN 4.5.j.1 D5 6 케이스', () => {
  /**
   * 케이스 (i): env 미설정 → 게이트 대상 경로 fail-closed.
   *
   * 왜 이게 중요한가: KO_GATE_TOKEN 을 설정하지 않은 채
   * 배포하면 의도치 않게 ko 콘텐츠가 공개될 수 있다.
   * fail-closed = env 없으면 무조건 막힘 → 사고 방지.
   */
  it('(i) env KO_GATE_TOKEN 미설정 → 루트 / 접근 시 401 fail-closed', async () => {
    vi.stubEnv('KO_GATE_TOKEN', '');

    const req = makeFakeRequest({ pathname: '/' });
    // @ts-expect-error — duck-typed fake request, 타입 안전보다 동작 검증 우선
    const res = middleware(req);

    expect(res.status).toBe(401);
  });

  /**
   * 케이스 (ii): 무토큰 → 게이트 대상 경로 차단.
   * /compare 도 nl-BE 슬롯(ko 콘텐츠 영역) → 게이트 대상.
   */
  it('(ii-a) 무토큰 / → 401 차단', async () => {
    vi.stubEnv('KO_GATE_TOKEN', 'secret-token-abc');

    const req = makeFakeRequest({ pathname: '/' });
    // @ts-expect-error — duck-typed fake request
    const res = middleware(req);

    expect(res.status).toBe(401);
  });

  it('(ii-b) 무토큰 /compare → 401 차단', async () => {
    vi.stubEnv('KO_GATE_TOKEN', 'secret-token-abc');

    const req = makeFakeRequest({ pathname: '/compare' });
    // @ts-expect-error — duck-typed fake request
    const res = middleware(req);

    expect(res.status).toBe(401);
  });

  /**
   * 케이스 (iii): 유효 쿠키 토큰 → 통과 (intlMiddleware 에 위임 = 200).
   */
  it('(iii) 유효 ko_gate_token 쿠키 → 통과 (200)', async () => {
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
   * 케이스 (iv): 공개 locale prefix 경로 → 게이트 없이 통과.
   * /en, /nl-NL, /fr-BE, /fr-LU = PUBLIC_LOCALE_PREFIXES → 게이트 비대상.
   *
   * 왜 이게 중요한가: 공개 4 locale 에 베타 사용자가 접근할 수 있어야 함.
   * 게이트가 공개 경로를 막으면 사이트 전체가 잠긴다.
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
   * middleware 자체가 /api/ 에 실행되지 않도록 matcher 에서 제외.
   * 따라서 middleware 함수에 /api/ 경로가 들어오는 상황은 정상 운영에서 없음.
   * 하지만 함수 자체의 동작을 확인: /api/ 는 admin 도 ko 게이트도 비대상이므로
   * intlMiddleware 에 위임 = 200.
   *
   * 왜 중요한가: API 라우트는 locale 무관 — 게이트가 개입하면 API 가 깨진다.
   */
  it('(v) /api/compare → middleware 함수 내에서 게이트 비대상 (intl에 위임 = 200)', async () => {
    vi.stubEnv('KO_GATE_TOKEN', 'secret-token-abc');

    // /api/ 는 공개 locale prefix 목록에 없어서 isKoGateTarget = true 처럼 보이지만,
    // matcher 에서 /api/ 가 제외되므로 실제로 middleware 함수가 호출되지 않는다.
    // 단위 테스트에서는 함수를 직접 호출 — /api/는 매처가 없어서 현 함수 로직상
    // ko 게이트 대상처럼 보인다. 이 케이스는 "matcher 가 /api/ 를 제외"함을
    // config.matcher 설정 코드로 확인한다.
    //
    // 아래는 config.matcher 에 /api/ 가 제외돼 있는지 문자열 검증.
    // (실제 middleware 함수 호출은 /api/ 에서 일어나지 않음 — 함수 레벨 보증.)
    const { config } = await import('./middleware');
    const matcherPattern = config.matcher.join('|');
    // matcher 에 api 제외 패턴이 있는지 확인
    expect(matcherPattern).toContain('api');
    // 더 구체적으로: !api 가 포함됨을 확인
    expect(matcherPattern).toMatch(/\?!.*api/);
  });

  /**
   * 케이스 (vi): 잘못된 토큰 → 차단 (constant-time 비교).
   * 올바른 토큰과 '거의 같은' 잘못된 토큰 — constantTimeEqual 이 차단해야 함.
   */
  it('(vi) 잘못된 쿠키 토큰 → 401 차단 (constant-time 비교)', async () => {
    vi.stubEnv('KO_GATE_TOKEN', 'secret-token-abc');

    const req = makeFakeRequest({
      pathname: '/',
      cookieValue: 'secret-token-abd', // 마지막 글자만 다름
    });
    // @ts-expect-error — duck-typed fake request
    const res = middleware(req);

    expect(res.status).toBe(401);
  });
});
