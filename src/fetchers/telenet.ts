/**
 * Telenet mobile + bundle 실 스크래핑 fetcher (PLAN 1.5.6 + PLAN 4.26.a)
 *
 * internet_fixed 단독 = 여전히 manual 폴백 대상 (4.26.a 게이트 A에서 별도
 * 라운드로 이연 — 아래 "internet.html 이연" 참고). mobile + bundle 카테고리
 * 요금제를 반환한다.
 *
 * 왜 스크래핑인가?
 *   Telenet은 공식 가격 API를 제공하지 않는다. HTML 페이지에서 가격을 추출한다.
 *   ADR-0013 Amendment 3 (2026-05-28)에서 mobile 페이지 스크래핑으로 확정.
 *
 * HTML 구조 (2026-05-28 샘플 기준):
 *   - div.cmp-product-summary 카드 4개:
 *     카드 1~2: "인터넷 조합 시 €56" 등 복합 가격 카드 (customProduct price=0)
 *     카드 3~4: 단독 모바일 요금제 (customProduct price=21/41)
 *   - 각 카드의 plan명은 <h3 class="heading--4">안에 있다.
 *   - 가격은 tg-lazy-loading-standalone 요소의 inputs 속성 내
 *     &quot;customProduct&quot;:{...&quot;price&quot;:&quot;21&quot;...} HTML 엔티티 인코딩된 JSON으로 존재.
 *   - data_gb는 "15 GB data" / "Unlimited data" 텍스트에서 추출.
 *
 * Bundle 페이지 (2026-08-19 실측, PLAN 4.26.a 게이트 A):
 *   - `/residential/nl/producten/internet-mobiel-tv.html` 도 동일 div.cmp-
 *     product-summary + tg-marketing-cafe-pricing inputs 패턴 재사용 (신규
 *     셀렉터 0). `customProduct` JSON에 `duration` / `promoPrice` / `price`
 *     필드가 명시적으로 존재 — mobile 페이지보다 오히려 구조화도가 높다.
 *   - 카드 6개가 렌더되지만 실질 3개 요금제(200/500/2.5Gbps 다운로드) —
 *     나머지 3개는 "15GB 고정" vs "15GB or Unlimited" 마케팅 카피 차이만
 *     있고 가격 JSON이 완전히 동일 → dedupe.
 *   - TV 채널 수("Meer dan 90 tv-zenders")는 카드별이 아니라 페이지 전역
 *     "항상 포함" 섹션에 1회만 명시 — 3개 요금제 전체에 균일 적용.
 *   - `producten/internet.html` (internet_fixed 단독, manual 폴백 대상)도
 *     같은 도메인/컴포넌트를 쓰지만 가격 JSON 이 카드별 duration/promo 조합이
 *     들쭉날쭉해(5카드 중 일부 프로모 없음/duration 공백) 신뢰도 있는 매핑을
 *     이번 라운드 시간 내 확정하지 못함 — **본 라운드 스코프 제외, 후속 라운드
 *     로 이연** (builder 재량, ADR-0053 §D6 "builder 판단" 위임 범위 내).
 *
 * B.5 컴플라이언스:
 *   HTTP !ok / 403 / 429 / 챌린지 페이지 → throw 없이 ok:false 반환.
 *
 * STUB_FAIL_TELENET=1:
 *   1.9 격리 수동 검증용 — 실 fetcher에도 유지 (테스트 격리 시나리오 보호).
 *
 * 결정 근거:
 *   - docs/adr/0013-fetcher-real-scraping-risk-assessment.md Amendment 3
 *   - docs/adr/0053-telecom-provider-ecosystem-expansion.md §D6
 */

import * as cheerio from 'cheerio';
import type { Fetcher, FetchOutcome, FetchResult, TariffSnapshotInput } from './types';
import { computeConfidence, checkMonthlySanity } from './confidence';
import { STUB_FETCH_TIMEOUT_MS, stubFailOutcome } from './_shared';

// ─── 상수 ─────────────────────────────────────────────────────────────────

const FETCHER_VERSION = 'telenet-be@2026-08-19';

const MOBILE_SOURCE_URL =
  'https://www2.telenet.be/residential/nl/producten/mobiel.html';

/** PLAN 4.26.a — Internet+Mobiel+TV 트리플 플레이 번들 페이지. */
const BUNDLE_SOURCE_URL =
  'https://www2.telenet.be/residential/nl/producten/internet-mobiel-tv.html';

