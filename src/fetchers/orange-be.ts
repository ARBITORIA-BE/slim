/**
 * Orange BE 실 스크래핑 fetcher (PLAN 1.5.8)
 *
 * internet_fixed 카테고리 3 plans (Start / Zen / Giga Internet) 만 정적 추출.
 *
 * 왜 Internet 만인가? — 페이지 단위 정적 가용성 (ADR-0013 Amendment 3, 2026-05-28)
 *   • Internet 페이지 (`/fr/produits-et-services/internet-chez-vous`):
 *     `.obe-pricebox` 컨테이너 × 3 (Start €38/€53, Zen €47/€62, Giga €57/€72),
 *     `<del>` 정가 + `.obe-price-amount` 프로모 + 본문 Mbps 텍스트 모두 정적.
 *     `<span>` 플랜명 직전 형제. 4번째 "All in Internet" 은 별도 pricebox 없이
 *     푸터/번들 configurer 경로 (robots.txt `Disallow: /*internet=&mobile=` 차단)
 *     에서만 노출 → fetcher 범위 외.
 *   • Mobile 페이지 (`/fr/mobile/abonnements-gsm`):
 *     `<obe-dps-price>` 웹 컴포넌트 (JS 런타임 렌더링)로 가격 표시.
 *     정적 HTML 에는 `discount-text=" "` placeholder 만 존재 — 표시 가격 부재.
 *     ADR-0013 Amendment 3 의 "internet 매칭 0 → manual 폴백" 패턴 역방향 사례 —
 *     Orange BE 는 mobile 이 JS 렌더링. 본 fetcher 는 mobile 미커버 (정직 표기) —
 *     1.5.8 후속 라운드에서 (a) Orange catalog API 엔드포인트 발견 후 method='api'
 *     로 전환 또는 (b) operator manual seed 스크립트 (~월 1회) 결정.
 *
 * 왜 스크래핑인가?
 *   Orange BE 는 공식 가격 API 를 제공하지 않는다 (Telenet 의 api.prd.telenet.be 같은
 *   OAuth 게이트 API 도 발견 안 됨, ADR-0013 Amendment 3 비교). HTML 페이지 파싱.
 *
 * legal 게이트 OPEN (ADR-0013 Appendix B Amendment 2026-06-05):
 *   GTC 3종 PDF (postpaid / sales / fiber) 수동 열람 완료 — 자동 접근 직접 금지 0건,
 *   "utilisation strictement personnelle" 조항 소비자 GTC 미존재. Proximus/Telenet 과
 *   동일 패턴 (WEAK). B.5 공통 조건 준수 전제로 머지 게이트 OPEN.
 *
 * Voo 흡수 (ADR-0034 Amendment 1, 2026-06-04):
 *   2025-10-01 Voo S.A. → Orange Belgium 합병 완료. voo.be 도메인은 운영 중이나
 *   `voo.be/fr/internet` 정적 HTML 에 가격 부재 (PDF "Nos prix à partir du 1
 *   Janvier 2026" 안내만). 본 fetcher 는 voo.be 도메인 fetch 하지 않음 — 정적 가격
 *   부재로 0 tariff 기여 확정. 정직성 UI 보조: `/data-sources` 페이지 캐비엇
 *   "Voo 는 2025-10 Orange Belgium 에 합병되어 본 fetcher 범위에 포함" 1줄
 *   (ADR-0034 Amendment 1 §Consequences "잃는 것"). 후속 라운드 처리.
 *
 * HTML 구조 (2026-06-05 실 HTML 정찰 기준):
 *   Internet (`/fr/produits-et-services/internet-chez-vous`):
 *     <div class="dispatch-card-container">
 *       <span>Start Internet</span>
 *       <strong>200 Mbps*</strong>  <!-- download -->
 *       <strong>15 Mbps*</strong>   <!-- upload -->
 *       <div class="obe-pricebox">
 *         <div class="obe-price-prefix">
 *           <del>53€/mois</del>  <!-- regular -->
 *         </div>
 *         <div class="obe-price">
 *           <strong class="obe-price-amount">38</strong>  <!-- promo amount -->
 *           <span class="obe-price-unit">€/mois</span>
 *         </div>
 *         <div class="obe-price-suffix">...</div>  <!-- "pendant N mois" -->
 *       </div>
 *     </div>
 *   (Zen / Giga 동일 구조)
 *
 * 셀렉터 재검증 트리거:
 *   첫 프로덕션 fetch 후 rawPayload.warnings 에 "obe-pricebox not found" 또는
 *   "plan-name span not found" 항목 발견 시 ADR-0013 §B.5 자동 비활성화 + Sentry.
 *   셀렉터 조정 후 재배포.
 *
 * B.5 컴플라이언스:
 *   HTTP !ok / 403 / 429 / 챌린지 페이지 → throw 없이 ok:false 반환.
 *   일 1회 이하 fetch (cron schedule), 정직한 User-Agent, 쿼리 파라미터 URL 미접근
 *   (`?internet=` `?mobile=` robots Disallow 자동 회피 — 본 fetcher 는 쿼리 없는
 *   기본 경로만 fetch).
 *
 * STUB_FAIL_ORANGE_BE=1:
 *   1.9 격리 수동 검증용 — 실 fetcher 에도 유지 (테스트 격리 시나리오 보호).
 *
 * 결정 근거:
 *   - docs/adr/0013-fetcher-real-scraping-risk-assessment.md Appendix B Amendment (2026-06-05)
 *   - docs/adr/0013-fetcher-real-scraping-risk-assessment.md Amendment 3 (2026-05-28)
 *   - docs/adr/0034-strategy-pivot-completion-first-seo-launch.md Amendment 1 (2026-06-04)
 */

