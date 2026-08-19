/**
 * Proximus 실 스크래핑 fetcher 단위 테스트 (PLAN 1.5.6 + PLAN 4.26.a)
 *
 * 외부 호출 0 — global.fetch를 vi.fn()으로 모킹.
 * fixture HTML은 최소 마크업(실 HTML 200KB 커밋 금지).
 *
 * 케이스:
 *   (a) 정상 HTML → mobile + internet 파싱, method='scraping', stub===false
 *   (b) HTTP 403 양 페이지 → ok:false kind:'network'
 *   (c) 빈 HTML 양 페이지 → ok:false kind:'parse'
 *   (d) STUB_FAIL_PROXIMUS=1 → ok:false kind:'network' + fetch 미호출
 *   (e) 챌린지 페이지 → degrade (ok:false)
 *   (f) bundle 페이지 정상 → bundle_mobile_internet_tv 파싱 (PLAN 4.26.a)
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { proximus } from './proximus';

// ─── 최소 fixture HTML ────────────────────────────────────────────────────
//
// 실제 Proximus 페이지 구조 기반 최소 마크업.
// 가격 구조: .rs-price-promo = promo 가격, "as from" 텍스트 = 표준가.

const FIXTURE_MOBILE_HTML = `<!DOCTYPE html>
<html lang="en">
<head><title>Mobile - Proximus</title></head>
<body>

<!-- Mobile Essential: promo €14.99, 표준 €16.99, 5GB, 6개월 프로모 -->
<div class="rs-panel">
  <span class="rs-txt-s4">Mobile Essential</span>
  <div class="rs-price-promo">€14.99 /month</div>
  <p>€16.99 as from the 7th month</p>
  <p>during 6 months</p>
  <p>5 GB</p>
</div>

<!-- Mobile Unlimited: promo €34.99, 표준 €49.99, unlimited, throttle 512Kbps -->
<div class="rs-panel">
  <span class="rs-txt-s4">Mobile Unlimited</span>
  <div class="rs-price-promo">€34.99 /month</div>
  <p>€49.99 as from the 7th month</p>
  <p>during 6 months</p>
  <p>Unlimited data</p>
  <p>512 Kbps</p>
</div>

</body>
</html>`;

const FIXTURE_INTERNET_HTML = `<!DOCTYPE html>
<html lang="en">
<head><title>Internet - Proximus</title></head>
<body>

<!-- Internet Go Fiber: promo €44.99, 표준 €59.99, 150·30 Mbps, 12개월 프로모 -->
<div class="rs-panel">
  <span class="rs-txt-s4">Internet Go Fiber</span>
  <div class="rs-price-sm">€44.99 /month</div>
  <p>€59.99</p>
  <p>for 12 months</p>
  <p>150 Mbps max download speed 30 Mbps max upload speed</p>
</div>

<!-- Internet Light Fiber: 프로모 없음, €39.99, 100·20 Mbps, fair use 200GB -->
<div class="rs-panel">
  <span class="rs-txt-s4">Internet Light Fiber</span>
  <div class="rs-price-neutral rs-price-sm">€39.99 /month</div>
  <p>100 Mbps max download speed 20 Mbps max upload speed</p>
  <p>Surf volume: 200 GB</p>
</div>

</body>
</html>`;

const FIXTURE_HTML_EMPTY = `<!DOCTYPE html>
<html lang="en"><head><title>Proximus</title></head><body><p>No plans</p></body></html>`;

const FIXTURE_HTML_CHALLENGE = `<!DOCTYPE html>
<html><head><title>Just a moment...</title></head>
<body><p>Just a moment</p><p>cf-browser-verification</p></body></html>`;

// ─── 최소 fixture HTML — bundle (PLAN 4.26.a, 실 HTML 구조 2026-08-19 기준) ─
//
// data-tms-cart-products 속성(JSON) 이 가격의 단일 출처 — Telenet inputs
// 속성 패턴과 동일 계열. Ultra Fiber는 유럽 콤마 소수점(Gbps) 케이스 재현.

const FIXTURE_BUNDLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head><title>Packs - Proximus</title></head>
<body>

<!-- Internet Go + Mobile + TV: 표준 €90.99, 프로모 €0 × 3개월 -->
<div class="panel">
  <span class="rs-txt-s4">Internet Go + Mobile + TV</span>
  <p>100 Mbps max download speed 30 Mbps max upload speed</p>
  <p>20 GB mobile data + 5G network</p>
  <p>Unlimited internet with Wi-Fi 6</p>
  <p>More than 80 TV channels</p>
  <p>You will pay €0/month for 3 month(s), then €90.99/month</p>
  <button data-tms-cart-products='{"id":"DDVSB","name":"Internet Go + Mobile + TV","quantity":1,"price":{"recurring":90.99,"recurringPromo":0,"oneTime":90.99},"products":[]}'>Check availability</button>
</div>

<!-- Ultra Fiber + Mobile + TV: 표준 €137.99, 프로모 €30 × 3개월, 유럽 콤마 소수점 -->
<div class="rs-panel-big">
  <span class="rs-txt-s4">Ultra Fiber Internet + Mobile + TV</span>
  <p>8,5 Gbps max download speed + 1,5 Gbps reserved for transmission quality</p>
  <p>8 Gbps max upload speed + 2 Gbps reserved for transmission quality</p>
  <p>20 GB mobile data + 5G network</p>
  <p>Unlimited internet with Wi-Fi 7</p>
  <p>More than 80 TV channels</p>
  <p>You will pay €30/month for 3 month(s), then €137.99/month</p>
  <button data-tms-cart-products='{"id":"KMTRS","name":"Ultra Fiber Internet + Mobile + TV","quantity":1,"price":{"recurring":137.99,"recurringPromo":30,"oneTime":137.99,"oneTimePromo":30},"products":[]}'>Check availability</button>
</div>

<!-- 중복 렌더 카드 (실측에서 관찰된 패턴) — dedupe 대상, id 동일 -->
<button data-tms-cart-products='{"id":"DDVSB","name":"Internet Go + Mobile + TV","quantity":1,"price":{"recurring":90.99,"recurringPromo":0,"oneTime":90.99},"products":[]}'>Check availability (dup)</button>

</body>
</html>`;

// ─── fetch 모킹 헬퍼 ─────────────────────────────────────────────────────

function makeMockResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

/**
 * 세 페이지(mobile, internet, bundle)에 각각 다른 응답을 주는 fetch mock.
 * URL 문자열 매칭으로 분기. 인자는 factory(각 호출마다 새 Response 인스턴스
 * 생성) — Response.text()는 1회만 읽을 수 있어 인스턴스 재사용은 위험.
 */