/**
 * P3 투명성: 정직한 User-Agent.
 * 봇 차단을 우회하려는 헤더가 아니라, 크롤러 목적을 명시.
 */
const USER_AGENT =
  'Slim/1.0 (+https://slim.lu; price comparison; contact kim.wonmin91@gmail.com)';

// ─── 파싱 유틸 ────────────────────────────────────────────────────────────

/**
 * tg-lazy-loading-standalone의 inputs 속성에서 customProduct.price를 추출.
 *
 * 왜 HTML 엔티티 디코딩이 필요한가?
 *   AEM이 &quot; 인코딩으로 JSON을 속성에 포함시킨다.
 *   cheerio가 속성값을 읽을 때 자동 디코딩하므로 JSON.parse 바로 가능.
 */
function extractPriceFromInputs(inputsAttr: string): number | null {
  try {
    // @builder-justification: JSON.parse 결과는 unknown이며 즉시 타입 가드로 검증
    const parsed = JSON.parse(inputsAttr) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('customProduct' in parsed)
    ) {
      return null;
    }
    const cp = (parsed as Record<string, unknown>)['customProduct'];
    if (typeof cp !== 'object' || cp === null || !('price' in cp)) {
      return null;
    }
    const priceRaw = (cp as Record<string, unknown>)['price'];
    const priceStr = String(priceRaw).trim();
    if (!priceStr || priceStr === '0' || priceStr === '') return null;
    // 유럽 소수점: 콤마를 점으로 변환 (예: "21,00" → "21.00")
    const normalized = priceStr.replace(',', '.');
    const euros = parseFloat(normalized);
    if (isNaN(euros) || euros <= 0) return null;
    // 유로 → cents 변환 (반올림으로 부동소수 오차 제거)
    return Math.round(euros * 100);
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
  const unlimitedMatch = /unlimited/i.test(cardText);
  if (unlimitedMatch) return 'unlimited';

  // "15 GB" 또는 "15GB" 패턴
  const gbMatch = cardText.match(/(\d+)\s*GB/i);
  if (gbMatch?.[1]) {
    return parseInt(gbMatch[1], 10);
  }
  return null;
}

/**
 * plan명(heading--4)에서 tariff slug 생성.
 * 예: "Basic" → "mobile-basic", "Unlimited" → "mobile-unlimited"
 */