import * as cheerio from 'cheerio';
import type { Fetcher, FetchOutcome, FetchResult, TariffSnapshotInput } from './types';
import { computeConfidence, checkMonthlySanity } from './confidence';
import { STUB_FETCH_TIMEOUT_MS, stubFailOutcome } from './_shared';

// ─── 상수 ─────────────────────────────────────────────────────────────────

const FETCHER_VERSION = 'orange-be@2026-08-19';

const INTERNET_SOURCE_URL =
  'https://www.orange.be/fr/produits-et-services/internet-chez-vous';

/**
 * 번들(Love) 팩 목록 페이지 — PLAN 4.26.a (2026-08-19).
 *
 * B.10.5 잠금 조건 준수: *쿼리 파라미터가 붙은 configurer URL 을 요청하지 않는다.*
 *   robots.txt `Disallow: /*internet=` / `/*mobile=` 이 `configurer-votre-pack?...`
 *   을 차단한다. 본 fetcher 는 쿼리 없는 정적 목록 페이지만 요청하고, 카드 안의
 *   configurer 링크는 *읽기만* 한다 (slug 안정화용 제품 코드 추출 — 요청 0).
 */
const BUNDLE_SOURCE_URL =
  'https://www.orange.be/fr/produits-et-services/internet-tv-mobile';

/**
 * 커버 중단 선언 (PLAN 4.26.a) — persist 가 이 카테고리의 잔존 요금제를 비활성화한다.
 *
 * 2026-08-19 이전에 수집된 Orange internet_fixed 요금제(Start/Zen/Giga Internet)는
 * **더 이상 존재하지 않는 상품** 이다 (Livebox 계열로 개편). 그대로 두면 6월 가격이
 * 현재가처럼 노출된다. parseInternetPlans 가 다시 1건이라도 뽑으면 실측이 이 선언을
 * 덮으므로 (persist §4), Orange 가 정적 가격을 되돌리면 자동 복구된다.
 * → 정적 가격이 복구되어 metadata.categories 에 internet_fixed 를 되돌릴 때
 *   이 상수도 함께 지운다.
 */
const RETIRED_CATEGORIES = ['internet_fixed'] as const;

const HOMEPAGE_URL = 'https://www.orange.be';

/**
 * P3 투명성: 정직한 User-Agent (ADR-0013 §B.5 공통 조건).
 * 봇 차단 우회 목적이 아니라 크롤러 정체를 명시.
 */
const USER_AGENT =
  'Slim/1.0 (+https://slim.lu; price comparison; contact kim.wonmin91@gmail.com)';

/**
 * 인식 대상 Internet plan 키워드 (소문자) → 정식 명칭 + slug.
 *
 * 왜 Map 인가?
 *   페이지 마크업이 "Start Internet" 형식 (adjective Internet) — 키워드는
 *   소문자 어두로 매칭하고, 출력에는 페이지의 실제 표시명을 그대로 사용.
 *
 * 왜 "Orange Internet Start" 형식 아닌가?
 *   Orange BE 페이지는 "Start Internet" 으로 표시 — 사용자가 비교 결과에서
 *   인지하는 라벨과 일치시켜 P3 정직성 유지.
 *
 * "All in Internet" 제외 사유:
 *   별도 obe-pricebox 없음 — 푸터 텍스트 + 번들 configurer 경로 (`?internet=...`
 *   robots Disallow) 에서만 노출. 본 fetcher 정찰 시 추출 0 → false negative
 *   warning 회피 위해 인식 대상에서 제외.
 */
