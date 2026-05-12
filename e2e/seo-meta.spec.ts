/**
 * SEO 메타 / sitemap / robots e2e 스모크 — PLAN 3.5.2.e.
 *
 * 4 그룹으로 구성:
 *   1. 색인 대상 라우트 — canonical 존재 + noindex 부재
 *   2. 색인 금지 라우트 — <meta name="robots" content*="noindex"> 존재
 *   3. /sitemap.xml — status 200 + XML + /r/ URL 부재 + 색인 대상 URL 존재
 *   4. /robots.txt — status 200 + Sitemap: 라인 + Disallow: /r/ + Disallow: /api/
 *
 * 새 dep 0 — Playwright 기본 request 픽스처 + page 사용.
 * (ADR-0021 §T8, PLAN 3.5.2.c, PLAN 3.5.2.d 근거)
 *
 * 학습자 메모:
 *   - page.locator('link[rel="canonical"]') — <head> 안의 canonical link 선택.
 *   - page.locator('meta[name="robots"]') — Next.js 가 robots: {index:false} 로
 *     설정 시 생성하는 meta 태그. content 에 "noindex" 포함 여부로 판단.
 *   - request.get('/sitemap.xml') — 페이지 탐색 없이 HTTP GET 만 수행 (빠름).
 *   - canonical href 가 https://slim.lu/... 로 시작 — metadataBase 가 절대 URL 변환
 *     을 보장하는지 검증하는 핵심 케이스.
 */

import { expect, test } from '@playwright/test';

// ─── 1. 색인 대상 라우트 ──────────────────────────────────────────────────────

/**
 * 색인 대상 라우트 목록 (직접 방문 시 canonical 이 <head> 에 노출되는 라우트).
 * 각 라우트는:
 *   - <link rel="canonical"> 가 <head> 에 존재해야 한다.
 *   - canonical href 가 https://slim.lu 로 시작해야 한다 (절대 URL — metadataBase 검증).
 *   - <meta name="robots"> 가 없거나, 있어도 content 에 "noindex" 가 없어야 한다.
 *
 * 왜 /compare/mobile 과 /compare/internet_fixed 가 여기에 없는가?
 *   /compare/[category]/page.tsx 는 서버 사이드에서 즉시 redirect('/compare/${category}/postal') 를 실행한다.
 *   Playwright 가 redirect 를 따라가면 /compare/mobile/postal 의 head 가 렌더되고,
 *   postal 은 layout.tsx 에 robots: {index:false} 가 있으므로 canonical 이 없고 noindex 가 있다.
 *   → 색인 대상 라우트 테스트로 검증 불가 (redirect 이후 DOM 이 postal 단계 기준).
 *   sitemap 에는 포함 (검색엔진은 canonical redirect 를 따라가므로 문제없음),
 *   e2e 검증은 sitemap 내 URL 존재 여부로 대신한다 (그룹 3 참조).
 */
const INDEXABLE_ROUTES = [
  { path: '/', label: '홈' },
  { path: '/compare', label: '카테고리 선택' },
  { path: '/data-sources', label: '데이터 출처' },
  { path: '/legal/affiliate-disclosure', label: '제휴 수수료 공개' },
] as const;

test.describe('1. 색인 대상 라우트 — canonical 존재 + noindex 부재', () => {
  for (const route of INDEXABLE_ROUTES) {
    test(`[색인 대상] ${route.path} (${route.label})`, async ({ page }) => {
      await page.goto(route.path);

      // canonical link 존재 확인
      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);

      // canonical href 가 절대 URL (https://slim.lu 시작) 인지 확인
      // 왜 이게 중요한가: metadataBase 가 없으면 상대 URL 이 그대로 출력 → 검색엔진 무시.
      const href = await canonical.getAttribute('href');
      expect(href).toBeTruthy();
      expect(href!.startsWith('https://slim.lu')).toBe(true);

      // noindex 부재 확인 — meta name="robots" 자체가 없거나,
      // 있어도 content 에 "noindex" 가 포함되지 않아야 한다.
      const robotsMeta = page.locator('meta[name="robots"]');
      const robotsCount = await robotsMeta.count();
      if (robotsCount > 0) {
        const content = await robotsMeta.getAttribute('content');
        // noindex 가 있으면 테스트 실패 — 색인 대상 페이지가 noindex 를 가져선 안 됨.
        expect(content ?? '').not.toContain('noindex');
      }
      // robotsCount === 0 이면 OK (meta robots 태그 없음 = 색인 허용 기본값).
    });
  }
});

