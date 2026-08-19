/**
 * Telenet 실 스크래핑 fetcher (PLAN 1.5.6 → 4.26.a 확장)
 *
 * 커버 카테고리 5종 (2026-08-19, PLAN 4.26.a):
 *   mobile                    — `producten/mobiel.html`
 *   internet_fixed            — `producten/internet.html`
 *   bundle_mobile_internet    — `producten/internet-mobiel.html`
 *   bundle_internet_tv        — `producten/internet-tv.html`
 *   bundle_mobile_internet_tv — `producten/internet-mobiel-tv.html`
 *
 * 왜 스크래핑인가?
 *   Telenet은 공식 가격 API를 제공하지 않는다. HTML 페이지에서 가격을 추출한다.
 *   ADR-0013 Amendment 3 (2026-05-28)에서 mobile 페이지 스크래핑으로 확정.
 *
 * HTML 구조 (AEM 공통 — 2026-05-28 mobile / 2026-08-19 internet·번들 정찰):
 *   - div.cmp-product-summary 카드
 *   - 카드명은 <h3 class="heading--4">, 변형(속도)은 그 아래 heading--3
 *   - 가격은 tg-lazy-loading-standalone[component-id="tg-marketing-cafe-pricing"]
 *     의 inputs 속성 JSON — customProduct = { price, promoPrice, duration,
 *     startDate, endDate }. 번들 페이지는 promoPrice/duration 이 채워져 있어
 *     프로모 금액·기간을 *추측 없이* 그대로 옮길 수 있다.
 *   - 같은 카드가 렌더링 변형(startingFrom 등)으로 2벌 나오므로 중복 제거 필수.
 *
 * 왜 페이지마다 "구성 증거"를 요구하는가? (parseProductCards 의 requires)
 *   페이지 URL 만 믿고 카테고리를 붙이면, 페이지 개편으로 다른 상품이 섞여 들어올 때
 *   조용히 오분류된다. 카드 본문이 인터넷 속도/모바일 데이터/TV 를 *스스로 밝힐 때만*
 *   해당 카테고리로 편입한다 (P1 — 공급사 선언을 그대로 옮김, 추측 0).
 *
 * B.5 컴플라이언스:
 *   HTTP !ok / 403 / 429 / 챌린지 페이지 → throw 없이 ok:false 반환.
 *   페이지 단위 degrade — 한 페이지가 죽어도 나머지 페이지 결과는 보존.
 *   robots.txt (2026-08-19 실측): `Allow: /` + jcr:content/etc 만 Disallow —
 *   본 fetcher 대상 5개 경로 모두 허용. 쿼리 파라미터 URL 미접근.
 *
 * STUB_FAIL_TELENET=1:
 *   1.9 격리 수동 검증용 — 실 fetcher에도 유지 (테스트 격리 시나리오 보호).
 *
 * 결정 근거:
 *   - docs/adr/0013-fetcher-real-scraping-risk-assessment.md Amendment 3
 *   - docs/adr/0053-telecom-provider-ecosystem-expansion.md §D6 (정찰 실측)
 */

import * as cheerio from 'cheerio';
import type { Fetcher, FetchOutcome, FetchResult, TariffSnapshotInput } from './types';
import type { TariffCategory } from '@/db/schema/tariff';
import { computeConfidence, checkMonthlySanity } from './confidence';
import { STUB_FETCH_TIMEOUT_MS, stubFailOutcome } from './_shared';

// ─── 상수 ─────────────────────────────────────────────────────────────────

const FETCHER_VERSION = 'telenet-be@2026-08-19';

const BASE = 'https://www2.telenet.be/residential/nl/producten';

const MOBILE_SOURCE_URL = `${BASE}/mobiel.html`;
const INTERNET_SOURCE_URL = `${BASE}/internet.html`;
const BUNDLE_MOBILE_INTERNET_URL = `${BASE}/internet-mobiel.html`;
const BUNDLE_INTERNET_TV_URL = `${BASE}/internet-tv.html`;
const BUNDLE_MOBILE_INTERNET_TV_URL = `${BASE}/internet-mobiel-tv.html`;

/**
 * 번들 페이지 4개를 추가로 순차 fetch 하므로 총 소요를 스스로 제한한다.
 * ADR-0008 §Fetcher "30s 안에 완료 권장" — 예산 초과 시 남은 페이지를 건너뛰고
 * warning 을 남긴다 (조용한 지연 대신 정직한 부분 수집).
 */