const INTERNET_PLANS = new Map<string, { displayName: string; slug: string }>([
  ['start', { displayName: 'Start Internet', slug: 'orange-be-internet-start' }],
  ['zen',   { displayName: 'Zen Internet',   slug: 'orange-be-internet-zen' }],
  ['giga',  { displayName: 'Giga Internet',  slug: 'orange-be-internet-giga' }],
]);

// ─── 파싱 유틸 ────────────────────────────────────────────────────────────

/**
 * 유로 문자열 → cents 정수.
 * "53€/mois", "53 €", "47", "62.50", "62,50" 등 처리.
 * 매칭 실패 시 null.
 */
function eurToCents(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '');
  // 소수점: "53.00", "62,50"
  const decimalMatch = cleaned.match(/(\d{1,3})[.,](\d{2})/);
  if (decimalMatch?.[1] && decimalMatch?.[2]) {
    return parseInt(decimalMatch[1], 10) * 100 + parseInt(decimalMatch[2], 10);
  }
  // 정수: "53", "47"
  const intMatch = cleaned.match(/(\d{1,3})/);
  if (intMatch?.[1]) {
    return parseInt(intMatch[1], 10) * 100;
  }
  return null;
}

/**
 * Cloudflare / Imperva / Akamai 챌린지 페이지 감지 (B.5 컴플라이언스).
 *
 * 주의: `_Incapsula_Resource` 단독 검출 금지 — 정상 페이지(Orange BE 포함)도
 *   Imperva CDN 통과 시 리소스 스크립트 URL 에 해당 문자열을 포함.
 *   실제 챌린지 페이지는 본문이 거의 비어 있고 챌린지 안내 문구가 포함됨.
 */
function isChallengeBody(body: string): boolean {
  return (
    body.includes('Just a moment') ||
    body.includes('cf-browser-verification') ||
    body.includes('_cf_chl_opt') ||
    body.includes('Pardon Our Interruption') || // Imperva 표준 챌린지 문구
    body.includes('Request unsuccessful') // Imperva 차단 문구
  );
}

// ─── Internet 추출 ────────────────────────────────────────────────────────

/**
 * Internet 페이지 HTML 에서 요금제를 추출한다.
 *
 * 전략 (selector-driven, Proximus 패턴 응용):
 *   1. `.obe-pricebox` 컨테이너를 순회한다 (페이지 내 정확히 3개 예상).
 *   2. 각 pricebox 의 상위 카드 (`.dispatch-card-container`) 에서 plan 명 span
 *      을 찾고, INTERNET_PLANS 키워드와 매칭하여 plan 식별.
 *   3. pricebox 안에서:
 *      - `<del>` = 정규가 (€53)
 *      - `.obe-price-amount` = 표시 가격 (= 프로모 가격 €38)
 *      - 같은 카드 본문에서 download/upload Mbps 추출
 *
 * 왜 pricebox 우선 순회인가? (Proximus parseMobilePlans 역설계)
 *   plan 명을 anchor 로 잡으면 다국어 변형 / 푸터 텍스트 false match 위험.
 *   가격 컨테이너를 anchor 로 잡으면 카드 단위 1:1 추출이 보장됨.
 */