function mockThreePages(
  mobileFactory: () => Response,
  internetFactory: () => Response,
  bundleFactory: () => Response,
): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url.includes('mobile-subscription')) return Promise.resolve(mobileFactory());
    if (url.includes('packs')) return Promise.resolve(bundleFactory());
    return Promise.resolve(internetFactory());
  });
}

// ─── afterEach: 환경변수 정리 + 모킹 초기화 ──────────────────────────────
afterEach(() => {
  delete process.env['STUB_FAIL_PROXIMUS'];
  vi.restoreAllMocks();
});

// ─── 1. metadata 검증 ────────────────────────────────────────────────────
describe('ProximusFetcher — metadata', () => {
  it('method=scraping으로 변경됨 (1.5.6 전환 완료)', () => {
    expect(proximus.metadata.method).toBe('scraping');
  });

  it('FetcherMetadata 필수 필드 모두 존재 (ADR-0008 §T5)', () => {
    const { metadata } = proximus;
    expect(metadata.providerSlug).toBe('proximus-be');
    expect(metadata.displayName).toBe('Proximus');
    expect(metadata.country).toBe('BE');
    expect(metadata.version).toMatch(/^proximus-be@\d{4}-\d{2}-\d{2}$/);
    expect(metadata.homepageUrl).toBe('https://www.proximus.be');
  });

  it('categories에 mobile + internet_fixed + bundle_mobile_internet_tv 포함 (PLAN 4.26.a)', () => {
    expect(proximus.metadata.categories).toEqual([
      'mobile',
      'internet_fixed',
      'bundle_mobile_internet_tv',
    ]);
  });
});