const TOTAL_FETCH_BUDGET_MS = 24_000;

/** 번들/인터넷 페이지 개별 timeout — 5페이지 순차라 mobile(25s)보다 짧게. */
const PAGE_FETCH_TIMEOUT_MS = 8_000;

/**
 * P3 투명성: 정직한 User-Agent.
 * 봇 차단을 우회하려는 헤더가 아니라, 크롤러 목적을 명시.
 */
const USER_AGENT =
  'Slim/1.0 (+https://slim.lu; price comparison; contact kim.wonmin91@gmail.com)';

// ─── 파싱 유틸 ────────────────────────────────────────────────────────────

/** customProduct JSON 의 가격 문자열 → cents. 빈 문자열/0 → null. */
function priceStringToCents(raw: unknown): number | null {
  const priceStr = String(raw ?? '').trim();
  if (!priceStr || priceStr === '0') return null;
  // 유럽 소수점: 콤마를 점으로 변환 (예: "21,00" → "21.00")
  const euros = parseFloat(priceStr.replace(',', '.'));
  if (isNaN(euros) || euros <= 0) return null;
  // 유로 → cents 변환 (반올림으로 부동소수 오차 제거)
  return Math.round(euros * 100);
}

/** tg-lazy-loading-standalone 의 inputs 속성에서 customProduct 를 꺼낸다. */
function readCustomProduct(inputsAttr: string): {
  priceCents: number | null;
  promoCents: number | null;
  durationMonths: number | null;
  endDate: string | null;
} | null {
  try {
    // @builder-justification: JSON.parse 결과는 unknown이며 즉시 타입 가드로 검증
    const parsed = JSON.parse(inputsAttr) as unknown;
    if (typeof parsed !== 'object' || parsed === null || !('customProduct' in parsed)) {
      return null;
    }
    const cp = (parsed as Record<string, unknown>)['customProduct'];
    if (typeof cp !== 'object' || cp === null) return null;
    const rec = cp as Record<string, unknown>;
    const durationRaw = String(rec['duration'] ?? '').trim();
    const duration = durationRaw ? parseInt(durationRaw, 10) : NaN;
    const endDate = String(rec['endDate'] ?? '').trim();
    return {
      priceCents: priceStringToCents(rec['price']),
      promoCents: priceStringToCents(rec['promoPrice']),
      durationMonths: isNaN(duration) ? null : duration,
      endDate: endDate.length > 0 ? endDate : null,
    };
  } catch {
    return null;
  }
}

/**
 * 카드 텍스트에서 data_gb 추출.
 *   "15 GB data" → 15
 *   "Unlimited data" → 'unlimited'
 */
function extractDataGb(cardText: string): number | 'unlimited' | null {
  // "15 GB of Unlimited mobiele data" 처럼 둘 다 등장하면 *보수적으로* 낮은 쪽(숫자).
  // (?![a-z]) 필수 — "2,5 Gbps" 의 "5 Gb" 를 데이터 용량으로 오인한 버그 방지 (4.26.a).
  const gbMatch = cardText.match(/(\d+)\s*GB(?![a-z])/i);
  if (gbMatch?.[1]) return parseInt(gbMatch[1], 10);
  if (/unlimited|onbeperkt/i.test(cardText)) return 'unlimited';
  return null;
}

/** "200 Mbps" / "2,5 Gbps" → Mbps 정수. */
function speedToMbps(raw: string): number | null {
  const gbps = raw.match(/(\d+(?:[.,]\d+)?)\s*Gbps/i);
  if (gbps?.[1]) return Math.round(parseFloat(gbps[1].replace(',', '.')) * 1000);
  const mbps = raw.match(/(\d+)\s*Mbps/i);
  if (mbps?.[1]) return parseInt(mbps[1], 10);
  return null;
}

/**
 * plan명(heading--4)에서 tariff slug 생성.
 * 예: "Basic" → "mobile-basic", "Unlimited" → "mobile-unlimited"
 */
function makeTariffSlug(planName: string): string {
  return `mobile-${planName.toLowerCase().trim().replace(/\s+/g, '-')}`;
}

