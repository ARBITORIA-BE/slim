/**
 * Telenet 실 스크래핑 fetcher 단위 테스트 (PLAN 1.5.6 + PLAN 4.26.a)
 *
 * 외부 호출 0 — global.fetch를 vi.fn()으로 모킹.
 * 케이스:
 *   (a) 정상 HTML → mobile 요금제 파싱 + method='scraping' + stub===false
 *   (b) HTTP 403 → ok:false kind:'network'
 *   (c) 빈 HTML (셀렉터 0 매칭) → ok:false kind:'parse'
 *   (d) STUB_FAIL_TELENET=1 → ok:false kind:'network' (1.9 격리)
 *   (e) 챌린지 페이지 → ok:false kind:'network'
 *   (f) bundle 페이지 정상 → bundle_mobile_internet_tv 파싱 (PLAN 4.26.a)
 *   (g) mobile 실패 + bundle 성공 → 페이지 단위 degrade (ok:true, bundle만)
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { telenet } from './telenet';

// ─── 최소 fixture HTML — mobile ──────────────────────────────────────────
//
// 실제 Telenet mobile 페이지 구조 기반 최소 마크업.
// price=0 카드(조합 전용) 2개 + 실제 모바일 요금제 카드 2개.
// 가격은 tg-lazy-loading-standalone inputs의 customProduct.price로 존재.

const FIXTURE_MOBILE_HTML = `<!DOCTYPE html>
<html lang="nl">
<head><title>Mobiel - Telenet</title></head>
<body>
<!-- 카드 1: Basic 조합 가격 (price=0, skip 대상) -->
<div class="cmp-product-summary">
  <div class="product-summary">
    <h3 class="heading--4">Basic</h3>
    <div data-tg-cmp-is="title" class="heading--3"><b>15 GB data</b></div>
    <p>In combinatie met internet Nu vanaf € 56 per maand</p>
    <tg-lazy-loading-standalone
      component-id="tg-marketing-cafe-pricing"
      inputs='{"productCategory":"customProducts","customProduct":{"duration":"0","promoPrice":"","endDate":"","price":"0","startDate":""}}'
    ></tg-lazy-loading-standalone>
  </div>
</div>

<!-- 카드 2: Unlimited 조합 가격 (price=0, skip 대상) -->
<div class="cmp-product-summary">
  <div class="product-summary">
    <h3 class="heading--4">Unlimited</h3>
    <div data-tg-cmp-is="title" class="heading--3"><b>Unlimited data</b></div>
    <p>In combinatie met internet Nu vanaf € 56 per maand</p>
    <tg-lazy-loading-standalone
      component-id="tg-marketing-cafe-pricing"
      inputs='{"productCategory":"customProducts","customProduct":{"duration":"0","promoPrice":"","endDate":"","price":"0","startDate":""}}'
    ></tg-lazy-loading-standalone>
  </div>
</div>

<!-- 카드 3: Mobile Basic 단독 (price=21) -->
<div class="cmp-product-summary">
  <div class="product-summary">
    <h3 class="heading--4">Basic</h3>
    <div data-tg-cmp-is="title" class="heading--3"><b>15 GB data</b></div>
    <p>Voor basisgebruik zoals surfen</p>
    <tg-lazy-loading-standalone
      component-id="tg-marketing-cafe-pricing"
      inputs='{"productCategory":"customProducts","customProduct":{"duration":"0","promoPrice":"","endDate":"","price":"21","startDate":""}}'
    ></tg-lazy-loading-standalone>
  </div>
</div>

<!-- 카드 4: Mobile Unlimited 단독 (price=41) -->
<div class="cmp-product-summary">
  <div class="product-summary">
    <h3 class="heading--4">Unlimited</h3>
    <div data-tg-cmp-is="title" class="heading--3"><b>Unlimited data</b></div>
    <p>Voor wie zorgeloos en zonder limieten wil</p>
    <tg-lazy-loading-standalone
      component-id="tg-marketing-cafe-pricing"
      inputs='{"productCategory":"customProducts","customProduct":{"duration":"","promoPrice":"","endDate":"","price":"41","startDate":""}}'
    ></tg-lazy-loading-standalone>
  </div>
</div>
</body>
</html>`;

// ─── 최소 fixture HTML — bundle (PLAN 4.26.a, 실 HTML 구조 2026-08-19 기준) ─
//
// 2개 티어(200 Mbps / 500 Mbps) + 각 티어의 중복 렌더 카드(동일 가격 JSON,
// 다른 마케팅 카피) — 실측에서 관찰된 dedupe 대상 패턴 재현.

const FIXTURE_BUNDLE_HTML = `<!DOCTYPE html>
<html lang="nl">
<head><title>Internet + Mobiel + TV - Telenet</title></head>
<body>
<!-- 티어 1: 200 Mbps, 프로모 있음 (표준 €86, 프로모 €71 × 12개월) -->
<div class="cmp-product-summary">
  <div class="product-summary">
    Internet + Mobiel + TV met 200 Mbps + streamingcadeau
    200 Mbps max. downloadsnelheid 20 Mbps max. uploadsnelheid
    15 GB mobiele data
    Telenet TV-box met meer dan 90 tv-zenders
    <tg-lazy-loading-standalone
      component-id="tg-marketing-cafe-pricing"
      inputs='{"productCategory":"customProducts","customProduct":{"duration":"12","promoPrice":"71","endDate":"9 Feb 2027","price":"86","startDate":"9 Feb 2026"}}'
    ></tg-lazy-loading-standalone>
  </div>
</div>

<!-- 티어 1 중복 렌더 (동일 가격, "15GB of Unlimited" 카피) — dedupe 대상 -->
<div class="cmp-product-summary">
  <div class="product-summary">
    Internet + Mobiel + TV met 200 Mbps + streamingcadeau
    200 Mbps max. downloadsnelheid 20 Mbps max. uploadsnelheid
    15 GB of Unlimited mobiele data
    <tg-lazy-loading-standalone
      component-id="tg-marketing-cafe-pricing"
      inputs='{"productCategory":"customProducts","customProduct":{"duration":"12","promoPrice":"71","endDate":"9 Feb 2027","price":"86","startDate":"9 Feb 2026"}}'
    ></tg-lazy-loading-standalone>
  </div>
</div>

<!-- 티어 2: 500 Mbps, 프로모 없음 (price=95, promoPrice 빈 문자열) -->
<div class="cmp-product-summary">
  <div class="product-summary">
    Internet + Mobiel + TV met 500 Mbps + streamingcadeau
    500 Mbps max. downloadsnelheid 30 Mbps max. uploadsnelheid
    15 GB mobiele data
    <tg-lazy-loading-standalone
      component-id="tg-marketing-cafe-pricing"
      inputs='{"productCategory":"customProducts","customProduct":{"duration":"","promoPrice":"","endDate":"","price":"95","startDate":""}}'
    ></tg-lazy-loading-standalone>
  </div>
</div>

<p>Altijd inbegrepen: Onbeperkt bellen en sms'en. Meer dan 90 tv-zenders.</p>
</body>
</html>`;

const FIXTURE_HTML_EMPTY = `<!DOCTYPE html>
<html lang="nl"><head><title>Mobiel</title></head><body><p>Geen producten</p></body></html>`;

const FIXTURE_HTML_CHALLENGE = `<!DOCTYPE html>
<html><head><title>Just a moment...</title></head><body><p>Just a moment</p></body></html>`;

// ─── fetch 모킹 헬퍼 ─────────────────────────────────────────────────────

function makeMockResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

/**
 * mobile / bundle 두 URL에 각각 다른 응답을 주는 fetch mock.
 * 매 호출마다 새 Response 인스턴스를 반환 — Response.text()는 1회만 읽을 수
 * 있어 동일 인스턴스를 재사용하면 "Body has already been read" 에러가 난다.
 */
