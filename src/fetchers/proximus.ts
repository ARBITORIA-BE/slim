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

const FETCHER_VERSION = 'proximus-be@2026-08-19';

const MOBILE_SOURCE_URL = 'https://www.proximus.be/en/mobile-subscription';

const INTERNET_SOURCE_URL = 'https://www.proximus.be/en/internet';

/**
 * Flex+ 팩 목록 페이지 — PLAN 4.26.a (2026-08-19).
 *
 * 쿼리 파라미터 조합 URL (`/en/packs?products=internet,tv`) 은 요청하지 않는다.
 * Proximus robots.txt 는 이를 금지하지 않지만 (2026-08-19 실측), ADR-0053 §B.10.5
 * 잠금 조건("정적 상품 목록 페이지만")을 공급사 구분 없이 그대로 지킨다 —
 * 조건 완화는 ADR Amendment 로만.
 */
const PACKS_SOURCE_URL = 'https://www.proximus.be/en/packs';

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
 * 소수점 *또는* 정수 유로 문자열 → cents (PLAN 4.26.a 팩 페이지용).
 *
 * 왜 eurToCents 와 따로 두는가?
 *   기존 eurToCents 는 소수점을 *필수* 로 요구한다 (mobile/internet 페이지가 항상
 *   "16.99" 형식). 팩 페이지는 프로모가가 "€0" / "€30" 처럼 정수로도 나온다.
 *   기존 함수를 느슨하게 바꾸면 mobile/internet 파싱의 오탐이 늘 수 있어 분리한다.
 *   (ADR-0053 §D6 "부정 판정 시 최소 2개 표기 패턴 재확인" 의 코드판.)
 */
function eurIntOrDecimalToCents(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '');
  const decimal = cleaned.match(/(\d{1,4})[.,](\d{2})\b/);
  if (decimal?.[1] && decimal[2]) {
    return parseInt(decimal[1], 10) * 100 + parseInt(decimal[2], 10);
  }
  const int = cleaned.match(/€(\d{1,4})/) ?? cleaned.match(/(\d{1,4})/);
  if (int?.[1]) return parseInt(int[1], 10) * 100;
  return null;
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

    /**
     * 가격 — `[data-testid="PromoPrice"]` 문장이 있으면 **그것이 진실**이다.
     *
     * 왜 이 경로를 우선하는가? (2026-08-20 회귀)
     *   "3 months free" 캠페인이 시작되면서 표시가가 `€0 /month` 정수가 됐다.
     *   아래 fallback 은 소수점 필수 파서(`eurToCents`)라 `€0` 을 못 읽어
     *   **4개 요금제 중 3개(Go/Mega/Giga Fiber)가 조용히 유실**됐다 —
     *   PLAN 4.26.a 가 packs 페이지에서 잡은 "정수 유로 표기" 함정과 동일 사례.
     *   또한 카드 본문에는 총 할인액(€179.97 = 3 × €59.99)도 같이 있어,
     *   "displayed 보다 큰 값 중 최댓값" 규칙은 이 캠페인에서 총액을 월정액으로
     *   오인한다. PromoPrice 한 문장이 프로모가·기간·정가를 모두 명시하므로
     *   추정 없이 그대로 옮긴다 (packs 파서와 동일 형식).
     */
    const promoPriceText = card
      .find('[data-testid="PromoPrice"]')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();
    const promoSentence = promoPriceText.match(
      /€\s*([\d.,]+)\s*\/month\s*for\s*(\d+)\s*month\(?s?\)?\s*,?\s*then\s*€\s*([\d.,]+)/i,
    );

    let monthlyCents: number;
    let promoPriceCents: number | null = null;
    let promoMonths: number | null = null;

    if (promoSentence?.[1] && promoSentence[2] && promoSentence[3]) {
      const promo = eurIntOrDecimalToCents(promoSentence[1]);
      const regular = eurIntOrDecimalToCents(promoSentence[3]);
      if (regular === null) {
        warnings.push(`${planName}: PromoPrice regular price not parseable (raw: "${promoPriceText}")`);
        return;
      }
      monthlyCents = regular;
      promoPriceCents = promo;
      promoMonths = parseInt(promoSentence[2], 10);
    } else if (promoPriceText.length > 0 && eurIntOrDecimalToCents(promoPriceText) !== null) {
      // 프로모 없는 단순 표기 "€39.99 /month" (Light Fiber)
      monthlyCents = eurIntOrDecimalToCents(promoPriceText) as number;
    } else {
      // ─── fallback: PromoPrice testid 가 없는 구조 (구 마크업 / 다른 레이아웃) ───
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

      monthlyCents = hasPromo ? Math.max(...higher) : displayedCents;
      promoPriceCents = hasPromo ? displayedCents : null;

      // 프로모 개월: "for X months" (internet은 12개월)
      const forMatch = t.match(/for\s*(\d+)\s*month/i);
      promoMonths = hasPromo && forMatch?.[1] ? parseInt(forMatch[1], 10) : null;
    }

    const promoDescription =
      promoPriceCents !== null && promoMonths !== null
        ? `처음 ${promoMonths}개월 €${(promoPriceCents / 100).toFixed(2)} 프로모`
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

