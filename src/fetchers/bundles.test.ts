/**
 * 번들(팩) 파싱 단위 테스트 — PLAN 4.26.a
 *
 * 외부 호출 0 — global.fetch 를 vi.spyOn 으로 모킹, URL 로 분기.
 * fixture 는 2026-08-19 실 페이지에서 뽑은 카드 마크업 그대로 (합성 마크업 금지 —
 * 메모리 `reference_fetcher_recon_method`). inputs 속성 JSON 은 파서가 읽는 키만
 * 남기고 나머지 AEM 보일러플레이트를 잘라냈다 (기존 telenet.test.ts 관례 동일).
 *
 * 실측 기준값 (2026-08-19 raw fetch, Slim/1.0 UA):
 *   Telenet internet          Basic €56 (프로모 없음) / Standard €65 (€56 12개월)
 *   Telenet internet+mobiel   200 Mbps €66 (€56 12개월), 15 GB
 *   Telenet internet+TV       200 Mbps €76 (€71 12개월)
 *   Telenet 트리플            200 Mbps €86 (€71 12개월), 15 GB
 *   Proximus Flex+            Mega Fiber 500 Mbps €97.99 (€0 3개월), 500/500 Mbps, 20 GB
 *   Orange Love               Livebox+Mobile Small+TV Lite €71 (€61 12개월), 200 Mbps, 12 GB, 20채널
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { telenet } from './telenet';
import { proximus } from './proximus';
import { orangeBe } from './orange-be';
import { parseTariffAttributes } from '@/types/tariff-attributes';
import type { TariffSnapshotInput } from './types';

// ─── Telenet fixture (실 마크업 발췌) ────────────────────────────────────

function telenetPage(cards: string): string {
  return `<!DOCTYPE html><html lang="nl"><body>
<p>Onbeperkt internet bij elk abonnement.</p>
${cards}
</body></html>`;
}

const TELENET_INTERNET_CARDS = `
<div class="cmp-product-summary">
  <h3 class="heading--4">Basic</h3>
  <p class="heading--3">200 Mbps</p>
  <ul><li>200 Mbps max. downloadsnelheid 20 Mbps max. uploadsnelheid</li></ul>
  <tg-lazy-loading-standalone component-id="tg-marketing-cafe-pricing" inputs='{"productCategory":"customProducts","customProduct":{"duration":"","promoPrice":"","endDate":"","price":"56","startDate":""}}'></tg-lazy-loading-standalone>
</div>
<div class="cmp-product-summary">
  <h3 class="heading--4">Standard</h3>
  <p class="heading--3">500 Mbps</p>
  <ul><li>500 Mbps max. downloadsnelheid 30 Mbps max. uploadsnelheid</li></ul>
  <tg-lazy-loading-standalone component-id="tg-marketing-cafe-pricing" inputs='{"productCategory":"customProducts","customProduct":{"duration":"12","promoPrice":"56","endDate":"2 Jun 2027","price":"65","startDate":"2 Jun 2026"}}'></tg-lazy-loading-standalone>
</div>
<div class="cmp-product-summary">
  <h3 class="heading--4">Internet + Mobiel</h3>
  <p class="heading--3">met 500 Mbps</p>
  <ul><li>500 Mbps max. downloadsnelheid 30 Mbps max. uploadsnelheid</li><li>15 GB mobiele data</li></ul>
  <tg-lazy-loading-standalone component-id="tg-marketing-cafe-pricing" inputs='{"productCategory":"customProducts","customProduct":{"duration":"12","promoPrice":"56","endDate":"9 Feb 2027","price":"75","startDate":"9 Feb 2026"}}'></tg-lazy-loading-standalone>
</div>`;

const TELENET_MOBIEL_INTERNET_CARDS = `
<div class="cmp-product-summary">
  <h3 class="heading--4">Internet + Mobiel</h3>
  <p class="heading--3">met 200 Mbps</p>
  <ul><li>200 Mbps max. downloadsnelheid 20 Mbps max. uploadsnelheid</li><li>15 GB mobiele data</li></ul>
  <tg-lazy-loading-standalone component-id="tg-marketing-cafe-pricing" inputs='{"productCategory":"customProducts","customProduct":{"duration":"12","promoPrice":"56","endDate":"9 Feb 2027","price":"66","startDate":"9 Feb 2026"}}'></tg-lazy-loading-standalone>
</div>
<div class="cmp-product-summary">
  <h3 class="heading--4">Internet + Mobiel</h3>
  <p class="heading--3">met 200 Mbps</p>
  <ul><li>200 Mbps max. downloadsnelheid 20 Mbps max. uploadsnelheid</li><li>15 GB of Unlimited mobiele data</li></ul>
  <tg-lazy-loading-standalone component-id="tg-marketing-cafe-pricing" inputs='{"productCategory":"customProducts","customProduct":{"duration":"6","promoPrice":"56","endDate":"9 Feb 2027","price":"66","startDate":"9 Feb 2026"}}'></tg-lazy-loading-standalone>
</div>`;

const TELENET_INTERNET_TV_CARDS = `
<div class="cmp-product-summary">
  <h3 class="heading--4">Internet + TV</h3>
  <p class="heading--3">met 200 Mbps</p>
  <ul><li>200 Mbps max. downloadsnelheid 20 Mbps max. uploadsnelheid</li><li>Telenet TV-box met TV-zenders</li></ul>
  <tg-lazy-loading-standalone component-id="tg-marketing-cafe-pricing" inputs='{"productCategory":"customProducts","customProduct":{"duration":"12","promoPrice":"71","endDate":"9 Feb 2027","price":"76","startDate":"9 Feb 2026"}}'></tg-lazy-loading-standalone>
</div>`;

const TELENET_TRIPLE_CARDS = `
<div class="cmp-product-summary">
  <h3 class="heading--4">Internet + Mobiel + TV</h3>
  <p class="heading--3">met 200 Mbps</p>
  <ul><li>200 Mbps max. downloadsnelheid 20 Mbps max. uploadsnelheid</li><li>15 GB mobiele data</li><li>Telenet TV-box met TV-zenders</li></ul>
  <tg-lazy-loading-standalone component-id="tg-marketing-cafe-pricing" inputs='{"productCategory":"customProducts","customProduct":{"duration":"12","promoPrice":"71","endDate":"9 Feb 2027","price":"86","startDate":"9 Feb 2026"}}'></tg-lazy-loading-standalone>
</div>
<div class="cmp-product-summary">
  <h3 class="heading--4">Internet + Mobiel + TV</h3>
  <p class="heading--3">met 200 Mbps</p>
  <ul><li>200 Mbps max. downloadsnelheid 20 Mbps max. uploadsnelheid</li><li>15 GB of Unlimited mobiele data</li><li>Telenet TV-box met TV-zenders</li></ul>
  <tg-lazy-loading-standalone component-id="tg-marketing-cafe-pricing" inputs='{"productCategory":"customProducts","customProduct":{"duration":"12","promoPrice":"71","endDate":"9 Feb 2027","price":"86","startDate":"9 Feb 2026"}}'></tg-lazy-loading-standalone>
</div>`;

const TELENET_MOBILE_CARDS = `
<div class="cmp-product-summary">
  <h3 class="heading--4">Basic</h3>
  <div data-tg-cmp-is="title" class="heading--3"><b>15 GB data</b></div>
  <p>In combinatie met internet nu vanaf € 56 per maand.</p>
  <tg-lazy-loading-standalone component-id="tg-marketing-cafe-pricing" inputs='{"productCategory":"customProducts","customProduct":{"duration":"12","promoPrice":"0","endDate":"8 Jun 2027","price":"10","startDate":"8 Jun 2026"}}'></tg-lazy-loading-standalone>
</div>
<div class="cmp-product-summary">
  <h3 class="heading--4">Basic</h3>
  <div data-tg-cmp-is="title" class="heading--3"><b>15 GB data</b></div>
  <p>Voor basisgebruik zoals surfen, whatsappen, e-mails lezen, ...</p>
  <tg-lazy-loading-standalone component-id="tg-marketing-cafe-pricing" inputs='{"productCategory":"customProducts","customProduct":{"duration":"","promoPrice":"","endDate":"","price":"21","startDate":""}}'></tg-lazy-loading-standalone>
</div>
<div class="cmp-product-summary">
  <h3 class="heading--4">Basic</h3>
  <div data-tg-cmp-is="title" class="heading--3"><b>15 GB data</b></div>
  <p>Voor basisgebruik zoals surfen, whatsappen, e-mails lezen, ...</p>
  <tg-lazy-loading-standalone component-id="tg-marketing-cafe-pricing" inputs='{"productCategory":"customProducts","customProduct":{"duration":"","promoPrice":"","endDate":"","price":"21","startDate":""}}'></tg-lazy-loading-standalone>
</div>`;

// ─── Proximus fixture (실 마크업 발췌) ───────────────────────────────────

const PROXIMUS_PACKS_HTML = `<!DOCTYPE html><html lang="en"><body>
<h1 class="rs-has-subtit">Flex+ pack</h1>
<div class="panel">
  <h3 data-testid="PromoSpeed" class="rs-txt-s8">Mega Fiber 500 Mbps</h3>
  <div data-testid="PromoPrice" class="text-center"><app-price><div data-testid="atomic-price" class="rs-price-sm"><span class="rs-nowrap rs-price-promo"><span class="rs-euro">€</span><span class="rs-unit notranslate">0</span></span><span class="rs-font-normal"> /month</span></div><p class="rs-txt-s3"><span class="rs-txt-details"> for 3 month(s), then </span><span class="rs-font-pxB rs-txt-c1"> €<span class="notranslate">97.99</span></span><span class="rs-font-normal"> /month</span></p></app-price></div>
  <div data-testid="Pack-Composer-Product-Internet-Details" class="rs-txt-s3"><p>500 Mbps max download speed <br> 500 Mbps max upload speed</p></div>
  <p>Unlimited internet with Wi-Fi 6</p>
  <p>20 GB mobile data + 5G network</p>
  <p>Free installation by a technician (value: €79)</p>
</div>
</body></html>`;

/** testid 개수가 어긋난 페이지 — 구조 변경 시 0건 반환 + warning 확인용. */
const PROXIMUS_PACKS_MISMATCH_HTML = `<!DOCTYPE html><html lang="en"><body>
<div class="panel">
  <h3 data-testid="PromoSpeed">Mega Fiber 500 Mbps</h3>
  <h3 data-testid="PromoSpeed">Giga Fiber 2 Gbps</h3>
  <div data-testid="PromoPrice">€0 /month for 3 month(s), then €97.99 /month</div>
  <div data-testid="Pack-Composer-Product-Internet-Details">500 Mbps max download speed 500 Mbps max upload speed</div>
</div>
</body></html>`;