function parseInternetPlans(
  $: ReturnType<typeof cheerio.load>,
  httpStatus: number,
  elapsedMs: number,
  fetchedAt: string,
): TariffSnapshotInput[] {
  const extracted: TariffSnapshotInput[] = [];

  $('.obe-pricebox').each((_, priceboxEl) => {
    const pricebox = $(priceboxEl);

    // 카드 컨테이너 — pricebox 의 가장 가까운 .obe-card 필수.
    // .obe-banner-header (페이지 상단 hero/promo 배너) 안의 pricebox 는 plan 명이
    // 없는 광고용 가격 노출 → skip (실 HTML 정찰 2026-06-05 에서 발견된
    // false-positive 패턴). 카드 wrapper 없으면 0 plans 안전 폐기.
    const card = pricebox.closest('.obe-card');
    if (card.length === 0) return;

    // 카드 텍스트 (Mbps 추출용)
    const cardText = card.text().replace(/\s+/g, ' ');

    // plan 명 — 카드 내 span 중 INTERNET_PLANS 키워드 매칭
    let planKey: string | null = null;
    let planDisplayName: string | null = null;
    card.find('span').each((_idx, spanEl) => {
      if (planKey !== null) return;
      const spanText = $(spanEl).text().trim();
      for (const [key, info] of INTERNET_PLANS.entries()) {
        // "Start Internet" (정확 매칭) — span 텍스트가 plan 명 자체
        if (spanText === info.displayName) {
          planKey = key;
          planDisplayName = info.displayName;
          return;
        }
      }
    });

    if (!planKey || !planDisplayName) {
      // 카드 헤더 외 다른 span 에 plan 명이 있을 가능성 — 카드 텍스트 키워드 fallback
      for (const [key, info] of INTERNET_PLANS.entries()) {
        if (cardText.includes(info.displayName)) {
          planKey = key;
          planDisplayName = info.displayName;
          break;
        }
      }
    }

    if (!planKey || !planDisplayName) return;

    const planInfo = INTERNET_PLANS.get(planKey);
    if (!planInfo) return;

    const warnings: string[] = [];

    // 정규가: <del> 안의 € 텍스트 (예: "53€/mois")
    const delText = pricebox.find('del').first().text();
    const regularCents = eurToCents(delText);

    // 프로모/표시 가격: .obe-price-amount 안의 숫자 (예: "38")
    const amountText = pricebox.find('.obe-price-amount').first().text();
    const amountCents = eurToCents(amountText);

    if (amountCents === null) {
      warnings.push(`${planInfo.displayName}: .obe-price-amount not parseable (raw: "${amountText}")`);
      return;
    }

    // hasPromo 판정: <del> 정규가 > .obe-price-amount → 프로모 진행 중
    const hasPromo = regularCents !== null && regularCents > amountCents;

    const monthlyCents = hasPromo ? regularCents! : amountCents;
    const promoPriceCents = hasPromo ? amountCents : null;

    // 프로모 개월: 페이지 본문에 "pendant N mois" 패턴
    const pendantMatch =
      cardText.match(/pendant\s+(\d+)\s+mois/i) ??
      cardText.match(/gedurende\s+(\d+)\s+maanden/i);
    const promoMonths = hasPromo && pendantMatch?.[1] ? parseInt(pendantMatch[1], 10) : null;
    const promoDescription =
      hasPromo && promoMonths !== null && promoPriceCents !== null
        ? `처음 ${promoMonths}개월 €${(promoPriceCents / 100).toFixed(0)} 프로모`
        : null;

    // download/upload Mbps — 카드 본문에서 "X Mbps" 패턴
    // Orange BE 페이지: "<strong>200 Mbps*</strong>" 형식, 첫 매칭=download, 두 번째=upload
    const mbpsMatches = [...cardText.matchAll(/(\d+)\s*Mbps/gi)];
    let downloadMbps: number | null = null;
    let uploadMbps: number | null = null;
    if (mbpsMatches.length >= 1 && mbpsMatches[0]?.[1]) {
      downloadMbps = parseInt(mbpsMatches[0][1], 10);
    }
    if (mbpsMatches.length >= 2 && mbpsMatches[1]?.[1]) {
      uploadMbps = parseInt(mbpsMatches[1][1], 10);
    }

    if (downloadMbps === null) {
      warnings.push(`${planInfo.displayName}: download_mbps not extracted`);
    }
    if (uploadMbps === null) {
      warnings.push(`${planInfo.displayName}: upload_mbps not extracted`);
    }

    const sanity = checkMonthlySanity(monthlyCents);
    const confidenceResult = computeConfidence({
      selectorMatched: true,
      sanityChecks: [sanity],
      parseWarnings: warnings,
    });

    extracted.push({
      providerSlug: 'orange-be',
      tariffSlug: planInfo.slug,
      tariffName: planInfo.displayName,
      category: 'internet_fixed',
      monthlyPriceCents: monthlyCents,
      activationFeeCents: 3900, // Orange BE: "Frais d'installation : 39€" (페이지 푸터)
      modemRentalCents: 0, // Orange BE: 모뎀 (Livebox) 기본 포함
      promoPriceCents,
      promoMonths,
      promoDescription,
      commitmentMonths: 0, // Orange BE internet non-binding (소비자 GTC 확인)
      earlyTerminationFeeCents: null,
      attributes: {
        category: 'internet_fixed',
        download_mbps: downloadMbps ?? 1, // 추출 실패 시 최소값 (warning 추가됨)
        upload_mbps: uploadMbps ?? 1,
        unlimited_data: true, // Orange BE internet "illimité" (페이지 본문 + Appendix C 확인)
        fair_use_gb: null,
        wifi_booster_included: false, // 기본 미포함, WiFi Booster 옵션 별도 가격
      },
      sourceUrl: INTERNET_SOURCE_URL,
      confidence: confidenceResult.confidence,
      confidenceReason: confidenceResult.reason,
      rawPayload: {
        stub: false, // 실 스크래핑 — BetaEstimatedBanner 1.5.6.1 자동 비활성 신호
        fetcher_version: FETCHER_VERSION,
        url: INTERNET_SOURCE_URL,
        fetched_at: fetchedAt,
        http: { status: httpStatus, elapsed_ms: elapsedMs },
        extracted: {
          plan_key: planKey,
          plan_name: planInfo.displayName,
          monthly_cents: monthlyCents,
          promo_cents: promoPriceCents,
          regular_cents_del: regularCents,
          download_mbps: downloadMbps,
          upload_mbps: uploadMbps,
        },
        warnings,
        ...sanity,
      },
    });
  });

  return extracted;
}