// ─── Flex+ 팩(번들) 추출 — PLAN 4.26.a ───────────────────────────────────

/** "2 Gbps" / "8,5 Gbps" / "500 Mbps" → Mbps 정수. */
function toMbps(raw: string): number | null {
  const gbps = raw.match(/(\d+(?:[.,]\d+)?)\s*Gbps/i);
  if (gbps?.[1]) return Math.round(parseFloat(gbps[1].replace(',', '.')) * 1000);
  const mbps = raw.match(/(\d+)\s*Mbps/i);
  if (mbps?.[1]) return parseInt(mbps[1], 10);
  return null;
}

/**
 * 앵커 요소에서 조상을 올라가며 `re` 에 매칭되는 텍스트를 가진 최초 조상의 텍스트를 반환.
 * 페이지 전체로 번지지 않도록 최대 `maxUp` 단계까지만 (가장 가까운 카드가 먼저 걸린다).
 */
function nearestAncestorText(
  anchor: ReturnType<ReturnType<typeof cheerio.load>>,
  re: RegExp,
  maxUp = 8,
): string | null {
  let cur = anchor;
  for (let i = 0; i < maxUp; i++) {
    cur = cur.parent();
    if (cur.length === 0) return null;
    const text = cur.text().replace(/\s+/g, ' ');
    if (re.test(text)) return text;
  }
  return null;
}

/**
 * Flex+ 팩 페이지에서 트리플 플레이(Internet + Mobile + TV) 번들을 추출한다.
 * (2026-08-19 실 HTML 정찰 기준)
 *
 * 앵커 = Angular 컴포넌트가 심는 `data-testid` 3종. 문서 순서가 팩 순서와 1:1:
 *   [data-testid="PromoSpeed"]                       "Mega Fiber 500 Mbps"
 *   [data-testid="PromoPrice"]                       "€0 /month for 3 month(s), then €97.99 /month"
 *   [data-testid="Pack-Composer-Product-Internet-Details"]
 *                                                    "500 Mbps max download speed 500 Mbps max upload speed"
 *
 * 왜 클래스가 아니라 data-testid 인가?
 *   `.rs-*` 유틸리티 클래스는 디자인 변경에 취약하고, `ssa-instance-<uuid>` 류는
 *   렌더마다 바뀐다. testid 는 Proximus 자체 E2E 앵커라 상대적으로 안정적.
 *
 * 왜 인덱스 zip 인가?
 *   팩 카드의 DOM 중첩이 팩마다 다르다 (4번째 Ultra 카드는 프로모 블록 위치가 다름).
 *   조상 탐색은 카드마다 다른 깊이에서 끊기지만, 세 리스트의 *개수와 순서* 는
 *   페이지 의미상 일치한다. 개수가 어긋나면 구조 변경 신호로 보고 0건 반환.
 */