function mockTwoPages(mobileFactory: () => Response, bundleFactory: () => Response): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url.includes('mobiel.html')) return Promise.resolve(mobileFactory());
    return Promise.resolve(bundleFactory());
  });
}

// ─── afterEach: 환경변수 정리 + 모킹 초기화 ──────────────────────────────
afterEach(() => {
  delete process.env['STUB_FAIL_TELENET'];
  vi.restoreAllMocks();
});

// ─── 1. metadata 검증 ────────────────────────────────────────────────────
describe('TelenetFetcher — metadata', () => {
  it('method=scraping으로 변경됨 (1.5.6 전환 완료)', () => {
    expect(telenet.metadata.method).toBe('scraping');
  });

  it('FetcherMetadata 필수 필드 모두 존재 (ADR-0008 §T5)', () => {
    const { metadata } = telenet;
    expect(metadata.providerSlug).toBe('telenet-be');
    expect(metadata.displayName).toBe('Telenet');
    expect(metadata.country).toBe('BE');
    expect(metadata.version).toMatch(/^telenet-be@\d{4}-\d{2}-\d{2}$/);
    expect(metadata.homepageUrl).toBe('https://www.telenet.be');
  });

  it('categories에 mobile + bundle_mobile_internet_tv 포함 (PLAN 4.26.a)', () => {
    expect(telenet.metadata.categories).toEqual(['mobile', 'bundle_mobile_internet_tv']);
  });
});