// ─── 번들(Love 팩) 추출 — PLAN 4.26.a ────────────────────────────────────

/**
 * 카드 헤더 태그 3종(Internet / Mobile / TV)이 모두 있는지 판정.
 *
 * 왜 태그 기반인가?
 *   Orange 는 번들 구성(무엇이 들어있는지)을 카드 헤더 `.obe-tag` 로 *공급사가
 *   직접* 선언한다. 우리가 카드 본문을 해석해 추측하지 않고 그 선언을 그대로
 *   카테고리로 옮긴다 (P1 — 공급사 분류를 가공하지 않음, ADR-0042 §D2).
 *   fr/nl 두 로케일 표기를 모두 인식 (Mobile/Mobiel).
 */
function classifyBundleTags(tags: readonly string[]): {
  internet: boolean;
  mobile: boolean;
  tv: boolean;
} {
  const lower = tags.map((t) => t.toLowerCase());
  return {
    internet: lower.some((t) => t === 'internet'),
    mobile: lower.some((t) => t === 'mobile' || t === 'mobiel'),
    tv: lower.some((t) => t === 'tv'),
  };
}

/**
 * `.obe-icon-table-item` 한 줄에서 "라벨: 제품명" + 상세 문구를 뽑는다.
 * 예: <strong>Internet </strong>: Livebox / "Téléchargement jusqu'à 200 Mbps"
 */
function readIconRows(
  $: ReturnType<typeof cheerio.load>,
  card: ReturnType<ReturnType<typeof cheerio.load>>,
): Array<{ label: string; product: string; detail: string }> {
  const rows: Array<{ label: string; product: string; detail: string }> = [];
  card.find('.obe-icon-table-item').each((_, itemEl) => {
    const item = $(itemEl);
    const proses = item.find('.obe-prose');
    const head = proses.eq(0).text().replace(/\s+/g, ' ').trim();
    const detail = proses.eq(1).text().replace(/\s+/g, ' ').trim();
    const label = item.find('strong').first().text().replace(/\s+/g, ' ').trim();
    // "Internet : Livebox" → product = "Livebox"
    const product = head.includes(':') ? head.slice(head.indexOf(':') + 1).trim() : head;
    rows.push({ label, product, detail });
  });
  return rows;
}

/** "Téléchargement jusqu'à 200 Mbps" / "1 Gbps" → Mbps 정수. */
function speedToMbps(raw: string): number | null {
  const gbps = raw.match(/(\d+(?:[.,]\d+)?)\s*Gbps/i);
  if (gbps?.[1]) return Math.round(parseFloat(gbps[1].replace(',', '.')) * 1000);
  const mbps = raw.match(/(\d+)\s*Mbps/i);
  if (mbps?.[1]) return parseInt(mbps[1], 10);
  return null;
}

/**
 * 번들 페이지 HTML 에서 Love 팩을 추출한다 (2026-08-19 실 HTML 정찰 기준).
 *
 * 구조:
 *   div.obe-card
 *     .obe-product-header .obe-tag × N     ← 번들 구성 선언 (Internet/Mobile/TV)
 *     .obe-icon-table-item × 3             ← 제품명 + 상세 (속도 / GB / 채널)
 *     .obe-pricebox
 *       strong.obe-price-amount  "61"      ← *표시* 가격 (프로모 진행 시 프로모가)
 *       .obe-price-suffix "71 €/mois après 12 mois" | "à vie"
 *
 * 프로모 판정 (Internet 페이지의 `<del>` 패턴과 다름 — 여기선 suffix 문장):
 *   "N €/mois après M mois" → 정가 = N, 프로모가 = amount, 프로모 개월 = M
 *   "à vie" (평생가) / suffix 없음 → 프로모 없음, 정가 = amount
 *
 * `.obe-banner-header` 안의 hero pricebox 는 `.obe-card` 조상이 없어 자동 제외
 * (Internet 파서와 동일한 false-positive 가드).
 */