// ─── 2. 색인 금지 라우트 ──────────────────────────────────────────────────────

/**
 * 색인 금지 라우트 목록.
 * 각 라우트는 <meta name="robots"> content 에 "noindex" 가 포함돼야 한다.
 *
 * 왜 이 라우트들인가?
 *   - /compare/mobile/{postal,household,current-provider,bill,preview}:
 *     입력 폼 단계 — sessionStorage 상태 의존. PLAN 3.5.2.c, ADR-0021 §T8.
 *   - /r/abc123def456:
 *     형식상 valid 한 shortId (12자 영숫자). DB 에 없으면 404 not-found 페이지가 뜨는데,
 *     그 페이지도 노출 콘텐츠가 없으므로 noindex 이어야 한다.
 *     (실 shortId 가 있으면 /r/[shortId] 결과 페이지 — ADR-0021 §T8 generateMetadata 로 noindex)
 *
 * 왜 /compare/mobile 를 썼나?
 *   /compare/[category]/{step} 는 mobile 카테고리 기준으로 테스트 (가장 안전한 known 카테고리).
 */
const NOINDEX_ROUTES = [
  { path: '/compare/mobile/postal', label: '우편번호 입력 (mobile)' },
  { path: '/compare/mobile/household', label: '가구 형태 선택 (mobile)' },
  { path: '/compare/mobile/current-provider', label: '현재 공급사 선택 (mobile)' },
  { path: '/compare/mobile/bill', label: '요금 입력 (mobile)' },
  { path: '/compare/mobile/preview', label: '비교 결과 로딩 중 (mobile)' },
  { path: '/r/abc123def456', label: '/r/[shortId] placeholder (DB 미존재 → 404)' },
] as const;

test.describe('2. 색인 금지 라우트 — noindex 존재', () => {
  for (const route of NOINDEX_ROUTES) {
    test(`[색인 금지] ${route.path} (${route.label})`, async ({ page }) => {
      await page.goto(route.path);

      // <meta name="robots"> 가 최소 1개 존재해야 한다.
      // 왜 toHaveCount(1) 이 아닌 gte(1) 인가?
      //   Next.js 가 상위 layout + 현재 page 에서 각각 robots meta 를 생성하면
      //   (예: /r/[shortId] not-found 페이지) 2개가 렌더될 수 있다.
      //   중요한 것은 최소 1개가 noindex 를 포함하느냐이다.
      const robotsMeta = page.locator('meta[name="robots"]');
      const count = await robotsMeta.count();
      expect(count).toBeGreaterThanOrEqual(1);

      // 모든 robots meta 중 하나라도 "noindex" 를 포함해야 한다.
      const contents = await Promise.all(
        Array.from({ length: count }, (_, i) =>
          robotsMeta.nth(i).getAttribute('content'),
        ),
      );
      const hasNoindex = contents.some((c) => (c ?? '').includes('noindex'));
      expect(hasNoindex).toBe(true);
    });
  }
});

// ─── 3. /sitemap.xml ─────────────────────────────────────────────────────────