// ─── 2. 정상 HTML → mobile 요금제 파싱 ──────────────────────────────────
describe('TelenetFetcher — fetch() 정상 케이스 (mobile)', () => {
  beforeEach(() => {
    // bundle 페이지는 빈 HTML로 모킹 — mobile 단독 검증에 bundle 노이즈 배제
    mockTwoPages(
      () => makeMockResponse(200, FIXTURE_MOBILE_HTML),
      () => makeMockResponse(200, FIXTURE_HTML_EMPTY),
    );
  });

  it('FetchOutcome.ok=true + FetchResult 모양 검증', async () => {
    const outcome = await telenet.fetch();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error('ok=true 기대, false 반환됨');

    const { result } = outcome;
    expect(result.fetcherSlug).toBe('telenet-be');
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('price>0인 카드만 반환 — 조합 전용(price=0) 카드 제외', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    // 4개 카드 중 price>0인 카드는 2개 (Basic=21, Unlimited=41). bundle=0.
    expect(outcome.result.data.length).toBe(2);
  });

  it('모든 tariff가 category=mobile', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    for (const tariff of outcome.result.data) {
      expect(tariff.category).toBe('mobile');
    }
  });

  it('모든 tariff providerSlug=telenet-be', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    for (const tariff of outcome.result.data) {
      expect(tariff.providerSlug).toBe('telenet-be');
    }
  });

  it('가격이 cents 정수로 정확히 변환됨 (€21 → 2100, €41 → 4100)', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    const prices = outcome.result.data.map((t) => t.monthlyPriceCents);
    expect(prices).toContain(2100); // €21
    expect(prices).toContain(4100); // €41
  });

  it('rawPayload.stub===false (BetaEstimatedBanner 1.5.6.1 자동 비활성 신호)', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    for (const tariff of outcome.result.data) {
      expect(tariff.rawPayload['stub']).toBe(false);
    }
  });

  it('rawPayload에 fetcher_version, url, fetched_at, http 포함 (ADR-0006 §T3)', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    const payload = outcome.result.data[0]?.rawPayload;
    expect(payload?.['fetcher_version']).toContain('telenet-be');
    expect(payload?.['url']).toContain('telenet.be');
    expect(payload?.['fetched_at']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(payload?.['http']).toBeDefined();
  });

  it('mobile attributes에 mobileAttributesSchema 호환 키 포함', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    for (const tariff of outcome.result.data) {
      const attrs = tariff.attributes;
      expect('data_gb' in attrs).toBe(true);
      expect('voice_minutes' in attrs).toBe(true);
      expect('sms' in attrs).toBe(true);
      expect('eu_roaming_included' in attrs).toBe(true);
    }
  });

  it('Basic 카드: data_gb=15, Unlimited 카드: data_gb="unlimited"', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    const basic = outcome.result.data.find((t) => t.tariffName.includes('Basic'));
    const unlimited = outcome.result.data.find((t) => t.tariffName.includes('Unlimited'));

    expect(basic?.attributes['data_gb']).toBe(15);
    expect(unlimited?.attributes['data_gb']).toBe('unlimited');
  });

  it('confidence는 high 또는 medium (price 파싱 성공 + sanity pass)', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    for (const tariff of outcome.result.data) {
      expect(['high', 'medium']).toContain(tariff.confidence);
    }
  });

  it('modemRentalCents=null (모바일 — 모뎀 임대 개념 없음)', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    for (const tariff of outcome.result.data) {
      expect(tariff.modemRentalCents).toBeNull();
    }
  });

  it('sourceUrl이 실 Telenet mobile URL (P1 정보 우선)', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    for (const tariff of outcome.result.data) {
      expect(tariff.sourceUrl).toMatch(/telenet\.be.*mobiel/);
    }
  });
});

// ─── 3. HTTP 403 → ok:false kind:'network' ───────────────────────────────
describe('TelenetFetcher — HTTP 403 에러 (양 페이지)', () => {
  it('HTTP 403 → FetchOutcome.ok=false kind=network (B.5)', async () => {
    mockTwoPages(
      () => makeMockResponse(403, 'Forbidden'),
      () => makeMockResponse(403, 'Forbidden'),
    );

    const outcome = await telenet.fetch();
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('ok=false 기대');

    expect(outcome.error.fetcherSlug).toBe('telenet-be');
    expect(outcome.error.kind).toBe('network');
    expect(outcome.error.message).toContain('403');
  });
});

// ─── 4. 빈 HTML → ok:false kind:'parse' ──────────────────────────────────
describe('TelenetFetcher — 셀렉터 0 매칭 (구조 변경, 양 페이지)', () => {
  it('div.cmp-product-summary 없는 HTML → ok:false kind=parse', async () => {
    mockTwoPages(
      () => makeMockResponse(200, FIXTURE_HTML_EMPTY),
      () => makeMockResponse(200, FIXTURE_HTML_EMPTY),
    );

    const outcome = await telenet.fetch();
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('ok=false 기대');

    expect(outcome.error.kind).toBe('parse');
    expect(outcome.error.message).toContain('No tariffs parsed from any page');
    const warnings = outcome.error.rawPayload?.['warnings'];
    expect(Array.isArray(warnings) ? warnings.join(' ') : '').toContain('No mobile plans parsed');
  });
});