// ─── 2. 정상 HTML → mobile + internet 파싱 ──────────────────────────────
describe('ProximusFetcher — fetch() 정상 케이스 (a)', () => {
  beforeEach(() => {
    mockThreePages(
      () => makeMockResponse(200, FIXTURE_MOBILE_HTML),
      () => makeMockResponse(200, FIXTURE_INTERNET_HTML),
      () => makeMockResponse(200, FIXTURE_HTML_EMPTY), // bundle 노이즈 배제
    );
  });

  it('FetchOutcome.ok=true + FetchResult 모양 검증', async () => {
    const outcome = await proximus.fetch();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error('ok=true 기대, false 반환됨');

    const { result } = outcome;
    expect(result.fetcherSlug).toBe('proximus-be');
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('mobile 2개 + internet 2개 = 4개 tariff 반환', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');
    expect(outcome.result.data.length).toBe(4);
  });

  it('mobile tariff는 category=mobile', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    const mobile = outcome.result.data.filter((t) => t.tariffSlug.includes('mobile'));
    expect(mobile.length).toBe(2);
    for (const t of mobile) {
      expect(t.category).toBe('mobile');
    }
  });

  it('internet tariff는 category=internet_fixed', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    const internet = outcome.result.data.filter((t) => t.tariffSlug.includes('internet'));
    expect(internet.length).toBe(2);
    for (const t of internet) {
      expect(t.category).toBe('internet_fixed');
    }
  });

  it('모든 tariff providerSlug=proximus-be', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');
    for (const t of outcome.result.data) {
      expect(t.providerSlug).toBe('proximus-be');
    }
  });

  it('Mobile Essential: monthly=1699(표준가), promo=1499, promoMonths=6', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    const essential = outcome.result.data.find((t) => t.tariffSlug === 'proximus-mobile-essential');
    expect(essential).toBeDefined();
    expect(essential?.monthlyPriceCents).toBe(1699); // 표준가 €16.99
    expect(essential?.promoPriceCents).toBe(1499);   // 프로모 €14.99
    expect(essential?.promoMonths).toBe(6);
  });

  it('Mobile Unlimited: monthly=4999, promo=3499, data="unlimited", throttle=512', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    const unlimited = outcome.result.data.find((t) => t.tariffSlug === 'proximus-mobile-unlimited');
    expect(unlimited).toBeDefined();
    expect(unlimited?.monthlyPriceCents).toBe(4999);
    expect(unlimited?.promoPriceCents).toBe(3499);
    expect(unlimited?.attributes['data_gb']).toBe('unlimited');
    expect(unlimited?.attributes['throttle_after_gb_speed_kbps']).toBe(512);
  });

  it('Internet Go Fiber: monthly=5999(표준가), promo=4499, dl=150, ul=30', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    const goFiber = outcome.result.data.find((t) => t.tariffSlug === 'proximus-internet-go-fiber');
    expect(goFiber).toBeDefined();
    expect(goFiber?.monthlyPriceCents).toBe(5999);
    expect(goFiber?.promoPriceCents).toBe(4499);
    expect(goFiber?.promoMonths).toBe(12);
    expect(goFiber?.attributes['download_mbps']).toBe(150);
    expect(goFiber?.attributes['upload_mbps']).toBe(30);
  });

  it('Internet Light Fiber: promo 없음, fair_use_gb=200', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    const lightFiber = outcome.result.data.find((t) => t.tariffSlug === 'proximus-internet-light-fiber');
    expect(lightFiber).toBeDefined();
    expect(lightFiber?.monthlyPriceCents).toBe(3999);
    expect(lightFiber?.promoPriceCents).toBeNull();
    expect(lightFiber?.attributes['fair_use_gb']).toBe(200);
    expect(lightFiber?.attributes['unlimited_data']).toBe(false);
  });

  it('rawPayload.stub===false (BetaEstimatedBanner 1.5.6.1 자동 비활성 신호)', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');
    for (const t of outcome.result.data) {
      expect(t.rawPayload['stub']).toBe(false);
    }
  });

  it('rawPayload에 fetcher_version, fetched_at, http 포함 (ADR-0006 §T3)', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    const payload = outcome.result.data[0]?.rawPayload;
    expect(payload?.['fetcher_version']).toContain('proximus-be');
    expect(payload?.['fetched_at']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(payload?.['http']).toBeDefined();
  });

  it('mobile attributes에 mobileAttributesSchema 호환 키 포함', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    const mobile = outcome.result.data.find((t) => t.category === 'mobile');
    expect(mobile).toBeDefined();
    const attrs = mobile!.attributes;
    expect('data_gb' in attrs).toBe(true);
    expect('voice_minutes' in attrs).toBe(true);
    expect('sms' in attrs).toBe(true);
    expect('eu_roaming_included' in attrs).toBe(true);
  });

  it('internet attributes에 internetFixedAttributesSchema 호환 키 포함', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    const internet = outcome.result.data.find((t) => t.category === 'internet_fixed');
    expect(internet).toBeDefined();
    const attrs = internet!.attributes;
    expect('download_mbps' in attrs).toBe(true);
    expect('upload_mbps' in attrs).toBe(true);
    expect('unlimited_data' in attrs).toBe(true);
    expect('wifi_booster_included' in attrs).toBe(true);
  });

  it('confidence는 high 또는 medium (price 파싱 성공 + sanity pass)', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');
    for (const t of outcome.result.data) {
      expect(['high', 'medium']).toContain(t.confidence);
    }
  });

  it('internet modemRentalCents=0 (Proximus 모뎀 기본 포함)', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');
    const internet = outcome.result.data.filter((t) => t.category === 'internet_fixed');
    for (const t of internet) {
      expect(t.modemRentalCents).toBe(0);
    }
  });

  it('mobile modemRentalCents=null (모바일 — 모뎀 임대 개념 없음)', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');
    const mobile = outcome.result.data.filter((t) => t.category === 'mobile');
    for (const t of mobile) {
      expect(t.modemRentalCents).toBeNull();
    }
  });
});