// ─── Orange fixture (실 마크업 발췌) ─────────────────────────────────────

const ORANGE_BUNDLE_HTML = `<!DOCTYPE html><html lang="fr"><body>
<div class="obe-card">
  <div class="obe-card-top">
    <div class="obe-product-header">
      <div class="obe-tags">
        <span class="obe-tag is-default">Internet</span>
        <span class="obe-tag is-default">Mobile</span>
        <span class="obe-tag is-default">TV</span>
      </div>
      <div class="obe-product-header-text"><span>Le moins cher</span></div>
    </div>
  </div>
  <div class="obe-card-middle">
    <ul class="obe-icon-table">
      <li class="obe-icon-table-item"><div class="obe-icon-table-item-content">
        <div class="obe-prose"><p><span><strong>Internet </strong>: Livebox</span></p></div>
        <div class="obe-prose"><p class="obe-body-small"><span>T&eacute;l&eacute;chargement jusqu'&agrave; 200 Mbps</span></p></div>
      </div></li>
      <li class="obe-icon-table-item"><div class="obe-icon-table-item-content">
        <div class="obe-prose"><p><span><strong>Mobile</strong> : Orange Mobile Small</span></p></div>
        <div class="obe-prose"><p class="obe-body-small"><span>12 GB, appels et SMS illimit&eacute;s</span></p></div>
      </div></li>
      <li class="obe-icon-table-item"><div class="obe-icon-table-item-content">
        <div class="obe-prose"><p><span><strong>TV</strong> : Orange TV Lite</span></p></div>
        <div class="obe-prose"><p class="obe-body-small"><span>20 cha&icirc;nes essentielle via streaming</span></p></div>
      </div></li>
    </ul>
  </div>
  <div class="obe-card-bottom">
    <div class="obe-pricebox">
      <div class="obe-tags"><span class="obe-tag is-yellow">Web promo</span></div>
      <div class="obe-price"><strong class="obe-price-amount">61</strong><span class="obe-price-unit">&euro;/mois</span></div>
      <div class="obe-price-suffix">71 &euro;/mois apr&egrave;s 12 mois</div>
    </div>
    <a href="https://www.orange.be/fr/produits-et-services/internet-tv-mobile/configurer-votre-pack?internet=net-s&amp;mobile=mob-s&amp;tv=tv-lite" class="obe-button is-primary">Configurer ce pack</a>
  </div>
</div>
</body></html>`;