// ─── 5. 챌린지 페이지 → ok:false kind:'network' ─────────────────────────
describe('TelenetFetcher — 챌린지 페이지 (B.5, 양 페이지)', () => {
  it('"Just a moment" 페이지 → ok:false kind=network', async () => {
    mockTwoPages(
      () => makeMockResponse(200, FIXTURE_HTML_CHALLENGE),
      () => makeMockResponse(200, FIXTURE_HTML_CHALLENGE),
    );

    const outcome = await telenet.fetch();
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('ok=false 기대');

    expect(outcome.error.kind).toBe('network');
    expect(outcome.error.message.toLowerCase()).toContain('challenge');
  });
});

// ─── 6. STUB_FAIL_TELENET=1 → 실패 outcome (1.9 격리) ────────────────────
describe('TelenetFetcher — STUB_FAIL 환경변수 (1.9 격리)', () => {
  it('STUB_FAIL_TELENET=1 → FetchOutcome.ok=false (fetch 호출 없음)', async () => {
    process.env['STUB_FAIL_TELENET'] = '1';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const outcome = await telenet.fetch();

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('ok=false 기대');

    expect(outcome.error.fetcherSlug).toBe('telenet-be');
    expect(outcome.error.kind).toBe('network');
    expect(outcome.error.message).toContain('STUB_FAIL_TELENET');
    // STUB_FAIL 분기는 fetch 호출 전에 리턴 — 네트워크 0 확인
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ─── 7. bundle 페이지 정상 파싱 (PLAN 4.26.a) ────────────────────────────
describe('TelenetFetcher — fetch() bundle 정상 케이스', () => {
  beforeEach(() => {
    mockTwoPages(
      () => makeMockResponse(200, FIXTURE_HTML_EMPTY), // mobile 노이즈 배제
      () => makeMockResponse(200, FIXTURE_BUNDLE_HTML),
    );
  });

  it('중복 렌더 카드 dedupe — 실질 2개 티어만 반환', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');
    expect(outcome.result.data.length).toBe(2);
  });

  it('모든 bundle tariff가 category=bundle_mobile_internet_tv', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');
    for (const tariff of outcome.result.data) {
      expect(tariff.category).toBe('bundle_mobile_internet_tv');
    }
  });

  it('200Mbps 티어: monthly=8600, promo=7100, promoMonths=12', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    const tier1 = outcome.result.data.find((t) => t.attributes['download_mbps'] === 200);
    expect(tier1).toBeDefined();
    expect(tier1?.monthlyPriceCents).toBe(8600);
    expect(tier1?.promoPriceCents).toBe(7100);
    expect(tier1?.promoMonths).toBe(12);
  });

  it('500Mbps 티어: monthly=9500, 프로모 없음', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    const tier2 = outcome.result.data.find((t) => t.attributes['download_mbps'] === 500);
    expect(tier2).toBeDefined();
    expect(tier2?.monthlyPriceCents).toBe(9500);
    expect(tier2?.promoPriceCents).toBeNull();
    expect(tier2?.promoMonths).toBeNull();
  });

  it('bundle attributes에 included_services + tv_channels 포함', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    for (const tariff of outcome.result.data) {
      const attrs = tariff.attributes;
      expect(attrs['included_services']).toEqual({ mobile: true, internet: true, tv: true });
      expect(attrs['tv_channels']).toBe(90);
      expect('upload_mbps' in attrs).toBe(true);
    }
  });

  it('modemRentalCents=0 (Telenet TV-box + modem 기본 포함)', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');
    for (const tariff of outcome.result.data) {
      expect(tariff.modemRentalCents).toBe(0);
    }
  });

  it('sourceUrl이 실 bundle URL', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');
    for (const tariff of outcome.result.data) {
      expect(tariff.sourceUrl).toContain('internet-mobiel-tv.html');
    }
  });
});

// ─── 8. 페이지 단위 degrade — mobile 실패 + bundle 성공 (PLAN 4.26.a) ────
describe('TelenetFetcher — mobile 403 + bundle 정상 → 페이지 단위 degrade', () => {
  it('mobile 실패해도 bundle 파싱되면 ok:true (bundle만 반환)', async () => {
    mockTwoPages(
      () => makeMockResponse(403, 'Forbidden'),
      () => makeMockResponse(200, FIXTURE_BUNDLE_HTML),
    );

    const outcome = await telenet.fetch();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error('ok=true 기대');

    expect(outcome.result.data.length).toBe(2);
    for (const tariff of outcome.result.data) {
      expect(tariff.category).toBe('bundle_mobile_internet_tv');
    }
  });
});