/** 자유 문자열 → kebab slug 조각. */
function kebab(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── 챌린지 페이지 감지 ──────────────────────────────────────────────────

/** Cloudflare / Akamai 챌린지 페이지 감지 (B.5 컴플라이언스). */
function isChallengeBody(body: string): boolean {
  return (
    body.includes('Just a moment') ||
    body.includes('sensor') ||
    body.includes('cf-browser-verification') ||
    body.includes('_cf_chl_opt')
  );
}

// ─── HTTP fetch 헬퍼 ──────────────────────────────────────────────────────

interface PageFetchResult {
  html: string | null;
  httpStatus: number;
  elapsedMs: number;
  warning: string | null;
}

/**
 * 단일 URL fetch → HTML(또는 null) + warning. throw 하지 않음 (B.5) —
 * 페이지 단위 degrade 를 위해 오류를 값으로 반환한다 (Proximus 패턴 동일).
 */
async function fetchPage(url: string, timeoutMs: number): Promise<PageFetchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const start = Date.now();
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow', // www.telenet.be → www2.telenet.be 302 처리
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'nl-BE,nl;q=0.9',
      },
    });

    const elapsed = Date.now() - start;
    const status = response.status;

    // B.5: HTTP 에러 코드 처리
    if (!response.ok || status === 403 || status === 429) {
      return {
        html: null,
        httpStatus: status,
        elapsedMs: elapsed,
        warning: `HTTP ${status} from ${url}`,
      };
    }

    const html = await response.text();

    // B.5: 챌린지 페이지 감지
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
    const message = err instanceof Error ? err.message : 'unknown network error';
    return {
      html: null,
      httpStatus: 0,
      elapsedMs: elapsed,
      warning: `fetch failed: ${message} (${url})`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Mobile 추출 (1.5.6 원본 로직 유지) ──────────────────────────────────

function parseMobilePlans(
  $: ReturnType<typeof cheerio.load>,
  httpStatus: number,
  elapsedMs: number,
  fetchedAt: string,
  warnings: string[],
): TariffSnapshotInput[] {
  const cards = $('div.cmp-product-summary');
  const extracted: TariffSnapshotInput[] = [];
  const seen = new Map<string, number>(); // tariffSlug → priceCents (중복 변형 검사)

  cards.each((_idx, el) => {
    const card = $(el);

    // plan명: heading--4 클래스의 h3 텍스트
    const planName = card.find('.heading--4').first().text().trim();
    if (!planName) {
      warnings.push(`card ${_idx}: plan name not found, skipping`);
      return; // cheerio each에서 skip
    }

    /**
     * "In combinatie met internet nu vanaf € 56 per maand" 카드는 *인터넷과 함께
     * 살 때* 의 조건부 가격이다 (2026-08-19 실측: Basic €10 / Unlimited €21).
     * 단독 모바일 요금제(€21 / €41)와 같은 이름으로 나오므로 걸러내지 않으면
     * 같은 요금제가 절반 가격으로 노출된다 — 번들 가격은 번들 카테고리 소관.
     */
    const cardBody = card.text().replace(/\s+/g, ' ');
    if (/in combinatie met internet/i.test(cardBody)) return;

    // 가격: tg-lazy-loading-standalone inputs 속성 → customProduct.price
    const inputsAttr = card
      .find('tg-lazy-loading-standalone[component-id="tg-marketing-cafe-pricing"]')
      .attr('inputs');

    if (!inputsAttr) {
      warnings.push(`card ${_idx} (${planName}): inputs attr not found, skipping`);
      return;
    }

    const custom = readCustomProduct(inputsAttr);
    const priceCents = custom?.priceCents ?? null;
    if (priceCents === null) {
      // price=0인 카드는 "인터넷 조합 시" 전용 카드 → 정상적으로 skip
      // (parseWarning 추가 안 함 — 예상된 동작)
      return;
    }

    // data_gb: heading--3 텍스트에서 추출 (예: "15 GB data", "Unlimited data")
    const dataHeading = card
      .find('[data-tg-cmp-is="title"].heading--3, .heading--3')
      .first()
      .text()
      .trim();
    const dataGb = extractDataGb(dataHeading || card.text());

    if (dataGb === null) {
      warnings.push(`card ${_idx} (${planName}): data_gb not extracted`);
    }

    // Sanity check
    const sanity = checkMonthlySanity(priceCents);
    const confidenceResult = computeConfidence({
      selectorMatched: true,
      sanityChecks: [sanity],
      parseWarnings: warnings.filter((w) => w.includes(planName)),
    });

    const tariffName = `Mobile ${planName}`;
    const tariffSlug = `telenet-${makeTariffSlug(planName)}`;

    // 같은 카드가 반응형 변형으로 4벌까지 반복된다 (2026-08-19 실측) — 첫 카드만 채택.
    const previous = seen.get(tariffSlug);
    if (previous !== undefined) {
      if (previous !== priceCents) {
        warnings.push(
          `duplicate mobile card "${tariffSlug}" with different price (${previous} vs ${priceCents}) — 첫 카드 채택`,
        );
      }
      return;
    }
    seen.set(tariffSlug, priceCents);

    extracted.push({
      providerSlug: 'telenet-be',
      tariffSlug,
      tariffName,
      category: 'mobile',
      monthlyPriceCents: priceCents,
      activationFeeCents: 0,
      modemRentalCents: null, // 모바일 — 모뎀 임대 개념 없음
      promoPriceCents: null,
      promoMonths: null,
      promoDescription: null,
      commitmentMonths: 0, // Telenet mobile은 약정 없음 (공식 페이지 명시 없음)
      earlyTerminationFeeCents: null,
      attributes: {
        category: 'mobile',
        data_gb: dataGb ?? 'unlimited', // 추출 실패 시 보수적으로 'unlimited' (warning 추가됨)
        voice_minutes: 'unlimited' as const, // 모든 Telenet mobile 요금제: 무제한 음성
        sms: 'unlimited' as const, // 모든 Telenet mobile 요금제: 무제한 SMS
        eu_roaming_included: true, // EU Roam-like-at-home (2017+, 법적 의무)
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
          price_cents: priceCents,
          data_gb: dataGb,
        },
        warnings,
        ...sanity,
      },
    });
  });

  return extracted;
}