function parsePackBundles(
  $: ReturnType<typeof cheerio.load>,
  httpStatus: number,
  elapsedMs: number,
  fetchedAt: string,
  warnings: string[],
): TariffSnapshotInput[] {
  const speeds = $('[data-testid="PromoSpeed"]');
  const prices = $('[data-testid="PromoPrice"]');
  const details = $('[data-testid="Pack-Composer-Product-Internet-Details"]');

  if (speeds.length === 0) return [];

  if (speeds.length !== prices.length || speeds.length !== details.length) {
    warnings.push(
      `packs: testid count mismatch (speed=${speeds.length} price=${prices.length} details=${details.length}) — 구조 변경 의심, 0건 반환`,
    );
    return [];
  }

  const pageText = $.root().text().replace(/\s+/g, ' ');
  // "Free installation by a technician (value: €79)" — 페이지가 무료라고 공표한 경우만 0.
  const freeInstall = /free installation/i.test(pageText);
  const extracted: TariffSnapshotInput[] = [];

  speeds.each((idx, speedEl) => {
    const planName = $(speedEl).text().replace(/\s+/g, ' ').trim();
    if (!planName) {
      warnings.push(`pack ${idx}: PromoSpeed empty, skipping`);
      return;
    }

    const planWarnings: string[] = [];

    // 가격: "€0 /month for 3 month(s), then €90.99 /month"
    const priceText = $(prices[idx]).text().replace(/\s+/g, ' ').trim();
    const promoPattern = priceText.match(
      /€\s*([\d.,]+)\s*\/month\s*for\s*(\d+)\s*month\(?s?\)?\s*,?\s*then\s*€\s*([\d.,]+)/i,
    );

    let monthlyCents: number | null = null;
    let promoPriceCents: number | null = null;
    let promoMonths: number | null = null;

    if (promoPattern?.[1] && promoPattern[2] && promoPattern[3]) {
      promoPriceCents = eurIntOrDecimalToCents(promoPattern[1]);
      promoMonths = parseInt(promoPattern[2], 10);
      monthlyCents = eurIntOrDecimalToCents(promoPattern[3]);
    } else {
      // 프로모 없는 단순 표기 "€97.99 /month"
      monthlyCents = eurIntOrDecimalToCents(priceText);
      if (priceText.length > 0 && monthlyCents !== null) {
        planWarnings.push(`${planName}: promo pattern not matched (raw: "${priceText}")`);
      }
    }

    if (monthlyCents === null) {
      warnings.push(`${planName}: monthly price not parseable (raw: "${priceText}")`);
      return;
    }

    // 속도: "500 Mbps max download speed 500 Mbps max upload speed"
    const detailText = $(details[idx]).text().replace(/\s+/g, ' ').trim();
    const downMatch = detailText.match(/([\d.,]+\s*[GM]bps)\s*max\s*download/i);
    const upMatch = detailText.match(/([\d.,]+\s*[GM]bps)\s*max\s*upload/i);
    const downloadMbps = downMatch?.[1] ? toMbps(downMatch[1]) : null;
    const uploadMbps = upMatch?.[1] ? toMbps(upMatch[1]) : null;
    if (downloadMbps === null) planWarnings.push(`${planName}: download_mbps not extracted`);
    if (uploadMbps === null) planWarnings.push(`${planName}: upload_mbps not extracted`);

    /**
     * 구성 증거 — "20 GB mobile data + 5G network" (2026-08-20 신설 가드).
     *
     * 왜 없으면 *건너뛰는가* (warning 이 아니라)?
     *   `/en/internet` 단품 페이지가 packs 와 **동일한 testid 3종을 4쌍씩** 쓴다
     *   (2026-08-20 실측: PromoSpeed/PromoPrice/Internet-Details 각 4). 즉 앵커만으로는
     *   두 페이지를 구분할 수 없다. 지금은 URL 이 달라 사고가 안 나지만, Proximus 가
     *   레이아웃·리다이렉트를 바꾸면 **인터넷 단품이 트리플 플레이 번들로 둔갑**한다.
     *   페이지 URL 을 카테고리 근거로 삼지 않는다는 원칙(Telenet/Orange 파서와 동일)을
     *   Proximus 에도 적용 — 모바일 데이터가 카드에 *명시된 경우에만* 번들로 편입한다.
     *   두 페이지의 유일한 판별 신호가 이것이다 (packs 8건 vs internet 0건).
     */
    const cardText = nearestAncestorText($(speedEl), /GB mobile data/i);
    const gbMatch = cardText?.match(/(\d+)\s*GB mobile data/i);
    const dataGb = gbMatch?.[1] ? parseInt(gbMatch[1], 10) : null;
    if (dataGb === null) {
      warnings.push(
        `${planName}: no mobile-data evidence on card — 번들 아님으로 판정하고 건너뜀 (페이지 구조 변경 신호)`,
      );
      return;
    }

    const unlimitedData = /unlimited internet/i.test(cardText ?? pageText);

    const sanity = checkMonthlySanity(monthlyCents);
    const confidenceResult = computeConfidence({
      selectorMatched: true,
      sanityChecks: [sanity],
      parseWarnings: planWarnings,
    });

    warnings.push(...planWarnings);

    const kebab = planName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    extracted.push({
      providerSlug: 'proximus-be',
      tariffSlug: `proximus-pack-${kebab}`,
      tariffName: `${planName} + Mobile + TV`,
      category: 'bundle_mobile_internet_tv',
      monthlyPriceCents: monthlyCents,
      activationFeeCents: freeInstall ? 0 : 7900, // 페이지 공표: 기술자 설치 €79, 현재 무료 프로모
      modemRentalCents: 0, // Internet Box 기본 포함
      promoPriceCents,
      promoMonths,
      promoDescription:
        promoPriceCents !== null && promoMonths !== null
          ? `처음 ${promoMonths}개월 €${(promoPriceCents / 100).toFixed(2)} 프로모`
          : null,
      commitmentMonths: 0, // 페이지 명시 "Non-binding subscription"
      earlyTerminationFeeCents: null,
      attributes: {
        category: 'bundle_mobile_internet_tv',
        download_mbps: downloadMbps ?? 1,
        upload_mbps: uploadMbps ?? 1,
        unlimited_data: unlimitedData,
        fair_use_gb: null,
        wifi_booster_included: false,
        tv_channels: null, // 페이지가 채널 수를 숫자로 밝히지 않음 (ADR-0042 Amendment 2)
        tv_4k_included: null,
        data_gb: dataGb ?? undefined,
        voice_minutes: undefined,
        eu_roaming_included: true, // EU Roam-like-at-home (2017+ 법적 의무)
        included_services: { internet: true, mobile: true, tv: true },
      },
      sourceUrl: PACKS_SOURCE_URL,
      confidence: confidenceResult.confidence,
      confidenceReason: confidenceResult.reason,
      rawPayload: {
        stub: false,
        fetcher_version: FETCHER_VERSION,
        url: PACKS_SOURCE_URL,
        fetched_at: fetchedAt,
        http: { status: httpStatus, elapsed_ms: elapsedMs },
        extracted: {
          plan_name: planName,
          price_text: priceText,
          monthly_cents: monthlyCents,
          promo_cents: promoPriceCents,
          promo_months: promoMonths,
          speed_text: detailText,
          download_mbps: downloadMbps,
          upload_mbps: uploadMbps,
          data_gb: dataGb,
        },
        assumptions: [
          // 페이지 각주 원문 — 이 가격이 "어떤 구성"의 가격인지 사용자에게 전달할 근거 (P1).
          'Proximus 각주: "Price is based on the basic composition with Internet + mobile 20 GB + TV and may vary according to further configuration."',
        ],
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
    /**
     * Proximus 는 mobile + internet_fixed 두 카테고리를 커버한다.
     * admin-metrics 의 CASE WHEN 매핑 자동 생성 용 (PLAN 1.5.6).
     */
    categories: ['mobile', 'internet_fixed', 'bundle_mobile_internet_tv'] as const,
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
    const packPage = await fetchPage(PACKS_SOURCE_URL);

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

    // packs 페이지 파싱 (PLAN 4.26.a — 트리플 플레이 번들)
    if (packPage.html !== null) {
      const $ = cheerio.load(packPage.html);
      const packWarnings: string[] = [];
      const packs = parsePackBundles(
        $,
        packPage.httpStatus,
        packPage.elapsedMs,
        fetchedAt,
        packWarnings,
      );
      allExtracted.push(...packs);
      allWarnings.push(...packWarnings);
    } else if (packPage.warning) {
      allWarnings.push(`packs page: ${packPage.warning}`);
    }

    // ─── 결과 검증 ──────────────────────────────────────────────────────────
    // 두 페이지 모두 0개면 실패. 한 페이지만 성공해도 ok:true.
    if (allExtracted.length === 0) {
      return {
        ok: false,
        error: {
          fetcherSlug: 'proximus-be',
          fetchedAt,
          kind:
            mobPage.warning && intPage.warning && packPage.warning ? 'network' : 'parse',
          message: `No tariffs parsed from any page. mobile: ${mobPage.warning ?? `${mobPage.httpStatus} ok`}, internet: ${intPage.warning ?? `${intPage.httpStatus} ok`}, packs: ${packPage.warning ?? `${packPage.httpStatus} ok`}`,
          rawPayload: {
            stub: false,
            fetcher_version: FETCHER_VERSION,
            mobile_url: MOBILE_SOURCE_URL,
            internet_url: INTERNET_SOURCE_URL,
            packs_url: PACKS_SOURCE_URL,
            mobile_http: { status: mobPage.httpStatus, elapsed_ms: mobPage.elapsedMs },
            internet_http: { status: intPage.httpStatus, elapsed_ms: intPage.elapsedMs },
            packs_http: { status: packPage.httpStatus, elapsed_ms: packPage.elapsedMs },
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