/** Internet 단품 카드 — 번들 파서가 태그를 보고 걸러내는지 확인용. */
const ORANGE_INTERNET_ONLY_HTML = `<!DOCTYPE html><html lang="fr"><body>
<div class="obe-card">
  <div class="obe-card-top"><div class="obe-product-header">
    <div class="obe-tags"><span class="obe-tag is-default">Internet</span></div>
    <div class="obe-product-header-text"><span>Livebox</span></div>
  </div></div>
  <div class="obe-card-bottom"><div class="obe-pricebox">
    <div class="obe-price"><strong class="obe-price-amount">43</strong><span class="obe-price-unit">&euro;/mois</span></div>
    <div class="obe-price-suffix">&agrave; vie</div>
  </div></div>
</div>
</body></html>`;

// ─── 헬퍼 ────────────────────────────────────────────────────────────────

function mockPages(routes: ReadonlyArray<readonly [string, string]>): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const hit = routes.find(([needle]) => url.includes(needle));
    const body = hit ? hit[1] : '<!DOCTYPE html><html><body></body></html>';
    return Promise.resolve(
      new Response(body, { status: 200, headers: { 'content-type': 'text/html' } }),
    );
  });
}

function byCategory(
  data: readonly TariffSnapshotInput[],
  category: string,
): readonly TariffSnapshotInput[] {
  return data.filter((t) => t.category === category);
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Telenet ─────────────────────────────────────────────────────────────

describe('Telenet — 인터넷 + 번들 3종 (PLAN 4.26.a)', () => {
  it('metadata 가 5개 카테고리를 선언한다', () => {
    expect([...telenet.metadata.categories]).toEqual([
      'mobile',
      'internet_fixed',
      'bundle_mobile_internet',
      'bundle_internet_tv',
      'bundle_mobile_internet_tv',
    ]);
  });

  it('4개 페이지에서 카테고리별로 요금제를 추출한다', async () => {
    mockPages([
      ['producten/mobiel.html', telenetPage(TELENET_MOBILE_CARDS)],
      ['internet-mobiel-tv.html', telenetPage(TELENET_TRIPLE_CARDS)],
      ['internet-mobiel.html', telenetPage(TELENET_MOBIEL_INTERNET_CARDS)],
      ['internet-tv.html', telenetPage(TELENET_INTERNET_TV_CARDS)],
      ['producten/internet.html', telenetPage(TELENET_INTERNET_CARDS)],
    ]);

    const outcome = await telenet.fetch();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const { data } = outcome.result;

    // internet_fixed — '+' 가 든 번들 카드는 단품 페이지에서 제외된다
    const internet = byCategory(data, 'internet_fixed');
    expect(internet.map((t) => t.tariffSlug)).toEqual([
      'telenet-internet-basic',
      'telenet-internet-standard',
    ]);
    expect(internet[0]?.monthlyPriceCents).toBe(5600);
    expect(internet[0]?.promoPriceCents).toBeNull();
    expect(internet[1]?.monthlyPriceCents).toBe(6500);
    expect(internet[1]?.promoPriceCents).toBe(5600);
    expect(internet[1]?.promoMonths).toBe(12);

    // bundle_mobile_internet — 중복 변형 카드는 1건으로 접힌다
    const dual = byCategory(data, 'bundle_mobile_internet');
    expect(dual).toHaveLength(1);
    expect(dual[0]?.monthlyPriceCents).toBe(6600);
    expect(dual[0]?.attributes['data_gb']).toBe(15);
    expect(dual[0]?.attributes['download_mbps']).toBe(200);
    expect(dual[0]?.attributes['upload_mbps']).toBe(20);

    // bundle_internet_tv — 모바일 회선 0 (ADR-0042 §D1)
    const tv = byCategory(data, 'bundle_internet_tv');
    expect(tv).toHaveLength(1);
    expect(tv[0]?.monthlyPriceCents).toBe(7600);
    expect(tv[0]?.attributes['mobile_lines_included']).toBe(0);

    // 트리플
    const triple = byCategory(data, 'bundle_mobile_internet_tv');
    expect(triple).toHaveLength(1);
    expect(triple[0]?.monthlyPriceCents).toBe(8600);
    expect(triple[0]?.promoPriceCents).toBe(7100);
    expect(triple[0]?.promoMonths).toBe(12);
  });

  it('mobile: "In combinatie met internet" 조건부 가격 카드를 제외하고 중복을 접는다', async () => {
    mockPages([['producten/mobiel.html', telenetPage(TELENET_MOBILE_CARDS)]]);

    const outcome = await telenet.fetch();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const mobile = byCategory(outcome.result.data, 'mobile');
    expect(mobile).toHaveLength(1);
    // €10 (인터넷 결합가) 가 아니라 €21 (단독가)
    expect(mobile[0]?.monthlyPriceCents).toBe(2100);
  });

  it('구성 증거가 없는 카드는 번들로 오분류하지 않는다', async () => {
    // 모든 페이지가 mobile 카드를 돌려주는 상황 (페이지 개편 사고 시뮬레이션)
    mockPages([['telenet.be', telenetPage(TELENET_MOBILE_CARDS)]]);

    const outcome = await telenet.fetch();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const nonMobile = outcome.result.data.filter((t) => t.category !== 'mobile');
    expect(nonMobile).toEqual([]);
  });

  it('추출한 attributes 가 Zod 스키마를 통과한다 (persist 회귀 방지)', async () => {
    mockPages([
      ['internet-mobiel-tv.html', telenetPage(TELENET_TRIPLE_CARDS)],
      ['internet-mobiel.html', telenetPage(TELENET_MOBIEL_INTERNET_CARDS)],
      ['internet-tv.html', telenetPage(TELENET_INTERNET_TV_CARDS)],
      ['producten/internet.html', telenetPage(TELENET_INTERNET_CARDS)],
    ]);

    const outcome = await telenet.fetch();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    for (const t of outcome.result.data) {
      const parsed = parseTariffAttributes(t.category, t.attributes);
      expect(parsed.ok, `${t.tariffSlug}: ${parsed.ok ? '' : parsed.error}`).toBe(true);
    }
  });
});

// ─── Proximus ────────────────────────────────────────────────────────────

describe('Proximus — Flex+ 팩 (PLAN 4.26.a)', () => {
  it('팩 페이지에서 트리플 번들을 추출한다', async () => {
    mockPages([['/en/packs', PROXIMUS_PACKS_HTML]]);

    const outcome = await proximus.fetch();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const packs = byCategory(outcome.result.data, 'bundle_mobile_internet_tv');
    expect(packs).toHaveLength(1);
    const pack = packs[0];
    expect(pack?.tariffSlug).toBe('proximus-pack-mega-fiber-500-mbps');
    expect(pack?.monthlyPriceCents).toBe(9799);
    expect(pack?.promoPriceCents).toBe(0);
    expect(pack?.promoMonths).toBe(3);
    expect(pack?.attributes['download_mbps']).toBe(500);
    expect(pack?.attributes['upload_mbps']).toBe(500);
    expect(pack?.attributes['data_gb']).toBe(20);
    expect(pack?.attributes['tv_channels']).toBeNull(); // 페이지 미표기
    expect(pack?.activationFeeCents).toBe(0); // "Free installation" 공표
    expect(parseTariffAttributes('bundle_mobile_internet_tv', pack?.attributes ?? {}).ok).toBe(
      true,
    );
  });

  it('testid 개수가 어긋나면 0건 + warning (조용한 오분류 금지)', async () => {
    mockPages([['/en/packs', PROXIMUS_PACKS_MISMATCH_HTML]]);

    const outcome = await proximus.fetch();
    // mobile/internet 페이지는 빈 HTML → 전체 0건 → parse 실패로 떨어진다
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    const warnings = outcome.error.rawPayload?.['warnings'];
    expect(JSON.stringify(warnings)).toContain('testid count mismatch');
  });

  it('쿼리 파라미터 configurer URL 을 요청하지 않는다 (B.10.5)', async () => {
    mockPages([['proximus.be', PROXIMUS_PACKS_HTML]]);
    await proximus.fetch();

    const spy = vi.mocked(globalThis.fetch);
    for (const call of spy.mock.calls) {
      expect(String(call[0])).not.toContain('?');
    }
  });
});

// ─── Orange ──────────────────────────────────────────────────────────────

describe('Orange — Love 번들 (PLAN 4.26.a)', () => {
  it('번들 페이지에서 트리플 팩을 추출한다', async () => {
    mockPages([['internet-tv-mobile', ORANGE_BUNDLE_HTML]]);

    const outcome = await orangeBe.fetch();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const packs = byCategory(outcome.result.data, 'bundle_mobile_internet_tv');
    expect(packs).toHaveLength(1);
    const pack = packs[0];
    // 마케팅 라벨이 아니라 configurer 링크의 제품 코드로 slug 를 만든다 (캠페인 무관 안정)
    expect(pack?.tariffSlug).toBe('orange-be-pack-net-s-mob-s-tv-lite');
    expect(pack?.tariffName).toBe('Livebox + Mobile Small + TV Lite');
    expect(pack?.monthlyPriceCents).toBe(7100); // "après 12 mois" 이후 정가
    expect(pack?.promoPriceCents).toBe(6100);
    expect(pack?.promoMonths).toBe(12);
    expect(pack?.attributes['download_mbps']).toBe(200);
    expect(pack?.attributes['data_gb']).toBe(12);
    expect(pack?.attributes['tv_channels']).toBe(20);
    expect(parseTariffAttributes('bundle_mobile_internet_tv', pack?.attributes ?? {}).ok).toBe(
      true,
    );
  });

  it('Internet 단품 카드는 번들로 편입하지 않는다 (태그 3종 필수)', async () => {
    mockPages([['internet-tv-mobile', ORANGE_INTERNET_ONLY_HTML]]);

    const outcome = await orangeBe.fetch();
    // 번들 0건 + internet 페이지도 빈 HTML → 전체 0건
    expect(outcome.ok).toBe(false);
  });

  it('쿼리 파라미터 configurer URL 을 요청하지 않는다 (B.10.5 robots 준수)', async () => {
    mockPages([['internet-tv-mobile', ORANGE_BUNDLE_HTML]]);
    await orangeBe.fetch();

    const spy = vi.mocked(globalThis.fetch);
    for (const call of spy.mock.calls) {
      expect(String(call[0])).not.toContain('configurer');
      expect(String(call[0])).not.toContain('?');
    }
  });
});