// ─── 인터넷 / 번들 추출 — PLAN 4.26.a ────────────────────────────────────

/** 한 페이지가 어떤 카테고리를, 어떤 "구성 증거" 아래 산출하는지 선언. */
interface PageSpec {
  readonly url: string;
  readonly category: TariffCategory;
  /** slug 중간 조각 (예: 'internet-mobiel-tv'). */
  readonly slugPart: string;
  /** 카드가 이 구성을 스스로 밝혀야 편입 — 하나라도 빠지면 skip. */
  readonly requires: {
    readonly internet: boolean;
    readonly mobileData: boolean;
    readonly tv: boolean;
  };
  /** true면 heading 에 '+' 가 있는 카드(=번들 카드)를 건너뛴다 (단품 페이지용). */
  readonly skipCombinedHeadings: boolean;
}

const PAGE_SPECS: readonly PageSpec[] = [
  {
    url: INTERNET_SOURCE_URL,
    category: 'internet_fixed',
    slugPart: 'internet',
    requires: { internet: true, mobileData: false, tv: false },
    skipCombinedHeadings: true,
  },
  {
    url: BUNDLE_MOBILE_INTERNET_URL,
    category: 'bundle_mobile_internet',
    slugPart: 'internet-mobiel',
    requires: { internet: true, mobileData: true, tv: false },
    skipCombinedHeadings: false,
  },
  {
    url: BUNDLE_INTERNET_TV_URL,
    category: 'bundle_internet_tv',
    slugPart: 'internet-tv',
    requires: { internet: true, mobileData: false, tv: true },
    skipCombinedHeadings: false,
  },
  {
    url: BUNDLE_MOBILE_INTERNET_TV_URL,
    category: 'bundle_mobile_internet_tv',
    slugPart: 'internet-mobiel-tv',
    requires: { internet: true, mobileData: true, tv: true },
    skipCombinedHeadings: false,
  },
];

