/**
 * Orange BE 실 스크래핑 fetcher 단위 테스트 (PLAN 1.5.8 + PLAN 4.26.a)
 *
 * 외부 호출 0 — global.fetch를 vi.fn()으로 모킹.
 * fixture HTML은 2026-06-05 실 orange.be 페이지에서 추출한 .obe-card / .obe-pricebox 블록 그대로
 * (구조 변경 false negative 방지 — 합성 마크업 금지, 메모리 `reference_fetcher_recon_method.md`).
 *
 * 실 HTML 가격 (2026-06-05 정찰, internet_fixed):
 *   Start Internet  €38 promo / €53 std / pendant 6 mois  / 200 Mbps down / 15 Mbps up
 *   Zen Internet    €47 promo / €62 std / pendant 6 mois  / 500 Mbps down / 50 Mbps up
 *   Giga Internet   €57 promo / €72 std / pendant 12 mois / 1000 Mbps down / 50 Mbps up
 *   (All in Internet = 별도 pricebox 없음 → 본 fetcher 인식 대상 외)
 *
 * 실 HTML 가격 (2026-08-19 정찰, bundle — PLAN 4.26.a):
 *   Le moins cher   €61 promo / €71 std / après 12 mois / 200 Mbps down / 12 GB mobile / 20 chaînes
 *   Le choix mailn  €77 (à vie, 프로모 없음) / 500 Mbps down / 70 GB mobile / 70 chaînes
 *
 * 케이스:
 *   (a) 정상 HTML → 3 internet plans 추출, 모두 confidence='high', stub===false, method='scraping'
 *   (b) HTTP 403 → ok:false kind:'network'
 *   (c) 빈 HTML (obe-pricebox 0개, 양 페이지) → ok:false kind:'parse'
 *   (d) STUB_FAIL_ORANGE_BE=1 → ok:false + fetch 미호출
 *   (e) 챌린지 페이지 (Cloudflare) → ok:false kind:'network'
 *   (f) sanity check — 가격이 €5 미만이면 confidence 격하 (안전망)
 *   (g) bundle 페이지 정상 → bundle_mobile_internet_tv 파싱 (PLAN 4.26.a)
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { orangeBe } from './orange-be';

// ─── 실 HTML 발췌 fixture ────────────────────────────────────────────────
//
// 2026-06-05 https://www.orange.be/fr/produits-et-services/internet-chez-vous
// 에서 추출한 .obe-card × 3 (Start / Zen / Giga) 마크업 + 푸터 1줄.
// 페이지 전체 (~190KB)를 커밋하지 않고 가격 카드 블록만 포함.

const FIXTURE_INTERNET_HTML = `<!DOCTYPE html><html><body>
<swiper-slide class="obe-flex obe-flex-col">
  <div class="obe-w-full obe-h-full obe-flex obe-flex-col">
    <div class="obe-card">
      <div class="obe-card-top">
        <div class="obe-product-header">
          <div class="obe-tags">
            <span class="obe-tag is-yellow">Promo web</span>
          </div>
          <div class="obe-product-header-text">
            <span>Start Internet</span>
          </div>
          <div class="obe-product-header-note">Rapide</div>
        </div>
      </div>
      <div class="obe-card-middle">
        <ul class="obe-icon-table">
          <li class="obe-icon-table-item">
            <div class="obe-icon-table-item-content">
              <div class="obe-prose"><p>T&eacute;l&eacute;chargement jusqu&rsquo;&agrave; <strong>200 Mbps*</strong></p></div>
            </div>
          </li>
          <li class="obe-icon-table-item">
            <div class="obe-icon-table-item-content">
              <div class="obe-prose"><p>Chargement jusqu&rsquo;&agrave; <strong>15 Mbps*</strong></p></div>
            </div>
          </li>
        </ul>
      </div>
      <div class="obe-card-bottom">
        <div class="obe-pricebox">
          <div class="obe-price-prefix"><del>53&euro;/mois</del></div>
          <div class="obe-price">
            <strong class="obe-price-amount">38</strong>
            <span class="obe-price-unit">&euro;/mois</span>
          </div>
          <div class="obe-price-suffix">pendant 6 mois</div>
        </div>
      </div>
    </div>
  </div>
</swiper-slide>

<swiper-slide class="obe-flex obe-flex-col">
  <div class="obe-w-full obe-h-full obe-flex obe-flex-col">
    <div class="obe-card">
      <div class="obe-card-top">
        <div class="obe-product-header">
          <div class="obe-tags"><span class="obe-tag is-yellow">Promo web</span></div>
          <div class="obe-product-header-text"><span>Zen Internet</span></div>
          <div class="obe-product-header-note">Super rapide</div>
        </div>
      </div>
      <div class="obe-card-middle">
        <ul class="obe-icon-table">
          <li class="obe-icon-table-item">
            <div class="obe-prose"><p>T&eacute;l&eacute;chargement jusqu&rsquo;&agrave; <strong>500 Mbps*</strong></p></div>
          </li>
          <li class="obe-icon-table-item">
            <div class="obe-prose"><p>Chargement jusqu&rsquo;&agrave; <strong>50 Mbps*</strong></p></div>
          </li>
        </ul>
      </div>
      <div class="obe-card-bottom">
        <div class="obe-pricebox">
          <div class="obe-price-prefix"><del>62&euro;/mois</del></div>
          <div class="obe-price">
            <strong class="obe-price-amount">47</strong>
            <span class="obe-price-unit">&euro;/mois</span>
          </div>
          <div class="obe-price-suffix">pendant 6 mois</div>
        </div>
      </div>
    </div>
  </div>
</swiper-slide>

<swiper-slide class="obe-flex obe-flex-col">
  <div class="obe-w-full obe-h-full obe-flex obe-flex-col">
    <div class="obe-card">
      <div class="obe-card-top">
        <div class="obe-product-header">
          <div class="obe-tags"><span class="obe-tag is-yellow">Promo web</span></div>
          <div class="obe-product-header-text"><span>Giga Internet</span></div>
          <div class="obe-product-header-note">Ultra rapide</div>
        </div>
      </div>
      <div class="obe-card-middle">
        <ul class="obe-icon-table">
          <li class="obe-icon-table-item">
            <div class="obe-prose"><p>T&eacute;l&eacute;chargement jusqu&rsquo;&agrave; <strong>1000 Mbps*</strong></p></div>
          </li>
          <li class="obe-icon-table-item">
            <div class="obe-prose"><p>Chargement jusqu&rsquo;&agrave; <strong>50 Mbps*</strong></p></div>
          </li>
        </ul>
      </div>
      <div class="obe-card-bottom">
        <div class="obe-pricebox">
          <div class="obe-price-prefix"><del>72&euro;/mois</del></div>
          <div class="obe-price">
            <strong class="obe-price-amount">57</strong>
            <span class="obe-price-unit">&euro;/mois</span>
          </div>
          <div class="obe-price-suffix">pendant 12 mois</div>
        </div>
      </div>
    </div>
  </div>
</swiper-slide>

<p><small>Frais d'installation : 39&euro;</small></p>
</body></html>`;

const FIXTURE_HTML_EMPTY = `<!DOCTYPE html><html><body><p>Aucun forfait disponible</p></body></html>`;

const FIXTURE_CHALLENGE = `<!DOCTYPE html><html><body>Just a moment...<script>_cf_chl_opt</script></body></html>`;

// ─── 실 HTML 발췌 fixture — bundle (PLAN 4.26.a, 2026-08-19 정찰) ──────────
//
// hero 배너(가격 안내만, .obe-card 조상 없음) 1개 + 실 상품 카드 2개
// (Le moins cher / Le choix mailn[원문 오타 그대로]).

const FIXTURE_BUNDLE_HTML = `<!DOCTYPE html><html><body>
<div class="obe-pricebox">
  <div class="obe-price"><strong class="obe-price-amount">61</strong></div>
  <div class="obe-price-suffix">71 €/mois après 12 mois</div>
</div>

<swiper-slide class="obe-flex obe-flex-col">
  <div class="obe-w-full obe-h-full obe-flex obe-flex-col">
    <div class="obe-card">
      <p>Le moins cher</p>
      <p>L'essentiel à petit prix</p>
      <p>Internet : Livebox Téléchargement jusqu'à 200 Mbps</p>
      <p>Mobile : Orange Mobile Small 12 GB, appels et SMS illimités</p>
      <p>TV : Orange TV Lite 20 chaînes essentielle via streaming</p>
      <div class="obe-pricebox">
        <div class="obe-price"><strong class="obe-price-amount">61</strong></div>
        <div class="obe-price-suffix">71 €/mois après 12 mois</div>
      </div>
    </div>
  </div>
</swiper-slide>

<swiper-slide class="obe-flex obe-flex-col">
  <div class="obe-w-full obe-h-full obe-flex obe-flex-col">
    <div class="obe-card">
      <p>Le choix mailn</p>
      <p>Le bon équilibre au quotidien</p>
      <p>Internet : Livebox Up Téléchargement jusqu'à 500 Mbps</p>
      <p>Mobile : Orange Mobile Medium 70 GB, appels et SMS illimités</p>
      <p>TV : Orange TV Jusqu'à 70 chaînes avec décodeur</p>
      <div class="obe-pricebox">
        <div class="obe-price"><strong class="obe-price-amount">77</strong></div>
        <div class="obe-price-suffix">à vie</div>
      </div>
    </div>
  </div>
</swiper-slide>
</body></html>`;

// ─── fetch 모킹 헬퍼 ──────────────────────────────────────────────────────

function mockFetchResponse(html: string, status = 200): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => html,
  });
}

/** internet_fixed / bundle 두 URL에 각각 다른 HTML을 주는 fetch mock. */
function mockFetchTwoUrls(internetHtml: string, bundleHtml: string, status = 200): void {
  global.fetch = vi.fn().mockImplementation((input: unknown) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    const html = url.includes('internet-tv-mobile') ? bundleHtml : internetHtml;
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: async () => html,
    });
  });
}