// ─── 3. HTTP 403 양 페이지 → ok:false kind:'network' (b) ─────────────────
describe('ProximusFetcher — HTTP 403 양 페이지 (b)', () => {
  it('양 페이지 403 → FetchOutcome.ok=false kind=network (B.5)', async () => {
    mockThreePages(
      () => makeMockResponse(403, 'Forbidden'),
      () => makeMockResponse(403, 'Forbidden'),
      () => makeMockResponse(403, 'Forbidden'),
    );

    const outcome = await proximus.fetch();
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('ok=false 기대');

    expect(outcome.error.fetcherSlug).toBe('proximus-be');
    expect(outcome.error.kind).toBe('network');
    expect(outcome.error.message).toContain('403');
  });
});

// ─── 4. 빈 HTML 양 페이지 → ok:false kind:'parse' (c) ────────────────────
describe('ProximusFetcher — 빈 HTML 양 페이지 (c)', () => {
  it('셀렉터 0 매칭 → ok:false kind=parse', async () => {
    mockThreePages(
      () => makeMockResponse(200, FIXTURE_HTML_EMPTY),
      () => makeMockResponse(200, FIXTURE_HTML_EMPTY),
      () => makeMockResponse(200, FIXTURE_HTML_EMPTY),
    );

    const outcome = await proximus.fetch();
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('ok=false 기대');

    expect(outcome.error.kind).toBe('parse');
  });
});