/** 카테고리별 attributes 조립 — 없는 값은 null 로 남긴다 (0/false 로 채우지 않음). */
function buildAttributes(
  spec: PageSpec,
  facts: {
    downloadMbps: number | null;
    uploadMbps: number | null;
    dataGb: number | 'unlimited' | null;
    unlimitedData: boolean;
  },
): Record<string, unknown> {
  const internetBase = {
    download_mbps: facts.downloadMbps ?? 1, // 추출 실패 시 최소값 (warning 동반)
    upload_mbps: facts.uploadMbps ?? 1,
    unlimited_data: facts.unlimitedData,
    fair_use_gb: null,
    wifi_booster_included: false, // 기본 미포함 (옵션 €2/월)
  };
  const tvBase = {
    // 채널 수는 Telenet 상품 페이지가 숫자로 밝히지 않는다 ("TV-box met TV-zenders").
    tv_channels: null, // ADR-0042 Amendment 2
    tv_4k_included: null,
  };
  const mobileBase = {
    data_gb: facts.dataGb ?? undefined,
    voice_minutes: 'unlimited' as const, // Telenet mobiel: 통화/SMS 무제한 (mobile 페이지 공표)
    eu_roaming_included: true,
  };

  switch (spec.category) {
    case 'bundle_mobile_internet':
      return {
        category: spec.category,
        ...internetBase,
        ...mobileBase,
        included_services: { internet: true, mobile: true, tv: false },
      };
    case 'bundle_internet_tv':
      return {
        category: spec.category,
        ...internetBase,
        ...tvBase,
        mobile_lines_included: 0, // ADR-0042 §D1: TV-only 듀얼
        included_services: { internet: true, mobile: false, tv: true },
      };
    case 'bundle_mobile_internet_tv':
      return {
        category: spec.category,
        ...internetBase,
        ...tvBase,
        ...mobileBase,
        included_services: { internet: true, mobile: true, tv: true },
      };
    default:
      return { category: 'internet_fixed', ...internetBase };
  }
}

/**
 * AEM 상품 카드(`div.cmp-product-summary`)에서 인터넷/번들 요금제를 추출한다.
 *
 * 중복 제거: 같은 카드가 렌더링 변형으로 2벌 나온다 (startingFrom=true/false,
 * 프로모 기간만 다른 재노출 등). `heading|속도` 키로 *처음 것* 만 채택하고,
 * 뒤에 온 변형의 가격이 다르면 warning 을 남긴다 — 조용히 덮어쓰지 않는다.
 */