function makeTariffSlug(planName: string): string {
  return `mobile-${planName.toLowerCase().trim().replace(/\s+/g, '-')}`;
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

// ─── Bundle 추출 (PLAN 4.26.a) ────────────────────────────────────────────

/** `customProduct` JSON에서 뽑아낸 번들 가격 3종. */
interface TelenetBundlePricing {
  monthlyCents: number;
  promoCents: number | null;
  promoMonths: number | null;
}

/**
 * bundle 페이지의 `inputs` 속성(JSON)에서 가격을 추출.
 * mobile 페이지의 `extractPriceFromInputs`와 달리 `customProduct.price`
 * 뿐 아니라 `promoPrice` / `duration` 도 명시적으로 존재 — 별도 정규식으로
 * 표준가/프로모 개월을 추측할 필요가 없다 (2026-08-19 실측).
 */
function extractBundlePricing(inputsAttr: string): TelenetBundlePricing | null {
  try {
    // @builder-justification: JSON.parse 결과는 unknown이며 즉시 타입 가드로 검증
    const parsed = JSON.parse(inputsAttr) as unknown;
    if (typeof parsed !== 'object' || parsed === null || !('customProduct' in parsed)) {
      return null;
    }
    const cp = (parsed as Record<string, unknown>)['customProduct'];
    if (typeof cp !== 'object' || cp === null) return null;
    const c = cp as Record<string, unknown>;

    const priceStr = String(c['price'] ?? '').trim();
    if (!priceStr) return null;
    const priceEuros = parseFloat(priceStr.replace(',', '.'));
    if (isNaN(priceEuros) || priceEuros <= 0) return null;
    const monthlyCents = Math.round(priceEuros * 100);

    let promoCents: number | null = null;
    let promoMonths: number | null = null;
    const promoStr = String(c['promoPrice'] ?? '').trim();
    if (promoStr) {
      const promoEuros = parseFloat(promoStr.replace(',', '.'));
      if (!isNaN(promoEuros) && promoEuros < priceEuros) {
        promoCents = Math.round(promoEuros * 100);
        const durationNum = parseInt(String(c['duration'] ?? '').trim(), 10);
        promoMonths = !isNaN(durationNum) && durationNum > 0 ? durationNum : null;
      }
    }

    return { monthlyCents, promoCents, promoMonths };
  } catch {
    return null;
  }
}

/**
 * 다운로드/업로드 속도를 카드 텍스트에서 추출.
 * "200 Mbps max. downloadsnelheid" / "2,5 Gbps max. downloadsnelheid" (유럽
 * 콤마 소수점) 양쪽 지원. Gbps는 ×1000 하여 Mbps로 정규화.
 */
function extractBundleSpeed(cardText: string, direction: 'download' | 'upload'): number | null {
  const suffix = direction === 'download' ? 'downloadsnelheid' : 'uploadsnelheid';
  const re = new RegExp(`([\\d.,]+)\\s*(Mbps|Gbps)\\s*max\\.?\\s*${suffix}`, 'i');
  const m = cardText.match(re);
  if (!m?.[1] || !m[2]) return null;
  const num = parseFloat(m[1].replace(',', '.'));
  if (isNaN(num)) return null;
  return m[2].toLowerCase() === 'gbps' ? Math.round(num * 1000) : Math.round(num);
}

/**
 * bundle(`internet-mobiel-tv.html`) 페이지 HTML에서 Internet+Mobiel+TV
 * 요금제를 추출한다.
 *
 * dedupe:
 *   2026-08-19 실측 — 6개 카드 중 3쌍이 완전히 동일한 가격 JSON을 갖는다
 *   ("15GB 고정" 카피 3장 + "15GB or Unlimited" 카피 3장). 가격 조합
 *   (monthly/promo/promoMonths) 을 dedupe 키로 써서 canonical 3건만 채택 —
 *   첫 occurrence(고정 15GB 카피)가 채택된다.
 *
 * tv_channels:
 *   카드별 명시가 없고 페이지 전역 "Altijd inbegrepen" 섹션에 1회
 *   ("Meer dan 90 tv-zenders")만 등장 — 문서 전체 텍스트에서 1회 추출해
 *   3개 요금제 모두에 동일 적용.
 */
function parseBundlePlans(
  $: ReturnType<typeof cheerio.load>,
  httpStatus: number,
  elapsedMs: number,
  fetchedAt: string,
): TariffSnapshotInput[] {
  const extracted: TariffSnapshotInput[] = [];
  const warnings: string[] = [];
  const seenPricingKeys = new Set<string>();

  const pageText = $.root().text().replace(/\s+/g, ' ');
  const tvMatch = pageText.match(/Meer dan\s+(\d+)\s+tv-zenders/i);
  const tvChannels = tvMatch?.[1] ? parseInt(tvMatch[1], 10) : null;
  if (tvChannels === null) {
    warnings.push('tv_channels not extracted (page-level "Meer dan N tv-zenders" 미검출)');
  }

  const cards = $('div.cmp-product-summary');

  cards.each((idx, el) => {
    const card = $(el);

    const inputsAttr = card
      .find('tg-lazy-loading-standalone[component-id="tg-marketing-cafe-pricing"]')
      .first()
      .attr('inputs');
    if (!inputsAttr) {
      warnings.push(`bundle card ${idx}: inputs attr not found, skipping`);
      return;
    }

    const pricing = extractBundlePricing(inputsAttr);
    if (!pricing) return; // price=0 등 비활성 카드 — 정상 skip

    const dedupeKey = `${pricing.monthlyCents}-${pricing.promoCents}-${pricing.promoMonths}`;
    if (seenPricingKeys.has(dedupeKey)) return; // 중복 렌더 카드 dedupe
    seenPricingKeys.add(dedupeKey);

    const cardText = card.text().replace(/\s+/g, ' ');
    const downloadMbps = extractBundleSpeed(cardText, 'download');
    const uploadMbps = extractBundleSpeed(cardText, 'upload');
    const dataMatch = cardText.match(/(\d+)\s*GB mobiele data/i);
    const dataGb = dataMatch?.[1] ? parseInt(dataMatch[1], 10) : null;

    if (downloadMbps === null) warnings.push(`bundle card ${idx}: download_mbps not extracted`);
    if (uploadMbps === null) warnings.push(`bundle card ${idx}: upload_mbps not extracted`);
    if (dataGb === null) warnings.push(`bundle card ${idx}: data_gb not extracted`);

    const downMatchRaw = cardText.match(/([\d.,]+)\s*(Mbps|Gbps)\s*max\.?\s*downloadsnelheid/i);
    const speedLabel =
      downMatchRaw?.[1] && downMatchRaw[2] ? `${downMatchRaw[1]} ${downMatchRaw[2]}` : `plan ${idx}`;
    const tariffName = `Internet + Mobiel + TV ${speedLabel}`;
    const slugSpeed = downloadMbps !== null ? `${downloadMbps}mbps` : `plan-${idx}`;
    const tariffSlug = `telenet-bundle-${slugSpeed}`;

    const promoDescription =
      pricing.promoCents !== null && pricing.promoMonths !== null
        ? `처음 ${pricing.promoMonths}개월 €${(pricing.promoCents / 100).toFixed(2)} 프로모`
        : null;

    const sanity = checkMonthlySanity(pricing.monthlyCents);
    const cardWarnings = warnings.filter((w) => w.includes(`card ${idx}`));
    const confidenceResult = computeConfidence({
      selectorMatched: true,
      sanityChecks: [sanity],
      parseWarnings: cardWarnings,
    });

    extracted.push({
      providerSlug: 'telenet-be',
      tariffSlug,
      tariffName,
      category: 'bundle_mobile_internet_tv',
      monthlyPriceCents: pricing.monthlyCents,
      activationFeeCents: 0,
      modemRentalCents: 0, // Telenet TV-box + modem 기본 포함 (페이지 명시)
      promoPriceCents: pricing.promoCents,
      promoMonths: pricing.promoMonths,
      promoDescription,
      commitmentMonths: 0, // 페이지에 약정 기간 명시 없음 — mobile fetcher 기본값 재사용
      earlyTerminationFeeCents: null,
      attributes: {
        category: 'bundle_mobile_internet_tv',
        download_mbps: downloadMbps ?? 1, // 추출 실패 시 최소값 (warning 추가됨)
        upload_mbps: uploadMbps ?? 1,
        unlimited_data: true, // 페이지 전역 명시: "Onbeperkt, veilig surfen"
        fair_use_gb: null,
        wifi_booster_included: false,
        tv_channels: tvChannels ?? 0, // 추출 실패 시 0 (warning 추가됨)
        tv_4k_included: false, // 페이지에 4K 명시 없음 (추측 금지)
        dvr_hours: null, // TV Replay 일수는 dvr_hours 매핑 근거 불충분
        data_gb: dataGb ?? 'unlimited', // 추출 실패 시 보수적 fallback (warning 추가됨)
        voice_minutes: 'unlimited' as const, // 페이지 전역 명시: "Onbeperkt bellen en sms'en"
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
          plan_name: tariffName,
          monthly_cents: pricing.monthlyCents,
          promo_cents: pricing.promoCents,
          download_mbps: downloadMbps,
          upload_mbps: uploadMbps,
        },
        warnings: cardWarnings,
        ...sanity,
      },
    });
  });

  return extracted;
}