/**
 * /sitemap.xml 검증.
 *
 * 왜 request 픽스처를 쓰는가?
 *   page.goto('/sitemap.xml') 는 XML 을 브라우저로 렌더링 → DOM 파싱이 필요해진다.
 *   request.get('/sitemap.xml') 은 순수 HTTP 응답 body 를 텍스트로 직접 얻음 → 단순하고 빠르다.
 *
 * 검증 항목:
 *   1. status 200 — sitemap 이 실제로 서빙됨.
 *   2. Content-Type XML — Next.js 가 올바른 MIME 으로 제공함.
 *   3. <urlset 포함 — sitemap XML 기본 루트 엘리먼트.
 *   4. /r/ URL 부재 — 개인 비교 결과가 sitemap 에 노출되지 않음 (ADR-0021 §T8).
 *   5. https://slim.lu/ URL 존재 — 홈이 색인 대상으로 포함됨.
 */
test.describe('3. /sitemap.xml — 구조 + /r/ 제외 검증', () => {
  test('status 200 + XML + /r/ 부재 + 색인 대상 URL 존재', async ({ request }) => {
    const res = await request.get('/sitemap.xml');

    // 1. HTTP 200
    expect(res.status()).toBe(200);

    // 2. Content-Type — XML 이어야 한다 ('application/xml' 또는 'text/xml').
    const contentType = res.headers()['content-type'] ?? '';
    expect(contentType).toContain('xml');

    const body = await res.text();

    // 3. <urlset — sitemap XML 루트 엘리먼트
    expect(body).toContain('<urlset');

    // 4. /r/ URL 부재 — 개인 비교 결과는 sitemap 에 절대 포함되지 않음.
    //    왜 중요한가: 사용자별 비교 결과 URL 이 노출되면 개인정보 + 무의미한 크롤링.
    expect(body).not.toContain('/r/');

    // 5. 홈 URL 존재 — 가장 기본적인 색인 대상.
    expect(body).toContain('<loc>https://slim.lu/</loc>');

    // 6. 알려진 카테고리 비교 진입 URL 존재.
    //    /compare/[category] 는 서버에서 /compare/[category]/postal 로 redirect 하므로
    //    e2e 페이지 방문으로는 canonical 을 검증할 수 없다.
    //    sitemap 에 포함 여부로 대신 검증한다.
    expect(body).toContain('<loc>https://slim.lu/compare/mobile</loc>');
    expect(body).toContain('<loc>https://slim.lu/compare/internet_fixed</loc>');
  });
});

// ─── 4. /robots.txt ──────────────────────────────────────────────────────────

/**
 * /robots.txt 검증.
 *
 * 검증 항목:
 *   1. status 200 — robots.txt 가 실제로 서빙됨.
 *   2. Sitemap: https://slim.lu/sitemap.xml — 크롤러에게 sitemap 위치 명시.
 *   3. Disallow: /r/ — 개인 비교 결과 크롤링 금지 (ADR-0021 §T8).
 *   4. Disallow: /api/ — API route 크롤링 금지.
 *
 * 왜 Sitemap 라인이 중요한가?
 *   크롤러가 robots.txt 에서 Sitemap 을 발견하면 별도 등록 없이 sitemap 을 수집한다.
 *   Google Search Console 에 수동 등록하지 않아도 크롤러가 자동 발견.
 */
test.describe('4. /robots.txt — Sitemap 라인 + Disallow 패턴 검증', () => {
  test('status 200 + Sitemap 라인 + Disallow: /r/ + Disallow: /api/', async ({ request }) => {
    const res = await request.get('/robots.txt');

    // 1. HTTP 200
    expect(res.status()).toBe(200);

    const body = await res.text();

    // 2. Sitemap 라인 — 크롤러에게 sitemap 위치 명시
    expect(body).toContain('Sitemap: https://slim.lu/sitemap.xml');

    // 3. Disallow: /r/ — 개인 비교 결과 크롤링 차단
    expect(body).toContain('Disallow: /r/');

    // 4. Disallow: /api/ — API route 크롤링 차단
    expect(body).toContain('Disallow: /api/');
  });
});