function parseProductCards(
  $: ReturnType<typeof cheerio.load>,
  spec: PageSpec,
  httpStatus: number,
  elapsedMs: number,
  fetchedAt: string,
  warnings: string[],
): TariffSnapshotInput[] {
  const pageText = $.root().text().replace(/\s+/g, ' ');
  const pageSaysUnlimited = /onbeperkt internet|unlimited internet/i.test(pageText);

  const extracted: TariffSnapshotInput[] = [];
  const seen = new Map<string, number>(); // key → monthlyCents (중복 검사용)

  $('div.cmp-product-summary').each((idx, el) => {
    const card = $(el);
    const heading = card.find('.heading--4').first().text().replace(/\s+/g, ' ').trim();
    if (!heading) return;
    if (spec.skipCombinedHeadings && heading.includes('+')) return;

    const cardText = card.text().replace(/\s+/g, ' ').trim();

    // ─── 구성 증거 확인 (페이지 URL 을 믿지 않는다) ───────────────────────
    const downloadRaw = cardText.match(/([\d.,]+\s*[GM]bps)\s*max\.?\s*downloadsnelheid/i);
    const uploadRaw = cardText.match(/([\d.,]+\s*[GM]bps)\s*max\.?\s*uploadsnelheid/i);
    const hasInternet = downloadRaw !== null;
    const hasMobileData = /mobiele data/i.test(cardText);
    const hasTv = /TV-box|TV-zenders|tv-zenders/i.test(cardText);

    if (spec.requires.internet && !hasInternet) return;
    if (spec.requires.mobileData && !hasMobileData) return;
    if (spec.requires.tv && !hasTv) return;

    // ─── 가격 ─────────────────────────────────────────────────────────────
    const inputsAttr = card
      .find('tg-lazy-loading-standalone[component-id="tg-marketing-cafe-pricing"]')
      .attr('inputs');
    if (!inputsAttr) {
      warnings.push(`${spec.slugPart} card ${idx} (${heading}): inputs attr not found`);
      return;
    }
    const custom = readCustomProduct(inputsAttr);
    if (custom === null || custom.priceCents === null) {
      warnings.push(`${spec.slugPart} card ${idx} (${heading}): price not parseable`);
      return;
    }

    const downloadMbps = downloadRaw?.[1] ? speedToMbps(downloadRaw[1]) : null;
    const uploadMbps = uploadRaw?.[1] ? speedToMbps(uploadRaw[1]) : null;

    // ─── 중복 변형 제거 ───────────────────────────────────────────────────
    const key = `${heading}|${downloadMbps ?? '?'}`;
    const previous = seen.get(key);
    if (previous !== undefined) {
      if (previous !== custom.priceCents) {
        warnings.push(
          `${spec.slugPart}: duplicate card "${key}" with different price (${previous} vs ${custom.priceCents}) — 첫 카드 채택`,
        );
      }
      return;
    }
    seen.set(key, custom.priceCents);

    const cardWarnings: string[] = [];
    if (downloadMbps === null) cardWarnings.push(`${heading}: download_mbps not extracted`);
    if (uploadMbps === null) cardWarnings.push(`${heading}: upload_mbps not extracted`);

    const dataGb = spec.requires.mobileData ? extractDataGb(cardText) : null;
    if (spec.requires.mobileData && dataGb === null) {
      cardWarnings.push(`${heading}: data_gb not extracted`);
    }

    // 프로모: customProduct 가 promoPrice + duration 을 직접 준다 (추정 0).
    const hasPromo =
      custom.promoCents !== null &&
      custom.durationMonths !== null &&
      custom.promoCents < custom.priceCents;
    const promoPriceCents = hasPromo ? custom.promoCents : null;
    const promoMonths = hasPromo ? custom.durationMonths : null;

    const sanity = checkMonthlySanity(custom.priceCents);
    const confidenceResult = computeConfidence({
      selectorMatched: true,
      sanityChecks: [sanity],
      parseWarnings: cardWarnings,
    });
    warnings.push(...cardWarnings);

    // 단품 인터넷은 heading 이 곧 요금제명(Basic/Standard/Turbo) —
    // 번들은 heading 이 구성 설명이라 속도로 구분한다.
    const speedLabel = downloadMbps !== null ? `${downloadMbps}mbps` : `card-${idx}`;
    const tariffSlug = spec.skipCombinedHeadings
      ? `telenet-${spec.slugPart}-${kebab(heading)}`
      : `telenet-${spec.slugPart}-${speedLabel}`;
    const variant = card.find('.heading--3').first().text().replace(/\s+/g, ' ').trim();
    const tariffName = variant && variant !== heading ? `${heading} ${variant}` : heading;

    extracted.push({
      providerSlug: 'telenet-be',
      tariffSlug,
      tariffName,
      category: spec.category,
      monthlyPriceCents: custom.priceCents,
      activationFeeCents: 0, // Telenet 상품 페이지 설치비 미표기 — 0 표기 근거는 rawPayload 참조
      modemRentalCents: 0, // 모뎀 기본 포함
      promoPriceCents,
      promoMonths,
      promoDescription:
        promoPriceCents !== null && promoMonths !== null
          ? `처음 ${promoMonths}개월 €${(promoPriceCents / 100).toFixed(0)} 프로모`
          : null,
      commitmentMonths: 0,
      earlyTerminationFeeCents: null,
      attributes: buildAttributes(spec, {
        downloadMbps,
        uploadMbps,
        dataGb,
        unlimitedData: pageSaysUnlimited,
      }),
      sourceUrl: spec.url,
      confidence: confidenceResult.confidence,
      confidenceReason: confidenceResult.reason,
      rawPayload: {
        stub: false,
        fetcher_version: FETCHER_VERSION,
        url: spec.url,
        fetched_at: fetchedAt,
        http: { status: httpStatus, elapsed_ms: elapsedMs },
        extracted: {
          heading,
          variant,
          price_cents: custom.priceCents,
          promo_cents: custom.promoCents,
          promo_duration_months: custom.durationMonths,
          promo_end_date: custom.endDate,
          download_mbps: downloadMbps,
          upload_mbps: uploadMbps,
          data_gb: dataGb,
          has_tv_evidence: hasTv,
        },
        assumptions: [
          'activation_fee 0 — Telenet 상품 페이지가 설치비를 표기하지 않음 (별도 확인 필요)',
          'unlimited_data — 페이지 본문 "onbeperkt internet" 문구 기준',
        ],
        warnings: cardWarnings,
        ...sanity,
      },
    });
  });

  return extracted;
}

// ─── Fetcher 구현 ─────────────────────────────────────────────────────────