// ─── HTTP fetch 헬퍼 (PLAN 4.26.a — mobile/bundle 2페이지 공용) ────────────

interface TelenetPageFetchResult {
  html: string | null;
  httpStatus: number;
  elapsedMs: number;
  warning: string | null;
}

/**
 * 단일 URL을 fetch해 HTML(또는 null)을 반환한다. throw하지 않음 — 페이지
 * 단위 degrade를 위해 오류를 값으로 반환 (Proximus `fetchPage` 패턴 재사용).
 */
async function fetchTelenetPage(url: string): Promise<TelenetPageFetchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STUB_FETCH_TIMEOUT_MS);

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
     * Telenet 은 mobile + bundle_mobile_internet_tv 두 카테고리를 스크래핑한다
     * (PLAN 4.26.a). internet_fixed 단독은 여전히 manual 폴백 대상 — categories
     * 에 미포함 (파일 상단 주석 "internet.html 이연" 참고).
     * admin-metrics 의 CASE WHEN 매핑 자동 생성 용 (PLAN 1.5.6).
     */
    categories: ['mobile', 'bundle_mobile_internet_tv'] as const,
    version: FETCHER_VERSION,
    homepageUrl: 'https://www.telenet.be',
  },

  async fetch(): Promise<FetchOutcome> {
    const fetchedAt = new Date().toISOString();

    // ─── STUB_FAIL 환경변수 (1.9 격리 수동 검증용) ─────────────────────────
    // 실 scraping fetcher에도 유지 — 격리 테스트 시나리오 보호 목적.
    const failure = stubFailOutcome(
      'telenet-be',
      'STUB_FAIL_TELENET',
      FETCHER_VERSION,
      fetchedAt,
    );
    if (failure) return failure;

    // ─── mobile 페이지 fetch ────────────────────────────────────────────────
    const mobPage = await fetchTelenetPage(MOBILE_SOURCE_URL);
    const allWarnings: string[] = [];
    const allExtracted: TariffSnapshotInput[] = [];

    if (mobPage.html !== null) {
      const $ = cheerio.load(mobPage.html);
      const cards = $('div.cmp-product-summary');
      const warnings: string[] = [];

      const mobExtracted: TariffSnapshotInput[] = [];

      cards.each((_idx, el) => {
        const card = $(el);

        // plan명: heading--4 클래스의 h3 텍스트
        const planName = card.find('.heading--4').first().text().trim();
        if (!planName) {
          warnings.push(`card ${_idx}: plan name not found, skipping`);
          return; // cheerio each에서 skip
        }

        // 가격: tg-lazy-loading-standalone inputs 속성 → customProduct.price
        const inputsAttr = card
          .find('tg-lazy-loading-standalone[component-id="tg-marketing-cafe-pricing"]')
          .attr('inputs');

        if (!inputsAttr) {
          warnings.push(`card ${_idx} (${planName}): inputs attr not found, skipping`);
          return;
        }

        const priceCents = extractPriceFromInputs(inputsAttr);
        if (priceCents === null) {
          // price=0인 카드는 "인터넷 조합 시" 전용 카드 → 정상적으로 skip
          // (parseWarning 추가 안 함 — 예상된 동작)
          return;
        }

        // data_gb: heading--3 텍스트에서 추출 (예: "15 GB data", "Unlimited data")
        const dataHeading = card.find('[data-tg-cmp-is="title"].heading--3, .heading--3').first().text().trim();
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

        mobExtracted.push({
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
            http: { status: mobPage.httpStatus, elapsed_ms: mobPage.elapsedMs },
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

      if (mobExtracted.length === 0) {
        warnings.push(
          `No mobile plans parsed. Cards found: ${cards.length}. Selector or HTML structure may have changed.`,
        );
      }
      allExtracted.push(...mobExtracted);
      allWarnings.push(...warnings.map((w) => `mobile page: ${w}`));
    } else if (mobPage.warning) {
      allWarnings.push(`mobile page: ${mobPage.warning}`);
    }

    // ─── bundle 페이지 fetch (PLAN 4.26.a) ─────────────────────────────────
    const bundlePage = await fetchTelenetPage(BUNDLE_SOURCE_URL);
    if (bundlePage.html !== null) {
      const $ = cheerio.load(bundlePage.html);
      const bundlePlans = parseBundlePlans(
        $,
        bundlePage.httpStatus,
        bundlePage.elapsedMs,
        fetchedAt,
      );
      allExtracted.push(...bundlePlans);
      if (bundlePlans.length === 0) {
        allWarnings.push('bundle page: no bundle plans parsed (selector 변경 의심)');
      }
    } else if (bundlePage.warning) {
      allWarnings.push(`bundle page: ${bundlePage.warning}`);
    }

    // ─── 결과 검증 ──────────────────────────────────────────────────────────
    // 두 페이지 모두 0개면 실패. 한 페이지만 성공해도 ok:true (페이지 단위 degrade).
    if (allExtracted.length === 0) {
      return {
        ok: false,
        error: {
          fetcherSlug: 'telenet-be',
          fetchedAt,
          kind: mobPage.warning && bundlePage.warning ? 'network' : 'parse',
          message: `No tariffs parsed from any page. mobile: ${mobPage.warning ?? `${mobPage.httpStatus} ok`}, bundle: ${bundlePage.warning ?? `${bundlePage.httpStatus} ok`}`,
          rawPayload: {
            stub: false,
            fetcher_version: FETCHER_VERSION,
            mobile_url: MOBILE_SOURCE_URL,
            bundle_url: BUNDLE_SOURCE_URL,
            mobile_http: { status: mobPage.httpStatus, elapsed_ms: mobPage.elapsedMs },
            bundle_http: { status: bundlePage.httpStatus, elapsed_ms: bundlePage.elapsedMs },
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
