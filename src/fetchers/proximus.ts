/**
 * Proximus 실 스크래핑 fetcher (PLAN 1.5.6)
 *
 * mobile 5개 + internet 4개 = 9개 요금제를 2개 페이지에서 추출한다.
 *
 * 왜 스크래핑인가?
 *   Proximus는 공식 가격 API를 제공하지 않는다. HTML 페이지에서 가격을 파싱한다.
 *   ADR-0013 Amendment 3 (2026-05-28) 패턴 적용 — Telenet과 동일 방식.
 *
 * HTML 구조 (2026-05-29 샘플 기준):
 *   Mobile 페이지:
 *     - span.rs-txt-s4 의 own-text(자식 제거)가 정확히 plan명과 일치하는 헤딩
 *     - 해당 헤딩에서 cardOf() 로 가격 컨테이너 탐색
 *     - .rs-price-promo 가 있으면 promo 가격, "as from" 패턴으로 표준가 확인
 *   Internet 페이지:
 *     - span.rs-txt-s4 의 own-text가 /^Internet .*Fiber$/ 정규식 매칭
 *     - €X.XX 고유값 목록에서 displayed보다 큰 값이 있으면 hasPromo
 *
 * B.5 컴플라이언스:
 *   HTTP !ok / 403 / 429 / 챌린지 페이지 → throw 없이 ok:false 반환.
 *   한 페이지 실패 시 나머지 페이지로 계속 (페이지 단위 degrade).
 *   두 페이지 모두 0개 추출 시 → ok:false parse.
 *
 * STUB_FAIL_PROXIMUS=1:
 *   1.9 격리 수동 검증용 — 실 fetcher에도 유지 (테스트 격리 시나리오 보호).
 *
 * 결정 근거: docs/adr/0013-fetcher-real-scraping-risk-assessment.md Amendment 3
 */

import * as cheerio from 'cheerio';
import type { Fetcher, FetchOutcome, FetchResult, TariffSnapshotInput } from './types';
import { computeConfidence, checkMonthlySanity } from './confidence';
import { STUB_FETCH_TIMEOUT_MS, stubFailOutcome } from './_shared';

// ─── 상수 ─────────────────────────────────────────────────────────────────

const FETCHER_VERSION = 'proximus-be@2026-05-29';

const MOBILE_SOURCE_URL = 'https://www.proximus.be/en/mobile-subscription';

const INTERNET_SOURCE_URL = 'https://www.proximus.be/en/internet';

const HOMEPAGE_URL = 'https://www.proximus.be';

/** mobile 페이지에서 인식할 plan 명 목록 (own-text 정확히 일치). */
const MOBILE_PLAN_NAMES = new Set([
  'Mobile Essential',
  'Mobile Easy',
  'Mobile Smart',
  'Mobile Maxi',
  'Mobile Unlimited',
]);

/**
 * P3 투명성: 정직한 User-Agent.
 * 봇 차단 우회 목적이 아니라 크롤러 정체를 명시.
 */
const USER_AGENT =
  'Slim/1.0 (+https://slim.lu; price comparison; contact kim.wonmin91@gmail.com)';

// ─── 파싱 유틸 ────────────────────────────────────────────────────────────

/**
 * 유로 문자열 → cents 정수.
 * "€16.99 /month", "16,99", "€ 14.99" 등 모두 처리.
 * 매칭 실패 시 null.
 */
function eurToCents(raw: string): number | null {
  const m = raw.replace(/\s/g, '').match(/(\d{1,3})[.,](\d{2})/);
  if (!m || !m[1] || !m[2]) return null;
  return parseInt(m[1], 10) * 100 + parseInt(m[2], 10);
}

/**
 * headEl 기준으로 가격(.rs-price-sm / .rs-price-promo)이 있는 카드 컨테이너를 찾는다.
 *
 * 왜 panel 우선인가?
 *   Unlimited 카드처럼 구조가 복잡한 경우, panel 전체를 기준으로 해야
 *   표준가 텍스트("as from")를 포함한 컨테이너를 놓치지 않는다.
 */
/**
 * 이미 $(el)로 래핑된 cheerio 객체를 받아 가격 컨테이너를 탐색한다.
 * panel 우선 → 부모 8단계 탐색.
 *
 * 왜 cheerio 래퍼를 받는가?
 *   each 콜백의 `el` 파라미터 타입이 cheerio 버전마다 다르다.
 *   $(el) 래핑을 콜백 안에서 하고, 래퍼를 전달하면 타입 문제를 피할 수 있다.
 */