function parseBundlePacks(
  $: ReturnType<typeof cheerio.load>,
  httpStatus: number,
  elapsedMs: number,
  fetchedAt: string,
): TariffSnapshotInput[] {
  const extracted: TariffSnapshotInput[] = [];

  $('div.obe-card').each((_, cardEl) => {
    const card = $(cardEl);

    const tags = card
      .find('.obe-product-header .obe-tag')
      .map((_i, tagEl) => $(tagEl).text().trim())
      .get();
    const parts = classifyBundleTags(tags);

    // 현재 라운드가 커버하는 조합은 트리플(Internet+Mobile+TV) 하나.
    // 다른 조합(듀얼 등)이 이 페이지에 등장하면 카테고리 매핑 근거가 없으므로
    // 조용히 건너뛴다 — 추측 편입 금지 (ADR-0053 §D2 "미정 금지"의 fetcher 판).
    if (!parts.internet || !parts.mobile || !parts.tv) return;

    const pricebox = card.find('.obe-pricebox').first();
    if (pricebox.length === 0) return;

    const warnings: string[] = [];

    const amountCents = eurToCents(pricebox.find('.obe-price-amount').first().text());
    if (amountCents === null) return;

    const suffix = pricebox.find('.obe-price-suffix').first().text().replace(/\s+/g, ' ').trim();
    // "71 €/mois après 12 mois" / "71 €/maand na 12 maanden"
    const afterMatch =
      suffix.match(/(\d+(?:[.,]\d+)?)\s*€\s*\/\s*mois\s*apr[eè]s\s*(\d+)\s*mois/i) ??
      suffix.match(/(\d+(?:[.,]\d+)?)\s*€\s*\/\s*maand\s*na\s*(\d+)\s*maanden/i);

    let monthlyCents = amountCents;
    let promoPriceCents: number | null = null;
    let promoMonths: number | null = null;

    if (afterMatch?.[1] && afterMatch[2]) {
      const regularCents = eurToCents(afterMatch[1]);
      if (regularCents !== null && regularCents > amountCents) {
        monthlyCents = regularCents;
        promoPriceCents = amountCents;
        promoMonths = parseInt(afterMatch[2], 10);
      }
    } else if (suffix.length > 0 && !/à vie|voor altijd/i.test(suffix)) {
      // 알 수 없는 suffix 문장 = 프로모 구조 변경 신호 → confidence 격하
      warnings.push(`unknown price suffix: "${suffix}"`);
    }

    const rows = readIconRows($, card);
    const internetRow = rows.find((r) => /^internet/i.test(r.label));
    const mobileRow = rows.find((r) => /^mobi/i.test(r.label));
    const tvRow = rows.find((r) => /^tv/i.test(r.label));

    const downloadMbps = internetRow ? speedToMbps(internetRow.detail) : null;
    if (downloadMbps === null) warnings.push('download_mbps not extracted');
    // 업로드 속도는 번들 페이지에 미표기 (Internet 페이지에만 존재).
    warnings.push('upload_mbps not published on bundle page');

    // "12 GB, appels et SMS illimités" / "300 GB"
    let dataGb: number | 'unlimited' | null = null;
    if (mobileRow) {
      const gb = mobileRow.detail.match(/(\d+)\s*GB/i);
      if (gb?.[1]) dataGb = parseInt(gb[1], 10);
      else if (/illimit|onbeperkt|unlimited/i.test(mobileRow.detail)) dataGb = 'unlimited';
    }
    if (dataGb === null) warnings.push('data_gb not extracted');

    // "20 chaînes essentielle via streaming" / "Jusqu'à 70 chaînes avec décodeur"
    let tvChannels: number | null = null;
    if (tvRow) {
      const ch = tvRow.detail.match(/(\d+)\s*(?:cha[îi]nes|zenders|channels)/i);
      if (ch?.[1]) tvChannels = parseInt(ch[1], 10);
    }

    // 표시명 — 공급사 제품명 3개 조합 ("Orange " 접두는 중복이라 제거).
    const strip = (s: string): string => s.replace(/^Orange\s+/i, '').trim();
    const nameParts = [internetRow?.product, mobileRow?.product, tvRow?.product]
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
      .map(strip);
    const marketingLabel = card
      .find('.obe-product-header-text')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();
    const tariffName = nameParts.length === 3 ? nameParts.join(' + ') : `Pack ${marketingLabel}`;

    /**
     * slug 안정성: 카드의 configurer 링크에 붙은 *제품 코드* 를 읽는다
     * (`?internet=net-s&mobile=mob-s&tv=tv-lite`). 마케팅 라벨("Le moins cher")은
     * 캠페인마다 바뀌지만 제품 코드는 카탈로그 식별자라 시계열 연결이 끊기지 않는다.
     * ⚠️ 링크는 *읽기만* 한다 — 이 URL 을 fetch 하면 robots 위반 (B.10.5).
     */
    const configHref = card.find('a[href*="configurer"]').first().attr('href') ?? '';
    const codes = ['internet', 'mobile', 'tv']
      .map((k) => new RegExp(`[?&]${k}=([a-z0-9-]+)`, 'i').exec(configHref)?.[1] ?? null)
      .filter((c): c is string => c !== null);
    const tariffSlug =
      codes.length === 3
        ? `orange-be-pack-${codes.join('-')}`
        : `orange-be-pack-${marketingLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

    const sanity = checkMonthlySanity(monthlyCents);
    const confidenceResult = computeConfidence({
      selectorMatched: true,
      sanityChecks: [sanity],
      parseWarnings: warnings,
    });

    extracted.push({
      providerSlug: 'orange-be',
      tariffSlug,
      tariffName,
      category: 'bundle_mobile_internet_tv',
      monthlyPriceCents: monthlyCents,
      // 번들 페이지에 설치비 미표기 — Internet 페이지 푸터의 €39 를 동일 적용
      // (rawPayload.assumptions 에 근거 명시. 추측이 아니라 *같은 공급사의 공표값*).
      activationFeeCents: 3900,
      modemRentalCents: 0, // Livebox 기본 포함 (Internet 파서와 동일 근거)
      promoPriceCents,
      promoMonths,
      promoDescription:
        promoPriceCents !== null && promoMonths !== null
          ? `처음 ${promoMonths}개월 €${(promoPriceCents / 100).toFixed(0)} 프로모`
          : null,
      commitmentMonths: 0, // Orange BE 소비자 상품 무약정 (GTC 확인 — Appendix B)
      earlyTerminationFeeCents: null,
      attributes: {
        category: 'bundle_mobile_internet_tv',
        download_mbps: downloadMbps ?? 1, // 추출 실패 시 최소값 (warning 동반)
        upload_mbps: 1, // 번들 페이지 미표기 (warning 동반) — 값 자체는 미신뢰
        unlimited_data: true, // "internet illimité" (Orange BE 공통 — Internet 파서와 동일)
        fair_use_gb: null,
        wifi_booster_included: false,
        tv_channels: tvChannels, // null = 공급사 미표기 (ADR-0042 Amendment 2)
        tv_4k_included: null, // 번들 페이지 미표기
        data_gb: dataGb ?? undefined,
        voice_minutes:
          mobileRow && /illimit|onbeperkt|unlimited/i.test(mobileRow.detail)
            ? ('unlimited' as const)
            : undefined,
        eu_roaming_included: true, // EU Roam-like-at-home (2017+ 법적 의무)
        included_services: { internet: true, mobile: true, tv: true },
      },
      sourceUrl: BUNDLE_SOURCE_URL,
      confidence: confidenceResult.confidence,
      confidenceReason: confidenceResult.reason,
      rawPayload: {
        stub: false,
        fetcher_version: FETCHER_VERSION,
        url: BUNDLE_SOURCE_URL,
        fetched_at: fetchedAt,
        http: { status: httpStatus, elapsed_ms: elapsedMs },
        extracted: {
          tags,
          marketing_label: marketingLabel,
          product_codes: codes,
          monthly_cents: monthlyCents,
          promo_cents: promoPriceCents,
          promo_months: promoMonths,
          price_suffix: suffix,
          download_mbps: downloadMbps,
          data_gb: dataGb,
          tv_channels: tvChannels,
        },
        assumptions: [
          'activation_fee 3900 = Internet 페이지 공표 설치비 €39 (번들 페이지 미표기)',
          'upload_mbps 미표기 — attributes 값 1 은 placeholder, rawPayload 가 진실',
        ],
        warnings,
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
 * 단일 URL fetch → HTML (또는 null) + warning. throw 하지 않음 (B.5).
 * Accept-Language: fr-BE 우선 (Orange BE /fr/ 경로 동일 언어 응답 보장).
 */
async function fetchPage(url: string): Promise<PageFetchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STUB_FETCH_TIMEOUT_MS);

  const start = Date.now();
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-BE,fr;q=0.9',
      },
    });

    const elapsed = Date.now() - start;
    const status = response.status;

    if (!response.ok || status === 403 || status === 429) {
      return {
        html: null,
        httpStatus: status,
        elapsedMs: elapsed,
        warning: `HTTP ${status} from ${url}`,
      };
    }

    const html = await response.text();

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

export const orangeBe: Fetcher = {
  metadata: {
    providerSlug: 'orange-be',
    displayName: 'Orange BE',
    country: 'BE',
    method: 'scraping',
    /**
     * PLAN 4.26.a (2026-08-19): `internet_fixed` → `bundle_mobile_internet_tv` 로 *교체*.
     *
     * 왜 internet_fixed 를 뺐는가? (2026-08-19 raw fetch 실측)
     *   `/fr/produits-et-services/internet-chez-vous` 가 개편되며 (a) 요금제명이
     *   Start/Zen/Giga → Livebox / Livebox Up / Livebox Giga 로 바뀌고 (b) 정적
     *   HTML 에서 가격 마크업(`.obe-pricebox`)이 **전부 사라졌다** (0개). 대신
     *   `obe-dps-price` 웹 컴포넌트 마커 8개 = JS 런타임 렌더 — Orange mobile 이
     *   막힌 것과 동일 패턴 ([ADR-0013](../../docs/adr/0013-fetcher-real-scraping-risk-assessment.md) Amendment 4).
     *   실 가격은 configurer(쿼리 URL, robots Disallow) 뒤로 이동.
     *   → 자동 수집 0건인데 카테고리를 선언하면 /data-sources 가 없는 커버리지를
     *     주장하게 된다 (P3 위반). 선언에서 제거하고 사유를 남긴다.
     *   parseInternetPlans 코드는 존치 — Orange 가 정적 가격을 되돌리면 즉시 복구.
     */
    categories: ['bundle_mobile_internet_tv'] as const,
    version: FETCHER_VERSION,
    homepageUrl: HOMEPAGE_URL,
  },

  async fetch(): Promise<FetchOutcome> {
    const fetchedAt = new Date().toISOString();

    // 1.9 격리 수동 검증용
    const failure = stubFailOutcome(
      'orange-be',
      'STUB_FAIL_ORANGE_BE',
      FETCHER_VERSION,
      fetchedAt,
    );
    if (failure) return failure;

    // 두 페이지 순차 fetch (병렬 X — 공급사 IP 차단 위험 완화, Proximus 패턴 동일).
    const intPage = await fetchPage(INTERNET_SOURCE_URL);
    const bundlePage = await fetchPage(BUNDLE_SOURCE_URL);

    const bundleExtracted: TariffSnapshotInput[] =
      bundlePage.html !== null
        ? parseBundlePacks(
            cheerio.load(bundlePage.html),
            bundlePage.httpStatus,
            bundlePage.elapsedMs,
            fetchedAt,
          )
        : [];

    // Internet 페이지가 죽어도 번들이 살아 있으면 그만큼은 신선하게 보존
    // (페이지 단위 degrade — Proximus 패턴).
    if (intPage.html === null && bundleExtracted.length > 0) {
      const result: FetchResult = {
        fetcherSlug: 'orange-be',
        fetchedAt,
        data: bundleExtracted,
        retiredCategories: RETIRED_CATEGORIES,
      };
      return { ok: true, result };
    }

    if (intPage.html === null) {
      return {
        ok: false,
        error: {
          fetcherSlug: 'orange-be',
          fetchedAt,
          kind: intPage.warning?.startsWith('HTTP') || intPage.warning?.startsWith('fetch failed')
            ? 'network'
            : 'parse',
          message: intPage.warning ?? `No HTML body from ${INTERNET_SOURCE_URL}`,
          rawPayload: {
            stub: false,
            fetcher_version: FETCHER_VERSION,
            internet_url: INTERNET_SOURCE_URL,
            internet_http: { status: intPage.httpStatus, elapsed_ms: intPage.elapsedMs },
            warning: intPage.warning,
          },
        },
      };
    }

    const $ = cheerio.load(intPage.html);
    const extracted = [
      ...parseInternetPlans($, intPage.httpStatus, intPage.elapsedMs, fetchedAt),
      ...bundleExtracted,
    ];

    if (extracted.length === 0) {
      return {
        ok: false,
        error: {
          fetcherSlug: 'orange-be',
          fetchedAt,
          kind: 'parse',
          message: `No tariffs parsed from ${INTERNET_SOURCE_URL} (selector .obe-pricebox matched ${$('.obe-pricebox').length} elements) nor from ${BUNDLE_SOURCE_URL} (${bundlePage.warning ?? 'parsed 0 packs'})`,
          rawPayload: {
            stub: false,
            fetcher_version: FETCHER_VERSION,
            internet_url: INTERNET_SOURCE_URL,
            internet_http: { status: intPage.httpStatus, elapsed_ms: intPage.elapsedMs },
            pricebox_count: $('.obe-pricebox').length,
            bundle_url: BUNDLE_SOURCE_URL,
            bundle_http: { status: bundlePage.httpStatus, elapsed_ms: bundlePage.elapsedMs },
            bundle_warning: bundlePage.warning,
          },
        },
      };
    }

    const result: FetchResult = {
      fetcherSlug: 'orange-be',
      fetchedAt,
      data: extracted,
      retiredCategories: RETIRED_CATEGORIES,
    };
    return { ok: true, result };
  },
};

export default orangeBe;
