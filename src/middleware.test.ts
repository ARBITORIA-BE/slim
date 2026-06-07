/**
 * middleware deprecated locale redirect 단위 테스트 (PLAN 4.15.b DoD).
 *
 * 검증 범위 (ADR-0033 Amd 6 §A6.4 옵션 X.1):
 *   DEPRECATED_LOCALE_MAP 4건 → 301 redirect + Location 헤더 정확 매핑.
 *   en 등 현행 locale → redirect 없음 (pass-through).
 *   searchParams 보존 — ?utm=test 같은 쿼리가 redirect 후에도 유지됨.
 *
 * 왜 middleware 직접 호출 + mock NextRequest 인가:
 *   Edge runtime 의존성(next/server) 을 Node.js 테스트 환경에서 실행하려면
 *   mock 이 필요. middleware.ko-gate.test.ts 의 기존 패턴을 그대로 재사용.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';

// next/server 모킹 — middleware.ko-gate.test.ts 와 동일 패턴.
// NextResponse.redirect 가 301 status 를 지원하도록 확장.
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

    // redirect 는 URL + 선택적 init({ status }) 를 받음.
    // 301 을 지원하기 위해 init 을 받아 status 를 설정.
    static redirect(url: URL | string | { toString(): string }, init?: { status?: number }) {
      const status = init?.status ?? 307;
      const res = new MockNextResponse('', { status });
      res.headers.set('location', url.toString());
      return res;
    }
  };

  return {
    NextResponse: MockNextResponse,
    NextRequest: class {},
  };
});

// next-intl/middleware 모킹 — "통과" = 200.
vi.mock('next-intl/middleware', () => ({
  default: () => (_req: { nextUrl: { pathname: string } }) => {
    return new (require('next/server').NextResponse)('intl-pass', { status: 200 });
  },
}));

import { middleware } from './middleware';

// ─── 헬퍼: 가짜 NextRequest 생성 ─────────────────────────────────────────────

/**
 * makeFakeRequest: duck-typed NextRequest 생성.
 * searchParams 도 함께 넘겨 redirect 후 Location 헤더에 반영되는지 확인 가능.
 */
function makeFakeRequest({
  pathname,
  search = '',
}: {
  pathname: string;
  search?: string; // '?utm=test' 형태 포함 쿼리 문자열
}) {
  const base = 'https://slim.be';
  const fullUrl = `${base}${pathname}${search}`;
  const urlObj = new URL(fullUrl);

  return {
    nextUrl: {
      pathname,
      searchParams: urlObj.searchParams,
      clone() {
        // clone 은 pathname 변경 가능한 URL-like 객체 반환.
        // middleware 가 target.pathname = newPathname 을 설정하면
        // toString() 이 갱신된 URL 을 반환해야 한다.
        let _pathname = pathname;
        const cloned = {
          get pathname() {
            return _pathname;
          },
          set pathname(v: string) {
            _pathname = v;
          },
          searchParams: new URLSearchParams(urlObj.searchParams.toString()),
          toString() {
            const sp = this.searchParams.toString();
            return `${base}${_pathname}${sp ? `?${sp}` : ''}`;
          },
        };
        return cloned;
      },
      toString() {
        return fullUrl;
      },
    },
    cookies: {
      get(_name: string) {
        return undefined; // redirect 테스트에서는 쿠키 불필요
      },
    },
  };
}

// ─── 테스트 ───────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('deprecated locale prefix 301 redirect — ADR-0033 Amd 6 §A6.4', () => {
  /**
   * nl-BE → 무프리픽스 nl 슬롯.
   * 왜 301 인가: SEO link equity 를 신 URL(/compare) 로 완전 이전.
   */
  it('/nl-BE/compare → 301 /compare', () => {
    const req = makeFakeRequest({ pathname: '/nl-BE/compare' });
    // @ts-expect-error — duck-typed fake request
    const res = middleware(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://slim.be/compare');
  });

  it('/nl-NL/compare → 301 /compare', () => {
    const req = makeFakeRequest({ pathname: '/nl-NL/compare' });
    // @ts-expect-error — duck-typed fake request
    const res = middleware(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://slim.be/compare');
  });

  it('/fr-BE/compare → 301 /fr/compare', () => {
    const req = makeFakeRequest({ pathname: '/fr-BE/compare' });
    // @ts-expect-error — duck-typed fake request
    const res = middleware(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://slim.be/fr/compare');
  });

  it('/fr-LU/compare → 301 /fr/compare', () => {
    const req = makeFakeRequest({ pathname: '/fr-LU/compare' });
    // @ts-expect-error — duck-typed fake request
    const res = middleware(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://slim.be/fr/compare');
  });

  /**
   * 경로 끝 (rest 없음) — /nl-BE 단독 → /
   */
  it('/nl-BE (경로 끝) → 301 /', () => {
    const req = makeFakeRequest({ pathname: '/nl-BE' });
    // @ts-expect-error — duck-typed fake request
    const res = middleware(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://slim.be/');
  });

  it('/fr-LU (경로 끝) → 301 /fr', () => {
    const req = makeFakeRequest({ pathname: '/fr-LU' });
    // @ts-expect-error — duck-typed fake request
    const res = middleware(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://slim.be/fr');
  });

  /**
   * searchParams 보존 — ?utm=test 가 redirect Location 에 포함돼야 함.
   * 왜 중요한가: 마케팅 트래킹 파라미터가 redirect 에서 소실되면
   * 어트리뷰션 데이터가 깨짐 (ADR-0033 Amd 6 §A6.8 searchParams 보존).
   */
  it('/fr-BE/compare?utm=test → 301 /fr/compare?utm=test (searchParams 보존)', () => {
    const req = makeFakeRequest({ pathname: '/fr-BE/compare', search: '?utm=test' });
    // @ts-expect-error — duck-typed fake request
    const res = middleware(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://slim.be/fr/compare?utm=test');
  });

  /**
   * 현행 locale prefix — redirect 없음 (200 intl 위임).
   * en 은 DEPRECATED_LOCALE_MAP 에 없으므로 pass-through.
   */
  it('/en/compare → redirect 없음 (200, intl 위임)', () => {
    const req = makeFakeRequest({ pathname: '/en/compare' });
    // @ts-expect-error — duck-typed fake request
    const res = middleware(req);

    expect(res.status).toBe(200);
  });

  it('/fr/compare → redirect 없음 (200, intl 위임)', () => {
    const req = makeFakeRequest({ pathname: '/fr/compare' });
    // @ts-expect-error — duck-typed fake request
    const res = middleware(req);

    expect(res.status).toBe(200);
  });

  it('/compare → redirect 없음 (200, nl 무프리픽스 슬롯)', () => {
    const req = makeFakeRequest({ pathname: '/compare' });
    // @ts-expect-error — duck-typed fake request
    const res = middleware(req);

    expect(res.status).toBe(200);
  });
});