function cardOf(
  headWrapped: ReturnType<ReturnType<typeof cheerio.load>>,
): ReturnType<ReturnType<typeof cheerio.load>> {
  const panel = headWrapped.closest('[class*="panel"]');
  if (panel.length > 0 && panel.find('.rs-price-sm, .rs-price-promo').length > 0) {
    return panel;
  }
  // panel이 없거나 가격 요소가 없으면 부모를 최대 8단계 탐색
  let el = headWrapped.parent();
  for (let i = 0; i < 8; i++) {
    if (el.find('.rs-price-sm, .rs-price-promo').length > 0) {
      return el;
    }
    el = el.parent();
  }
  return el; // 못 찾으면 마지막 탐색 위치 반환 (가격 없음 → 이후에서 처리)
}

/** Cloudflare / Akamai 챌린지 페이지 감지 (B.5 컴플라이언스). */
function isChallengeBody(body: string): boolean {
  return (
    body.includes('Just a moment') ||
    body.includes('cf-browser-verification') ||
    body.includes('_cf_chl_opt')
  );
}

// ─── Mobile 추출 ──────────────────────────────────────────────────────────

/**
 * mobile 페이지 HTML에서 요금제를 추출한다.
 * span.rs-txt-s4 own-text가 MOBILE_PLAN_NAMES 집합에 정확히 속하는 헤딩을 탐색.
 */
function parseMobilePlans(
  $: ReturnType<typeof cheerio.load>,
  httpStatus: number,
  elapsedMs: number,
  fetchedAt: string,
  warnings: string[],
): TariffSnapshotInput[] {
  const extracted: TariffSnapshotInput[] = [];

  $('span.rs-txt-s4').each((_, el) => {
    const wrapped = $(el);
    // own-text: 자식 노드를 제거한 텍스트만 (span 안에 다른 태그 포함 가능)
    const ownText = wrapped.clone().children().remove().end().text().trim();
    if (!MOBILE_PLAN_NAMES.has(ownText)) return;

    const planName = ownText;
    const card = cardOf(wrapped);

    const t = card.text().replace(/\s+/g, ' ');

    // displayed price: .rs-price-promo 우선, 없으면 .rs-price-sm
    const displayedRaw = card.find('.rs-price-sm, .rs-price-promo').first().text();
    const displayedCents = eurToCents(displayedRaw);
    if (displayedCents === null) {
      warnings.push(`${planName}: displayed price not parseable (raw: "${displayedRaw}")`);
      return;
    }

    // 표준 월정액: "as from" 패턴이 있으면 그 값, 없으면 displayed 그대로
    const asFromMatch = t.match(/€\s*(\d{1,3}[.,]\d{2})\s*as from/i);
    const monthlyCents = asFromMatch?.[1]
      ? (eurToCents(asFromMatch[1]) ?? displayedCents)
      : displayedCents;

    // 프로모 여부: 표준가 ≠ displayed
    const hasPromo = monthlyCents !== displayedCents;
    const promoPriceCents = hasPromo ? displayedCents : null;

    // 프로모 개월: "during X months"
    const duringMatch = t.match(/during\s*(\d+)\s*month/i);
    const promoMonths = hasPromo && duringMatch?.[1] ? parseInt(duringMatch[1], 10) : null;
    const promoDescription =
      hasPromo && promoMonths !== null
        ? `처음 ${promoMonths}개월 €${(displayedCents / 100).toFixed(2)} 프로모`
        : null;

    // data_gb: "unlimited data" 먼저, 그 다음 "X GB" ((?![a-z])로 Gbps 오매칭 방지)
    let dataGb: number | 'unlimited' | null = null;
    if (/unlimited data/i.test(t)) {
      dataGb = 'unlimited';
    } else {
      const gbMatch = t.match(/(\d+)\s*GB(?![a-z])/i);
      if (gbMatch?.[1]) dataGb = parseInt(gbMatch[1], 10);
    }

    if (dataGb === null) {
      warnings.push(`${planName}: data_gb not extracted`);
    }

    // throttle: Unlimited 요금제는 소진 후 512 Kbps
    const throttleMatch = t.match(/(\d+)\s*Kbps/i);
    const throttleKbps = throttleMatch?.[1] ? parseInt(throttleMatch[1], 10) : null;

    const sanity = checkMonthlySanity(monthlyCents);
    const planWarnings = warnings.filter((w) => w.includes(planName));
    const confidenceResult = computeConfidence({
      selectorMatched: true,
      sanityChecks: [sanity],
      parseWarnings: planWarnings,
    });

    // slug: Mobile Essential → proximus-mobile-essential
    const lastWord = planName.split(' ').pop()?.toLowerCase() ?? planName.toLowerCase();
    const tariffSlug = `proximus-mobile-${lastWord}`;

    extracted.push({
      providerSlug: 'proximus-be',
      tariffSlug,
      tariffName: planName,
      category: 'mobile',
      monthlyPriceCents: monthlyCents,
      activationFeeCents: 0,
      modemRentalCents: null, // 모바일 — 모뎀 임대 개념 없음
      promoPriceCents,
      promoMonths,
      promoDescription,
      commitmentMonths: 0, // Proximus mobile non-binding
      earlyTerminationFeeCents: null,
      attributes: {
        category: 'mobile',
        data_gb: dataGb ?? 'unlimited', // 추출 실패 시 보수적으로 'unlimited' (warning 추가됨)
        voice_minutes: 'unlimited' as const,
        sms: 'unlimited' as const,
        eu_roaming_included: true, // EU Roam-like-at-home (2017+, 법적 의무)
        throttle_after_gb_speed_kbps: throttleKbps,
      },
      sourceUrl: MOBILE_SOURCE_URL,
      confidence: confidenceResult.confidence,
      confidenceReason: confidenceResult.reason,
      rawPayload: {
        stub: false, // 실 스크래핑 — BetaEstimatedBanner 1.5.6.1 자동 비활성 신호
        fetcher_version: FETCHER_VERSION,
        url: MOBILE_SOURCE_URL,
        fetched_at: fetchedAt,
        http: { status: httpStatus, elapsed_ms: elapsedMs },
        extracted: {
          plan_name: planName,
          monthly_cents: monthlyCents,
          promo_cents: promoPriceCents,
        },
        warnings: planWarnings,
        ...sanity,
      },
    });
  });

  return extracted;
}