export const telenet: Fetcher = {
  metadata: {
    providerSlug: 'telenet-be',
    displayName: 'Telenet',
    country: 'BE',
    /**
     * method='scraping': 1.5.6에서 스텁 → 실 스크래핑으로 전환됨.
     * ADR-0013 Amendment 3 기준.
     */
    method: 'scraping',
    /**
     * PLAN 4.26.a (2026-08-19): mobile 단독 → 5 카테고리.
     * 1.5.6 당시 manual 폴백으로 남겼던 internet/bundle 을 정적 파싱으로 승격.
     * admin-metrics 의 CASE WHEN 매핑 자동 생성 용 (PLAN 1.5.6).
     */
    categories: [
      'mobile',
      'internet_fixed',
      'bundle_mobile_internet',
      'bundle_internet_tv',
      'bundle_mobile_internet_tv',
    ] as const,
    version: FETCHER_VERSION,
    homepageUrl: 'https://www.telenet.be',
  },

  async fetch(): Promise<FetchOutcome> {
    const fetchedAt = new Date().toISOString();
    const startedAt = Date.now();

    // ─── STUB_FAIL 환경변수 (1.9 격리 수동 검증용) ─────────────────────────
    // 실 scraping fetcher에도 유지 — 격리 테스트 시나리오 보호 목적.
    const failure = stubFailOutcome(
      'telenet-be',
      'STUB_FAIL_TELENET',
      FETCHER_VERSION,
      fetchedAt,
    );
    if (failure) return failure;

    const allWarnings: string[] = [];
    const allExtracted: TariffSnapshotInput[] = [];

    // ─── mobile 페이지 (1.5.6 기존 경로) ───────────────────────────────────
    const mobPage = await fetchPage(MOBILE_SOURCE_URL, STUB_FETCH_TIMEOUT_MS);
    if (mobPage.html !== null) {
      const mobWarnings: string[] = [];
      allExtracted.push(
        ...parseMobilePlans(
          cheerio.load(mobPage.html),
          mobPage.httpStatus,
          mobPage.elapsedMs,
          fetchedAt,
          mobWarnings,
        ),
      );
      allWarnings.push(...mobWarnings);
    } else if (mobPage.warning) {
      allWarnings.push(`mobile page: ${mobPage.warning}`);
    }

    // ─── internet + 번들 3종 (PLAN 4.26.a) ────────────────────────────────
    // 순차 실행 (병렬 X — 공급사 IP 차단 위험 완화). 예산 초과 시 정직하게 중단.
    const pageStatuses: Array<Record<string, unknown>> = [];
    for (const spec of PAGE_SPECS) {
      if (Date.now() - startedAt > TOTAL_FETCH_BUDGET_MS) {
        allWarnings.push(`budget exceeded — skipped ${spec.url}`);
        pageStatuses.push({ url: spec.url, skipped: 'budget' });
        continue;
      }
      const page = await fetchPage(spec.url, PAGE_FETCH_TIMEOUT_MS);
      pageStatuses.push({
        url: spec.url,
        status: page.httpStatus,
        elapsed_ms: page.elapsedMs,
        warning: page.warning,
      });
      if (page.html === null) {
        if (page.warning) allWarnings.push(`${spec.slugPart} page: ${page.warning}`);
        continue;
      }
      const pageWarnings: string[] = [];
      allExtracted.push(
        ...parseProductCards(
          cheerio.load(page.html),
          spec,
          page.httpStatus,
          page.elapsedMs,
          fetchedAt,
          pageWarnings,
        ),
      );
      allWarnings.push(...pageWarnings);
    }

    // ─── 결과 검증 ──────────────────────────────────────────────────────────
    // 모든 페이지가 0개일 때만 실패. 한 페이지만 살아도 ok:true (페이지 단위 degrade).
    if (allExtracted.length === 0) {
      const allNetworkDown =
        mobPage.warning !== null &&
        pageStatuses.every((s) => typeof s['warning'] === 'string' || s['skipped'] !== undefined);
      return {
        ok: false,
        error: {
          fetcherSlug: 'telenet-be',
          fetchedAt,
          kind: allNetworkDown ? 'network' : 'parse',
          message: `No tariffs parsed from any Telenet page. mobile: ${mobPage.warning ?? `${mobPage.httpStatus} ok`}. Selector or HTML structure may have changed.`,
          rawPayload: {
            stub: false,
            fetcher_version: FETCHER_VERSION,
            url: MOBILE_SOURCE_URL,
            http: { status: mobPage.httpStatus, elapsed_ms: mobPage.elapsedMs },
            pages: pageStatuses,
            warnings: allWarnings,
          },
        },
      };
    }

    // FetchResult 타입 명시 — harness:data Rule 1 + ADR-0008 T4 discriminated union
    const result: FetchResult = {
      fetcherSlug: 'telenet-be',
      fetchedAt,
      data: allExtracted,
    };
    return { ok: true, result };
  },
};

export default telenet;
