/**
 * Orange BE 실 스크래핑 fetcher (PLAN 1.5.8 + PLAN 4.26.a)
 *
 * internet_fixed 카테고리 3 plans (Start / Zen / Giga Internet) +
 * bundle_mobile_internet_tv 카테고리 3 plans (Internet+Mobile+TV 트리플
 * 플레이) 정적 추출.
 *
 * Bundle 페이지 (2026-08-19 실측, PLAN 4.26.a 게이트 A):
 *   `/fr/produits-et-services/internet-tv-mobile` (쿼리 파라미터 없음 —
 *   ADR-0013 §B.10.5 준수). `.obe-pricebox` 4개 중 1개는 페이지 상단 hero
 *   배너(가격 안내만, `.obe-card` 조상 없음) → 기존 internet_fixed 파서와
 *   동일한 "카드 wrapper 없으면 skip" dedup 로 자동 제외. 실질 3개 티어
 *   (Le moins cher / Le choix mailn[원문 오타 그대로] / Le plus complet).
 *   internet_fixed 페이지와 달리 `<del>` 요소가 없고 대신 `.obe-price-suffix`
 *   텍스트에 "X €/mois après N mois" (프로모 있음) 또는 "à vie"(영구, 프로모
 *   없음) 로 표준가/프로모 기간이 들어있다 — 별도 파서 필요.
 *   업로드 속도는 페이지에 전혀 언급되지 않음(다운로드만) — upload_mbps는
 *   warning과 함께 fallback(1)로 채워짐 (정직 표기).
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
 *   - docs/adr/0013-fetcher-real-scraping-risk-assessment.md §B.10.5 (2026-08-19)
 *   - docs/adr/0034-strategy-pivot-completion-first-seo-launch.md Amendment 1 (2026-06-04)
 *   - docs/adr/0053-telecom-provider-ecosystem-expansion.md §D6
 */

import * as cheerio from 'cheerio';
import type { Fetcher, FetchOutcome, FetchResult, TariffSnapshotInput } from './types';
import { computeConfidence, checkMonthlySanity } from './confidence';
import { STUB_FETCH_TIMEOUT_MS, stubFailOutcome } from './_shared';

// ─── 상수 ─────────────────────────────────────────────────────────────────

const FETCHER_VERSION = 'orange-be@2026-08-19';

const INTERNET_SOURCE_URL =
  'https://www.orange.be/fr/produits-et-services/internet-chez-vous';

/** PLAN 4.26.a — 쿼리 파라미터 없는 base 경로만 (ADR-0013 §B.10.5). */
const BUNDLE_SOURCE_URL =
  'https://www.orange.be/fr/produits-et-services/internet-tv-mobile';

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

// ─── Bundle 추출 (PLAN 4.26.a) ────────────────────────────────────────────

/**
 * 카드 tag 텍스트("Le moins cher" / "Le choix mailn"[원문 오타] / "Le plus
 * complet")를 그대로 tariffName 으로 쓴다 (P3 정직성 — internet_fixed
 * "Start/Zen/Giga Internet" 선례와 동일하게 페이지 실제 표시명 사용).
 * URL 쿼리 코드(net-s/net-m/net-l, `?internet=...` — 요청은 하지 않고
 * href 텍스트만 관찰)를 slug 접미사로 사용.
 */
const BUNDLE_TIERS: ReadonlyArray<{ tagRe: RegExp; slugSuffix: string }> = [
  { tagRe: /Le moins cher/i, slugSuffix: 's' },
  { tagRe: /Le choix \w+/i, slugSuffix: 'm' },
  { tagRe: /Le plus complet/i, slugSuffix: 'l' },
];

/**
 * bundle(`internet-tv-mobile`) 페이지 HTML 에서 Internet+Mobile+TV
 * 트리플 플레이 요금제를 추출한다.
 *
 * 전략 (internet_fixed `parseInternetPlans` 응용, 2026-08-19 실측):
 *   1. `.obe-pricebox` 컨테이너를 순회한다 (페이지 내 4개 — 1개는 hero 배너).
 *   2. `.closest('.obe-card')` 로 실제 상품 카드만 채택 (hero 배너는
 *      `.obe-card` 조상이 없어 자동 제외 — internet_fixed 파서와 동일 dedup).
 *   3. `.obe-price-amount` = 표시 가격. `.obe-price-suffix` 텍스트가
 *      "X €/mois après N mois" 면 프로모 있음(X=표준가, N=개월),
 *      "à vie"(영구) 등 그 외 패턴이면 프로모 없음 — internet_fixed 의
 *      `<del>` 기반 판정과 다른 마크업(본 페이지엔 `<del>` 없음).
 */