// ─── Internet 추출 ────────────────────────────────────────────────────────

/** /^Internet .*Fiber$/ 정규식 — Light Fiber / Go Fiber / Mega Fiber / Giga Fiber */
const INTERNET_PLAN_RE = /^Internet .*Fiber$/;

/**
 * internet 페이지 HTML에서 요금제를 추출한다.
 * span.rs-txt-s4 own-text가 INTERNET_PLAN_RE에 매칭되는 헤딩을 탐색.
 */
function parseInternetPlans(
  $: ReturnType<typeof cheerio.load>,
  httpStatus: number,
  elapsedMs: number,
  fetchedAt: string,
  warnings: string[],
): TariffSnapshotInput[] {
  const extracted: TariffSnapshotInput[] = [];

  $('span.rs-txt-s4').each((_, el) => {
    const wrapped = $(el);
    const ownText = wrapped.clone().children().remove().end().text().trim();
    if (!INTERNET_PLAN_RE.test(ownText)) return;

    const planName = ownText;
    const card = cardOf(wrapped);

    const t = card.text().replace(/\s+/g, ' ');

    // displayed price
    const displayedRaw = card.find('.rs-price-sm, .rs-price-promo').first().text();
    const displayedCents = eurToCents(displayedRaw);
    if (displayedCents === null) {
      warnings.push(`${planName}: displayed price not parseable (raw: "${displayedRaw}")`);
      return;
    }

    // rs-price-neutral = 할인 없는 정가 표시 (Light Fiber 등)
    const isNeutral = card.find('.rs-price-neutral').length > 0;

    // 패널 내 모든 €X.XX 고유값 집합
    // €180/€240 "web discount" 같은 정수 금액은 소수점 없어 자동 제외됨
    const allCents = [
      ...new Set(
        [...t.matchAll(/€\s*(\d{1,3}[.,]\d{2})/g)]
          .map((m) => eurToCents(m[1] ?? ''))
          .filter((c): c is number => c !== null),
      ),
    ];

    // displayed보다 큰 값이 있으면 → hasPromo (displayed가 promo 가격)
    const higher = allCents.filter((c) => c > displayedCents);
    const hasPromo = !isNeutral && higher.length > 0;

    const monthlyCents = hasPromo ? Math.max(...higher) : displayedCents;
    const promoPriceCents = hasPromo ? displayedCents : null;

    // 프로모 개월: "for X months" (internet은 12개월)
    const forMatch = t.match(/for\s*(\d+)\s*month/i);
    const promoMonths = hasPromo && forMatch?.[1] ? parseInt(forMatch[1], 10) : null;
    const promoDescription =
      hasPromo && promoMonths !== null
        ? `처음 ${promoMonths}개월 €${(displayedCents / 100).toFixed(2)} 프로모`
        : null;

    // download_mbps: Gbps 먼저(× 1000), 없으면 Mbps
    let downloadMbps: number | null = null;
    const gbpsDownMatch = t.match(/(\d[\d.]*)\s*Gbps/i);
    if (gbpsDownMatch?.[1]) {
      downloadMbps = Math.round(parseFloat(gbpsDownMatch[1]) * 1000);
    } else {
      const mbpsMatch =
        t.match(/(\d+)\s*Mbps\s*max download/i) ?? t.match(/(\d+)\s*Mbps/i);
      if (mbpsMatch?.[1]) downloadMbps = parseInt(mbpsMatch[1], 10);
    }

    // upload_mbps: "X Gbps max upload" 또는 "X Mbps max upload"
    let uploadMbps: number | null = null;
    const gbpsUpMatch = t.match(/(\d[\d.]*)\s*Gbps\s*max upload/i);
    if (gbpsUpMatch?.[1]) {
      uploadMbps = Math.round(parseFloat(gbpsUpMatch[1]) * 1000);
    } else {
      const mbpsUpMatch = t.match(/(\d+)\s*Mbps\s*max upload/i);
      if (mbpsUpMatch?.[1]) uploadMbps = parseInt(mbpsUpMatch[1], 10);
    }

    // fair_use_gb: "Surf volume: X GB" 패턴 (Light Fiber=200)
    const surfMatch = t.match(/Surf volume:\s*(\d+)\s*GB/i);
    const fairUseGb = surfMatch?.[1] ? parseInt(surfMatch[1], 10) : null;
    const unlimitedData = surfMatch === null;

    if (downloadMbps === null) {
      warnings.push(`${planName}: download_mbps not extracted`);
    }
    if (uploadMbps === null) {
      warnings.push(`${planName}: upload_mbps not extracted`);
    }

    const sanity = checkMonthlySanity(monthlyCents);
    const planWarnings = warnings.filter((w) => w.includes(planName));
    const confidenceResult = computeConfidence({
      selectorMatched: true,
      sanityChecks: [sanity],
      parseWarnings: planWarnings,
    });

    // slug: "Internet Go Fiber" → "proximus-internet-go-fiber"
    const kebab = planName
      .replace(/^Internet\s+/, '')
      .toLowerCase()
      .replace(/\s+/g, '-');
    const tariffSlug = `proximus-internet-${kebab}`;

    extracted.push({
      providerSlug: 'proximus-be',
      tariffSlug,
      tariffName: planName,
      category: 'internet_fixed',
      monthlyPriceCents: monthlyCents,
      activationFeeCents: 0,
      modemRentalCents: 0, // Proximus: 모뎀 기본 포함 (€0 임대)
      promoPriceCents,
      promoMonths,
      promoDescription,
      commitmentMonths: 0, // Proximus non-binding
      earlyTerminationFeeCents: null,
      attributes: {
        category: 'internet_fixed',
        download_mbps: downloadMbps ?? 1, // 추출 실패 시 최소값 (warning 추가됨)
        upload_mbps: uploadMbps ?? 1,
        unlimited_data: unlimitedData,
        fair_use_gb: fairUseGb ?? null,
        wifi_booster_included: false, // Proximus 기본 요금제에 Wi-Fi booster 미포함
      },
      sourceUrl: INTERNET_SOURCE_URL,
      confidence: confidenceResult.confidence,
      confidenceReason: confidenceResult.reason,
      rawPayload: {
        stub: false,
        fetcher_version: FETCHER_VERSION,
        url: INTERNET_SOURCE_URL,
        fetched_at: fetchedAt,
        http: { status: httpStatus, elapsed_ms: elapsedMs },
        extracted: {
          plan_name: planName,
          monthly_cents: monthlyCents,
          promo_cents: promoPriceCents,
          download_mbps: downloadMbps,
          upload_mbps: uploadMbps,
        },
        warnings: planWarnings,
        ...sanity,
      },
    });
  });

  return extracted;
}

