/**
 * Telenet 실 스크래핑 fetcher 단위 테스트 (PLAN 1.5.6)
 *
 * 외부 호출 0 — global.fetch를 vi.fn()으로 모킹.
 * 케이스:
 *   (a) 정상 HTML → mobile 요금제 파싱 + method='scraping' + stub===false
 *   (b) HTTP 403 → ok:false kind:'network'
 *   (c) 빈 HTML (셀렉터 0 매칭) → ok:false kind:'parse'
 *   (d) STUB_FAIL_TELENET=1 → ok:false kind:'network' (1.9 격리)
 *   (e) 챌린지 페이지 → ok:false kind:'network'
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { telenet } from './telenet';

// ─── 최소 fixture HTML ────────────────────────────────────────────────────
//
// 실제 Telenet mobile 페이지 구조 기반 최소 마크업.
// price=0 카드(조합 전용) 2개 + 실제 모바일 요금제 카드 2개.
// 가격은 tg-lazy-loading-standalone inputs의 customProduct.price로 존재.

const FIXTURE_HTML_HAPPY = `<!DOCTYPE html>
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

const FIXTURE_HTML_EMPTY = `<!DOCTYPE html>
<html lang="nl"><head><title>Mobiel</title></head><body><p>Geen producten</p></body></html>`;

const FIXTURE_HTML_CHALLENGE = `<!DOCTYPE html>
<html><head><title>Just a moment...</title></head><body><p>Just a moment</p></body></html>`;

// ─── fetch 모킹 헬퍼 ─────────────────────────────────────────────────────

function makeMockResponse(
  status: number,
  body: string,
): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
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
});

// ─── 2. 정상 HTML → mobile 요금제 파싱 ──────────────────────────────────
describe('TelenetFetcher — fetch() 정상 케이스', () => {
  beforeEach(() => {
    // global.fetch를 mock으로 교체 (네트워크 0)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeMockResponse(200, FIXTURE_HTML_HAPPY),
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

    // 4개 카드 중 price>0인 카드는 2개 (Basic=21, Unlimited=41)
    expect(outcome.result.data.length).toBe(2);
  });

  it('모든 tariff가 category=mobile (Amendment 3: mobile만 반환)', async () => {
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
      // mobileAttributesSchema 키 확인
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
describe('TelenetFetcher — HTTP 403 에러', () => {
  it('HTTP 403 → FetchOutcome.ok=false kind=network (B.5)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeMockResponse(403, 'Forbidden'),
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
describe('TelenetFetcher — 셀렉터 0 매칭 (구조 변경)', () => {
  it('div.cmp-product-summary 없는 HTML → ok:false kind=parse', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeMockResponse(200, FIXTURE_HTML_EMPTY),
    );

    const outcome = await telenet.fetch();
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('ok=false 기대');

    expect(outcome.error.kind).toBe('parse');
    // PLAN 4.26.a: mobile 단독 → 5페이지 fetcher 로 확장되며 메시지가 페이지 전체 기준으로 바뀜.
    expect(outcome.error.message).toContain('No tariffs parsed from any Telenet page');
  });
});

// ─── 5. 챌린지 페이지 → ok:false kind:'network' ─────────────────────────
describe('TelenetFetcher — 챌린지 페이지 (B.5)', () => {
  it('"Just a moment" 페이지 → ok:false kind=network', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeMockResponse(200, FIXTURE_HTML_CHALLENGE),
    );

    const outcome = await telenet.fetch();
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('ok=false 기대');

    expect(outcome.error.kind).toBe('network');
    expect(outcome.error.message).toContain('challenge');
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