function mockFetchError(): void {
  global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
}

// ─── 테스트 ──────────────────────────────────────────────────────────────

describe('orangeBe fetcher', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.STUB_FAIL_ORANGE_BE;

  beforeEach(() => {
    delete process.env.STUB_FAIL_ORANGE_BE;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalEnv === undefined) delete process.env.STUB_FAIL_ORANGE_BE;
    else process.env.STUB_FAIL_ORANGE_BE = originalEnv;
  });

  describe('metadata', () => {
    it('exposes provider slug, country, method, categories', () => {
      expect(orangeBe.metadata.providerSlug).toBe('orange-be');
      expect(orangeBe.metadata.country).toBe('BE');
      expect(orangeBe.metadata.method).toBe('scraping');
      expect(orangeBe.metadata.categories).toEqual(['internet_fixed', 'bundle_mobile_internet_tv']);
      expect(orangeBe.metadata.homepageUrl).toBe('https://www.orange.be');
      expect(orangeBe.metadata.version).toMatch(/^orange-be@\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('정상 fetch (case a)', () => {
    it('실 HTML fixture 에서 3 internet plans 추출 + 모두 confidence=high, stub=false', async () => {
      mockFetchResponse(FIXTURE_INTERNET_HTML);

      const outcome = await orangeBe.fetch();

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.result.fetcherSlug).toBe('orange-be');
      expect(outcome.result.data).toHaveLength(3);

      // Plan slug → tariff 매핑 검증
      const bySlug = new Map(outcome.result.data.map((t) => [t.tariffSlug, t]));

      const start = bySlug.get('orange-be-internet-start');
      expect(start).toBeDefined();
      expect(start!.tariffName).toBe('Start Internet');
      expect(start!.category).toBe('internet_fixed');
      expect(start!.monthlyPriceCents).toBe(5300); // €53 std
      expect(start!.promoPriceCents).toBe(3800);   // €38 promo
      expect(start!.promoMonths).toBe(6);
      expect(start!.attributes).toMatchObject({
        category: 'internet_fixed',
        download_mbps: 200,
        upload_mbps: 15,
        unlimited_data: true,
      });
      expect(start!.activationFeeCents).toBe(3900);
      expect(start!.confidence).toBe('high');
      expect(start!.rawPayload.stub).toBe(false);
      expect(start!.rawPayload.fetcher_version).toMatch(/^orange-be@/);

      const zen = bySlug.get('orange-be-internet-zen');
      expect(zen).toBeDefined();
      expect(zen!.tariffName).toBe('Zen Internet');
      expect(zen!.monthlyPriceCents).toBe(6200);
      expect(zen!.promoPriceCents).toBe(4700);
      expect(zen!.promoMonths).toBe(6);
      expect(zen!.attributes.download_mbps).toBe(500);
      expect(zen!.attributes.upload_mbps).toBe(50);
      expect(zen!.confidence).toBe('high');

      const giga = bySlug.get('orange-be-internet-giga');
      expect(giga).toBeDefined();
      expect(giga!.tariffName).toBe('Giga Internet');
      expect(giga!.monthlyPriceCents).toBe(7200);
      expect(giga!.promoPriceCents).toBe(5700);
      expect(giga!.promoMonths).toBe(12);
      expect(giga!.attributes.download_mbps).toBe(1000);
      expect(giga!.attributes.upload_mbps).toBe(50);
      expect(giga!.confidence).toBe('high');
    });

    it('confidence=low 비율이 ADR-0013 DoD (< 20%) 이내', async () => {
      mockFetchResponse(FIXTURE_INTERNET_HTML);
      const outcome = await orangeBe.fetch();
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      const lowCount = outcome.result.data.filter((t) => t.confidence === 'low').length;
      const lowRatio = lowCount / outcome.result.data.length;
      expect(lowRatio).toBeLessThan(0.2);
    });

    it('promoDescription 한국어 형식', async () => {
      mockFetchResponse(FIXTURE_INTERNET_HTML);
      const outcome = await orangeBe.fetch();
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      const start = outcome.result.data.find((t) => t.tariffSlug === 'orange-be-internet-start');
      expect(start!.promoDescription).toBe('처음 6개월 €38 프로모');
    });
  });

  describe('HTTP 403 (case b)', () => {
    it('ok:false kind=network', async () => {
      mockFetchResponse(FIXTURE_INTERNET_HTML, 403);
      const outcome = await orangeBe.fetch();
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.error.kind).toBe('network');
      expect(outcome.error.message).toContain('403');
    });
  });

  describe('빈 HTML (case c) — obe-pricebox 0개 (양 페이지)', () => {
    it('ok:false kind=parse, warnings에 selector 매칭 0건 명시', async () => {
      mockFetchResponse(FIXTURE_HTML_EMPTY);
      const outcome = await orangeBe.fetch();
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.error.kind).toBe('parse');
      const warnings = outcome.error.rawPayload?.['warnings'];
      expect(Array.isArray(warnings) ? warnings.join(' ') : '').toContain('matched 0 elements');
    });
  });

  describe('STUB_FAIL_ORANGE_BE=1 (case d)', () => {
    it('ok:false + fetch 미호출', async () => {
      process.env.STUB_FAIL_ORANGE_BE = '1';
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;
      const outcome = await orangeBe.fetch();
      expect(outcome.ok).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('챌린지 페이지 (case e)', () => {
    it('Cloudflare "Just a moment" 페이지 감지 → ok:false', async () => {
      mockFetchResponse(FIXTURE_CHALLENGE);
      const outcome = await orangeBe.fetch();
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.error.message).toContain('challenge');
    });
  });

  describe('network error (case f)', () => {
    it('fetch reject → ok:false kind=network', async () => {
      mockFetchError();
      const outcome = await orangeBe.fetch();
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.error.kind).toBe('network');
      expect(outcome.error.message).toContain('fetch failed');
    });
  });

  describe('bundle 페이지 정상 파싱 (case g, PLAN 4.26.a)', () => {
    it('hero 배너 skip + 실 상품 카드 2개만 추출', async () => {
      mockFetchTwoUrls(FIXTURE_HTML_EMPTY, FIXTURE_BUNDLE_HTML);
      const outcome = await orangeBe.fetch();
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.result.data).toHaveLength(2);
      for (const t of outcome.result.data) {
        expect(t.category).toBe('bundle_mobile_internet_tv');
      }
    });

    it('Le moins cher: monthly=7100(표준가), promo=6100, promoMonths=12, download=200', async () => {
      mockFetchTwoUrls(FIXTURE_HTML_EMPTY, FIXTURE_BUNDLE_HTML);
      const outcome = await orangeBe.fetch();
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const cheap = outcome.result.data.find((t) => t.tariffSlug === 'orange-be-bundle-s');
      expect(cheap).toBeDefined();
      expect(cheap!.tariffName).toBe('Le moins cher');
      expect(cheap!.monthlyPriceCents).toBe(7100);
      expect(cheap!.promoPriceCents).toBe(6100);
      expect(cheap!.promoMonths).toBe(12);
      expect(cheap!.attributes['download_mbps']).toBe(200);
      expect(cheap!.attributes['data_gb']).toBe(12);
      expect(cheap!.attributes['tv_channels']).toBe(20);
    });

    it('Le choix mailn: à vie → 프로모 없음, monthly=7700', async () => {
      mockFetchTwoUrls(FIXTURE_HTML_EMPTY, FIXTURE_BUNDLE_HTML);
      const outcome = await orangeBe.fetch();
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;

      const mid = outcome.result.data.find((t) => t.tariffSlug === 'orange-be-bundle-m');
      expect(mid).toBeDefined();
      expect(mid!.monthlyPriceCents).toBe(7700);
      expect(mid!.promoPriceCents).toBeNull();
      expect(mid!.promoMonths).toBeNull();
      expect(mid!.attributes['download_mbps']).toBe(500);
      expect(mid!.attributes['data_gb']).toBe(70);
      expect(mid!.attributes['tv_channels']).toBe(70);
    });

    it('included_services={mobile:true, internet:true, tv:true}', async () => {
      mockFetchTwoUrls(FIXTURE_HTML_EMPTY, FIXTURE_BUNDLE_HTML);
      const outcome = await orangeBe.fetch();
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      for (const t of outcome.result.data) {
        expect(t.attributes['included_services']).toEqual({ mobile: true, internet: true, tv: true });
      }
    });

    it('upload_mbps는 페이지 미공개 — fallback=1 + confidence 격하(medium 이하)', async () => {
      mockFetchTwoUrls(FIXTURE_HTML_EMPTY, FIXTURE_BUNDLE_HTML);
      const outcome = await orangeBe.fetch();
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      for (const t of outcome.result.data) {
        expect(t.attributes['upload_mbps']).toBe(1);
        expect(t.confidence).not.toBe('high'); // upload 미검출 warning으로 격하
      }
    });
  });

  describe('User-Agent + Accept-Language (B.5 정직성)', () => {
    it('정직한 Slim UA + fr-BE Accept-Language 헤더 전송', async () => {
      mockFetchResponse(FIXTURE_INTERNET_HTML);
      await orangeBe.fetch();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('orange.be'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('Slim/'),
            'Accept-Language': expect.stringContaining('fr-BE'),
          }),
        }),
      );
    });
  });
});