// ─── 5. STUB_FAIL_PROXIMUS=1 → 실패 outcome + fetch 미호출 (d) ───────────
describe('ProximusFetcher — STUB_FAIL 환경변수 (d)', () => {
  it('STUB_FAIL_PROXIMUS=1 → ok:false kind=network (fetch 호출 없음)', async () => {
    process.env['STUB_FAIL_PROXIMUS'] = '1';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const outcome = await proximus.fetch();

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('ok=false 기대');

    expect(outcome.error.fetcherSlug).toBe('proximus-be');
    expect(outcome.error.kind).toBe('network');
    expect(outcome.error.message).toContain('STUB_FAIL_PROXIMUS');
    // STUB_FAIL 분기는 fetch 호출 전에 리턴 — 네트워크 0 확인
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ─── 6. 챌린지 페이지 → degrade (e) ─────────────────────────────────────
describe('ProximusFetcher — 챌린지 페이지 degrade (e)', () => {
  it('양 페이지 챌린지 → ok:false (0개 추출)', async () => {
    mockThreePages(
      () => makeMockResponse(200, FIXTURE_HTML_CHALLENGE),
      () => makeMockResponse(200, FIXTURE_HTML_CHALLENGE),
      () => makeMockResponse(200, FIXTURE_HTML_CHALLENGE),
    );

    const outcome = await proximus.fetch();
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('ok=false 기대');

    expect(outcome.error.kind).toBe('network');
    expect(outcome.error.message.toLowerCase()).toMatch(/challenge|403|network/i);
  });

  it('mobile 챌린지 + internet 정상 → ok:true (internet만 반환)', async () => {
    mockThreePages(
      () => makeMockResponse(200, FIXTURE_HTML_CHALLENGE),
      () => makeMockResponse(200, FIXTURE_INTERNET_HTML),
      () => makeMockResponse(200, FIXTURE_HTML_EMPTY), // bundle 노이즈 배제
    );

    const outcome = await proximus.fetch();
    // internet 2개는 파싱됐으므로 ok:true (페이지 단위 degrade)
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error('ok=true 기대');

    expect(outcome.result.data.length).toBe(2);
    for (const t of outcome.result.data) {
      expect(t.category).toBe('internet_fixed');
    }
  });
});

// ─── 7. bundle 페이지 정상 파싱 (PLAN 4.26.a) ────────────────────────────
describe('ProximusFetcher — fetch() bundle 정상 케이스 (f)', () => {
  beforeEach(() => {
    mockThreePages(
      () => makeMockResponse(200, FIXTURE_HTML_EMPTY), // mobile 노이즈 배제
      () => makeMockResponse(200, FIXTURE_HTML_EMPTY), // internet 노이즈 배제
      () => makeMockResponse(200, FIXTURE_BUNDLE_HTML),
    );
  });

  it('중복 렌더 카드 dedupe — id 기준 실질 2개 pack만 반환', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');
    expect(outcome.result.data.length).toBe(2);
  });

  it('모든 bundle tariff가 category=bundle_mobile_internet_tv', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');
    for (const t of outcome.result.data) {
      expect(t.category).toBe('bundle_mobile_internet_tv');
    }
  });

  it('Internet Go + Mobile + TV: monthly=9099, promo=0, promoMonths=3', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    const go = outcome.result.data.find((t) => t.tariffSlug === 'proximus-bundle-ddvsb');
    expect(go).toBeDefined();
    expect(go?.monthlyPriceCents).toBe(9099);
    expect(go?.promoPriceCents).toBe(0);
    expect(go?.promoMonths).toBe(3);
    expect(go?.attributes['download_mbps']).toBe(100);
    expect(go?.attributes['upload_mbps']).toBe(30);
    expect(go?.attributes['data_gb']).toBe(20);
    expect(go?.attributes['tv_channels']).toBe(80);
  });

  it('Ultra Fiber: 유럽 콤마 소수점 Gbps 파싱 — download=8500, upload=8000', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    const ultra = outcome.result.data.find((t) => t.tariffSlug === 'proximus-bundle-kmtrs');
    expect(ultra).toBeDefined();
    expect(ultra?.monthlyPriceCents).toBe(13799);
    expect(ultra?.promoPriceCents).toBe(3000);
    expect(ultra?.attributes['download_mbps']).toBe(8500); // 8,5 Gbps → 8500 Mbps
    expect(ultra?.attributes['upload_mbps']).toBe(8000); // 8 Gbps → 8000 Mbps
  });

  it('included_services={mobile:true, internet:true, tv:true}', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');
    for (const t of outcome.result.data) {
      expect(t.attributes['included_services']).toEqual({ mobile: true, internet: true, tv: true });
    }
  });

  it('modemRentalCents=0 (Internet Box 기본 포함)', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');
    for (const t of outcome.result.data) {
      expect(t.modemRentalCents).toBe(0);
    }
  });

  it('sourceUrl이 실 bundle URL(/en/packs)', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');
    for (const t of outcome.result.data) {
      expect(t.sourceUrl).toBe('https://www.proximus.be/en/packs');
    }
  });
});