// ─── HTTP fetch 헬퍼 ──────────────────────────────────────────────────────

interface PageFetchResult {
  html: string | null;
  httpStatus: number;
  elapsedMs: number;
  warning: string | null;
}

/**
 * 단일 URL을 fetch해 HTML(또는 null)을 반환한다.
 * HTTP 에러 / 챌린지 페이지 → html=null + warning 문자열.
 * throw하지 않음 — 페이지 단위 degrade를 위해 오류를 값으로 반환.
 */
async function fetchPage(url: string): Promise<PageFetchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    STUB_FETCH_TIMEOUT_MS, // 25s — Inngest free step timeout 보수 가정
  );

  const start = Date.now();
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const elapsed = Date.now() - start;
    const status = response.status;

    // B.5: HTTP 에러 코드
    if (!response.ok || status === 403 || status === 429) {
      return {
        html: null,
        httpStatus: status,
        elapsedMs: elapsed,
        warning: `HTTP ${status} from ${url}`,
      };
    }

    const html = await response.text();

    // B.5: 챌린지 페이지
    if (isChallengeBody(html)) {
      return {
        html: null,
        httpStatus: status,
        elapsedMs: elapsed,
        warning: `Bot challenge page detected at ${url}`,
      };
    }

    return { html, httpStatus: status, elapsedMs: elapsed, warning: null };
  } catch (err: unknown) {
    const elapsed = Date.now() - start;
    const msg = err instanceof Error ? err.message : 'unknown network error';
    return {
      html: null,
      httpStatus: 0,
      elapsedMs: elapsed,
      warning: `fetch failed: ${msg} (${url})`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Fetcher 구현 ─────────────────────────────────────────────────────────

export const proximus: Fetcher = {
  metadata: {
    providerSlug: 'proximus-be',
    displayName: 'Proximus',
    country: 'BE',
    /**
     * method='scraping': 1.5.6에서 스텁 → 실 스크래핑으로 전환됨.
     * ADR-0013 Amendment 3 기준.
     */
    method: 'scraping',
    version: FETCHER_VERSION,
    homepageUrl: HOMEPAGE_URL,
  },

  async fetch(): Promise<FetchOutcome> {
    const fetchedAt = new Date().toISOString();

    // ─── STUB_FAIL 환경변수 (1.9 격리 수동 검증용) ─────────────────────────
    // 실 scraping fetcher에도 유지 — 격리 테스트 시나리오 보호 목적.
    const failure = stubFailOutcome(
      'proximus-be',
      'STUB_FAIL_PROXIMUS',
      FETCHER_VERSION,
      fetchedAt,
    );
    if (failure) return failure;

    // ─── 두 페이지 순차 fetch ───────────────────────────────────────────────
    // Promise.all로 병렬화 가능하나, Proximus IP 차단 위험 완화를 위해 순차 실행.
    const mobPage = await fetchPage(MOBILE_SOURCE_URL);
    const intPage = await fetchPage(INTERNET_SOURCE_URL);

    const allWarnings: string[] = [];
    const allExtracted: TariffSnapshotInput[] = [];

    // mobile 페이지 파싱
    if (mobPage.html !== null) {
      const $ = cheerio.load(mobPage.html);
      const mobWarnings: string[] = [];
      const mobPlans = parseMobilePlans($, mobPage.httpStatus, mobPage.elapsedMs, fetchedAt, mobWarnings);
      allExtracted.push(...mobPlans);
      allWarnings.push(...mobWarnings);
    } else if (mobPage.warning) {
      allWarnings.push(`mobile page: ${mobPage.warning}`);
    }

    // internet 페이지 파싱
    if (intPage.html !== null) {
      const $ = cheerio.load(intPage.html);
      const intWarnings: string[] = [];
      const intPlans = parseInternetPlans($, intPage.httpStatus, intPage.elapsedMs, fetchedAt, intWarnings);
      allExtracted.push(...intPlans);
      allWarnings.push(...intWarnings);
    } else if (intPage.warning) {
      allWarnings.push(`internet page: ${intPage.warning}`);
    }

    // ─── 결과 검증 ──────────────────────────────────────────────────────────
    // 두 페이지 모두 0개면 실패. 한 페이지만 성공해도 ok:true.
    if (allExtracted.length === 0) {
      return {
        ok: false,
        error: {
          fetcherSlug: 'proximus-be',
          fetchedAt,
          kind: mobPage.warning && intPage.warning ? 'network' : 'parse',
          message: `No tariffs parsed from either page. mobile: ${mobPage.warning ?? `${mobPage.httpStatus} ok`}, internet: ${intPage.warning ?? `${intPage.httpStatus} ok`}`,
          rawPayload: {
            stub: false,
            fetcher_version: FETCHER_VERSION,
            mobile_url: MOBILE_SOURCE_URL,
            internet_url: INTERNET_SOURCE_URL,
            mobile_http: { status: mobPage.httpStatus, elapsed_ms: mobPage.elapsedMs },
            internet_http: { status: intPage.httpStatus, elapsed_ms: intPage.elapsedMs },
            warnings: allWarnings,
          },
        },
      };
    }

    const result: FetchResult = {
      fetcherSlug: 'proximus-be',
      fetchedAt,
      data: allExtracted,
    };
    return { ok: true, result };
  },
};

export default proximus;