function parseBundlePlans(
  $: ReturnType<typeof cheerio.load>,
  httpStatus: number,
  elapsedMs: number,
  fetchedAt: string,
): TariffSnapshotInput[] {
  const extracted: TariffSnapshotInput[] = [];

  $('.obe-pricebox').each((_, priceboxEl) => {
    const pricebox = $(priceboxEl);
    const card = pricebox.closest('.obe-card');
    if (card.length === 0) return; // hero 배너 등 상품 카드 아님 — skip

    const cardText = card.text().replace(/\s+/g, ' ');
    const warnings: string[] = [];

    const tierMatch = BUNDLE_TIERS.find((tier) => tier.tagRe.test(cardText));
    const tierLabel = cardText.match(/Le moins cher|Le choix \w+|Le plus complet/i)?.[0] ?? null;
    if (!tierLabel) return; // 예상 티어 라벨 3종 모두 미매칭 — 신규/미지 카드, skip

    const amountText = pricebox.find('.obe-price-amount').first().text();
    const amountCents = eurToCents(amountText);
    if (amountCents === null) {
      warnings.push(`${tierLabel}: .obe-price-amount not parseable (raw: "${amountText}")`);
      return;
    }

    const suffixText = pricebox.find('.obe-price-suffix').first().text().trim();
    const afterMatch = suffixText.match(/([\d.,]+)\s*€\/mois après\s*(\d+)\s*mois/i);

    const hasPromo = afterMatch !== null;
    const monthlyCents = hasPromo && afterMatch?.[1] ? (eurToCents(afterMatch[1]) ?? amountCents) : amountCents;
    const promoPriceCents = hasPromo ? amountCents : null;
    const promoMonths = hasPromo && afterMatch?.[2] ? parseInt(afterMatch[2], 10) : null;
    const promoDescription =
      hasPromo && promoMonths !== null
        ? `처음 ${promoMonths}개월 €${(amountCents / 100).toFixed(2)} 프로모`
        : null;

    // 다운로드 속도: "jusqu'à 200 Mbps" / "jusqu'à 1 Gbps" — 업로드는 페이지에 없음
    const downMatch = cardText.match(/jusqu'à\s+([\d.,]+)\s*(Mbps|Gbps)/i);
    let downloadMbps: number | null = null;
    if (downMatch?.[1] && downMatch[2]) {
      const num = parseFloat(downMatch[1].replace(',', '.'));
      if (!isNaN(num)) {
        downloadMbps = downMatch[2].toLowerCase() === 'gbps' ? Math.round(num * 1000) : Math.round(num);
      }
    }
    if (downloadMbps === null) warnings.push(`${tierLabel}: download_mbps not extracted`);
    warnings.push(`${tierLabel}: upload_mbps not published on page (fallback)`);

    // 모바일 데이터: "Orange Mobile Small 12 GB" 등 — "Unlimited"는 브랜드명일 뿐
    // 실제 GB 숫자가 항상 병기됨 (2026-08-19 실측, 추측 아님).
    const dataMatch = cardText.match(/(\d+)\s*GB/);
    const dataGb = dataMatch?.[1] ? parseInt(dataMatch[1], 10) : null;
    if (dataGb === null) warnings.push(`${tierLabel}: data_gb not extracted`);

    // TV 채널: "20 chaînes" / "70 chaînes"
    const tvMatch = cardText.match(/(\d+)\s*chaînes/i);
    const tvChannels = tvMatch?.[1] ? parseInt(tvMatch[1], 10) : null;
    if (tvChannels === null) warnings.push(`${tierLabel}: tv_channels not extracted`);

    const sanity = checkMonthlySanity(monthlyCents);
    const confidenceResult = computeConfidence({
      selectorMatched: true,
      sanityChecks: [sanity],
      parseWarnings: warnings,
    });

    const tariffSlug = `orange-be-bundle-${tierMatch?.slugSuffix ?? tierLabel.toLowerCase().replace(/\s+/g, '-')}`;

    extracted.push({
      providerSlug: 'orange-be',
      tariffSlug,
      tariffName: tierLabel,
      category: 'bundle_mobile_internet_tv',
      monthlyPriceCents: monthlyCents,
      activationFeeCents: 0, // 페이지에 별도 설치비 언급 없음 (internet_fixed와 달리 39€ 문구 없음)
      modemRentalCents: 0, // Livebox 기본 포함 (페이지 명시)
      promoPriceCents,
      promoMonths,
      promoDescription,
      commitmentMonths: 0, // 페이지에 약정 기간 명시 없음 — internet_fixed 기본값 재사용
      earlyTerminationFeeCents: null,
      attributes: {
        category: 'bundle_mobile_internet_tv',
        download_mbps: downloadMbps ?? 1, // 추출 실패 시 최소값 (warning 추가됨)
        upload_mbps: 1, // 페이지에 업로드 속도 미공개 — fallback (warning 추가됨)
        unlimited_data: true, // 페이지 본문 "Surf illimité" 명시 (internet_fixed와 동일 근거)
        fair_use_gb: null,
        wifi_booster_included: false,
        tv_channels: tvChannels ?? 0, // 추출 실패 시 0 (warning 추가됨)
        tv_4k_included: false, // 페이지에 4K 명시 없음 (추측 금지)
        dvr_hours: null,
        data_gb: dataGb ?? 'unlimited', // 추출 실패 시 보수적 fallback (warning 추가됨)
        voice_minutes: 'unlimited' as const, // "appels et SMS illimités" 명시
        eu_roaming_included: true, // EU Roam-like-at-home (2017+, 법적 의무)
        included_services: { mobile: true, internet: true, tv: true },
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
          tier_label: tierLabel,
          monthly_cents: monthlyCents,
          promo_cents: promoPriceCents,
          download_mbps: downloadMbps,
        },
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
     * PLAN 4.26.a — internet_fixed + bundle_mobile_internet_tv 커버.
     * mobile 단독은 여전히 JS 렌더 (`<obe-dps-price>`, 파일 상단 주석) — 미커버.
     */
    categories: ['internet_fixed', 'bundle_mobile_internet_tv'] as const,
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

    // ─── 두 페이지 순차 fetch (PLAN 4.26.a — 페이지 단위 degrade) ──────────
    const intPage = await fetchPage(INTERNET_SOURCE_URL);
    const bundlePage = await fetchPage(BUNDLE_SOURCE_URL);

    const allWarnings: string[] = [];
    const allExtracted: TariffSnapshotInput[] = [];

    if (intPage.html !== null) {
      const $ = cheerio.load(intPage.html);
      const intPlans = parseInternetPlans($, intPage.httpStatus, intPage.elapsedMs, fetchedAt);
      allExtracted.push(...intPlans);
      if (intPlans.length === 0) {
        allWarnings.push(
          `internet page: no tariffs parsed (selector .obe-pricebox matched ${$('.obe-pricebox').length} elements)`,
        );
      }
    } else if (intPage.warning) {
      allWarnings.push(`internet page: ${intPage.warning}`);
    }

    if (bundlePage.html !== null) {
      const $ = cheerio.load(bundlePage.html);
      const bundlePlans = parseBundlePlans($, bundlePage.httpStatus, bundlePage.elapsedMs, fetchedAt);
      allExtracted.push(...bundlePlans);
      if (bundlePlans.length === 0) {
        allWarnings.push(
          `bundle page: no tariffs parsed (selector .obe-pricebox matched ${$('.obe-pricebox').length} elements)`,
        );
      }
    } else if (bundlePage.warning) {
      allWarnings.push(`bundle page: ${bundlePage.warning}`);
    }

    if (allExtracted.length === 0) {
      return {
        ok: false,
        error: {
          fetcherSlug: 'orange-be',
          fetchedAt,
          kind: intPage.warning && bundlePage.warning ? 'network' : 'parse',
          message: `No tariffs parsed from any page. internet: ${intPage.warning ?? `${intPage.httpStatus} ok`}, bundle: ${bundlePage.warning ?? `${bundlePage.httpStatus} ok`}`,
          rawPayload: {
            stub: false,
            fetcher_version: FETCHER_VERSION,
            internet_url: INTERNET_SOURCE_URL,
            bundle_url: BUNDLE_SOURCE_URL,
            internet_http: { status: intPage.httpStatus, elapsed_ms: intPage.elapsedMs },
            bundle_http: { status: bundlePage.httpStatus, elapsed_ms: bundlePage.elapsedMs },
            warnings: allWarnings,
          },
        },
      };
    }

    const result: FetchResult = {
      fetcherSlug: 'orange-be',
      fetchedAt,
      data: allExtracted,
    };
    return { ok: true, result };
  },
};

export default orangeBe;
