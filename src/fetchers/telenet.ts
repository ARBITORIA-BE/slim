/**
 * Telenet mobile 실 스크래핑 fetcher (PLAN 1.5.6)
 *
 * internet/bundle = Amendment 3 manual 폴백 대상, 운영자 데이터 입력 후 별도 처리(1.5.6 follow-up).
 * 이번 구현은 mobile 카테고리 요금제만 반환한다.
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
 * B.5 컴플라이언스:
 *   HTTP !ok / 403 / 429 / 챌린지 페이지 → throw 없이 ok:false 반환.
 *
 * STUB_FAIL_TELENET=1:
 *   1.9 격리 수동 검증용 — 실 fetcher에도 유지 (테스트 격리 시나리오 보호).
 *
 * 결정 근거: docs/adr/0013-fetcher-real-scraping-risk-assessment.md Amendment 3
 */

import * as cheerio from 'cheerio';
import type { Fetcher, FetchOutcome, FetchResult, TariffSnapshotInput } from './types';
import { computeConfidence, checkMonthlySanity } from './confidence';
import { STUB_FETCH_TIMEOUT_MS, stubFailOutcome } from './_shared';

// ─── 상수 ─────────────────────────────────────────────────────────────────

const FETCHER_VERSION = 'telenet-be@2026-05-28';

const MOBILE_SOURCE_URL =
  'https://www2.telenet.be/residential/nl/producten/mobiel.html';

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

    // ─── HTTP fetch ─────────────────────────────────────────────────────────
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      STUB_FETCH_TIMEOUT_MS, // 25s — Inngest free step timeout 보수 가정
    );

    let html: string;
    let httpStatus: number;
    let elapsedMs: number;
    const startTime = Date.now();

    try {
      const response = await fetch(MOBILE_SOURCE_URL, {
        signal: controller.signal,
        redirect: 'follow', // www.telenet.be → www2.telenet.be 302 처리
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'nl-BE,nl;q=0.9',
        },
      });
      elapsedMs = Date.now() - startTime;
      httpStatus = response.status;

      // B.5: HTTP 에러 코드 처리
      if (!response.ok || httpStatus === 403 || httpStatus === 429) {
        return {
          ok: false,
          error: {
            fetcherSlug: 'telenet-be',
            fetchedAt,
            kind: 'network',
            message: `HTTP ${httpStatus} from ${MOBILE_SOURCE_URL}`,
            rawPayload: {
              stub: false,
              fetcher_version: FETCHER_VERSION,
              url: MOBILE_SOURCE_URL,
              http: { status: httpStatus, elapsed_ms: elapsedMs },
            },
          },
        };
      }

      html = await response.text();
    } catch (err: unknown) {
      elapsedMs = Date.now() - startTime;
      const message =
        err instanceof Error ? err.message : 'unknown network error';
      return {
        ok: false,
        error: {
          fetcherSlug: 'telenet-be',
          fetchedAt,
          kind: 'network',
          message: `fetch failed: ${message}`,
          rawPayload: {
            stub: false,
            fetcher_version: FETCHER_VERSION,
            url: MOBILE_SOURCE_URL,
            http: { status: 0, elapsed_ms: elapsedMs },
          },
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }

    // ─── B.5: 챌린지 페이지 감지 ────────────────────────────────────────────
    if (isChallengeBody(html)) {
      return {
        ok: false,
        error: {
          fetcherSlug: 'telenet-be',
          fetchedAt,
          kind: 'network',
          message: 'Bot challenge page detected (Cloudflare/Akamai)',
          rawPayload: {
            stub: false,
            fetcher_version: FETCHER_VERSION,
            url: MOBILE_SOURCE_URL,
            http: { status: httpStatus, elapsed_ms: elapsedMs },
          },
        },
      };
    }

    // ─── HTML 파싱 ──────────────────────────────────────────────────────────
    const $ = cheerio.load(html);
    const cards = $('div.cmp-product-summary');
    const warnings: string[] = [];
    const extracted: TariffSnapshotInput[] = [];

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

    // ─── 결과 검증 ──────────────────────────────────────────────────────────

    // 실제 가격 카드(price > 0)가 하나도 파싱되지 않은 경우
    if (extracted.length === 0) {
      return {
        ok: false,
        error: {
          fetcherSlug: 'telenet-be',
          fetchedAt,
          kind: 'parse',
          message: `No mobile plans parsed. Cards found: ${cards.length}. Selector or HTML structure may have changed.`,
          rawPayload: {
            stub: false,
            fetcher_version: FETCHER_VERSION,
            url: MOBILE_SOURCE_URL,
            http: { status: httpStatus, elapsed_ms: elapsedMs },
            cards_found: cards.length,
            warnings,
          },
        },
      };
    }

    // FetchResult 타입 명시 — harness:data Rule 1 + ADR-0008 T4 discriminated union
    const result: FetchResult = {
      fetcherSlug: 'telenet-be',
      fetchedAt,
      data: extracted,
    };
    return { ok: true, result };
  },
};

export default telenet;
