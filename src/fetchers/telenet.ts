/**
 * Telenet 스텁 fetcher (PLAN 1.8)
 *
 * 왜 스텁인가?
 *   Proximus 스텁과 동일 이유. FOUNDER.md 솔로 사이드 컨텍스트에서 실 스크래핑은
 *   시간 sink다. 스텁으로 파이프라인(1.10 투명성 페이지, 1.11 비교 엔진) 통합
 *   검증을 먼저 진행한다. 실 스크래핑은 PLAN 1.5.6 부채.
 *
 * P1 (정보 우선) 준수:
 *   confidence='low' + confidenceReason에 'stub fetcher' 명시.
 *
 * STUB_FAIL_TELENET=1 환경변수:
 *   1.9 격리 동작 수동 검증용. Proximus와 함께 쌍으로 테스트 가능:
 *   STUB_FAIL_PROXIMUS=1 → Proximus 실패 → Telenet은 계속 진행 (격리 확인).
 *   STUB_FAIL_TELENET=1 → Telenet 실패 → Proximus는 계속 진행 (격리 확인).
 *
 * 외부 사실 (ADR-0005 §외부 사실, WebSearch 2026-05-09):
 *   - Telenet ONE Essential Internet ≈ €49/월 (150 Mbps 시작가)
 *   - Telenet ONE Internet (중간급) ≈ €59/월 (400 Mbps)
 *   - Telenet Mobile GO 10 GB ≈ €20/월
 *   - Telenet Essential Internet: 활성화 무료 w/ ONE/ONEup, Wi-Fi booster €0 기본
 *
 * 결정 근거: docs/adr/0008-fetcher-interface-and-cron.md + ADR-0009
 *
 * harness:data Rule 1: 본 파일은 FetchOutcome(ok=true) 안의 FetchResult를 반환.
 * FetchResult 타입 출처: src/fetchers/types.ts
 */

import type { Fetcher, FetchOutcome } from './types';
import { computeConfidence, checkMonthlySanity } from './confidence';

// ─── 스텁 상수 ────────────────────────────────────────────────────────────

const FETCHER_VERSION = 'telenet-be@2026-05-09';
const STUB_REASON =
  'stub fetcher — manual data 2026-05-09; replace with real scraper (PLAN 1.5.6)';

/**
 * Telenet 공식 인터넷 요금제 마스터 페이지 (ADR-0005 §외부 사실에서 확인됨).
 */
const INTERNET_SOURCE_URL =
  'https://www2.telenet.be/residential/en/products/productoverzicht.html';

/**
 * Telenet 공식 모바일 요금제 페이지.
 */
const MOBILE_SOURCE_URL =
  'https://www2.telenet.be/residential/en/products/mobile.html';

// ─── Confidence 계산 (스텁은 항상 low) ──────────────────────────────────

/**
 * 스텁 fetcher의 confidence는 항상 'low'.
 * ADR-0008 §T3: down-grade override — selectorMatched=false이므로 base도 low.
 */
function makeStubConfidence() {
  return computeConfidence({
    selectorMatched: false, // 스텁: 실 fetch 없음
    sanityChecks: [],
    parseWarnings: [],
  });
}

// ─── Fetcher 구현 ─────────────────────────────────────────────────────────

export const telenet: Fetcher = {
  metadata: {
    providerSlug: 'telenet-be',
    displayName: 'Telenet',
    country: 'BE',
    /**
     * method='stub': 현재 개발용 고정 데이터 fetcher.
     * ADR-0011 §T2 항목 3 — 스텁임을 /data-sources 페이지에 정직하게 노출 (P1).
     * 1.5.6 실 스크래핑 전환 시 이 줄만 'scraping'으로 변경.
     */
    method: 'stub',
    version: FETCHER_VERSION,
    homepageUrl: 'https://www.telenet.be',
  },

  async fetch(): Promise<FetchOutcome> {
    const fetchedAt = new Date().toISOString();

    // ─── STUB_FAIL 환경변수 처리 (1.9 격리 수동 검증용) ───────────────────
    // Proximus와 독립적으로 테스트 가능 — 한 fetcher 실패가 다른 fetcher에 영향 없음.
    if (process.env['STUB_FAIL_TELENET'] === '1') {
      return {
        ok: false,
        error: {
          fetcherSlug: 'telenet-be',
          fetchedAt,
          kind: 'network',
          message:
            'STUB_FAIL_TELENET=1: simulated failure for 1.9 isolation testing',
          rawPayload: {
            stub: true,
            fetcher_version: FETCHER_VERSION,
            simulated_failure: true,
          },
        },
      };
    }

    // ─── 실 fetch 준비 코드 (현재 비활성 — 1.5.6에서 활성화) ───────────────
    // const controller = new AbortController();
    // const timeoutId = setTimeout(() => controller.abort(), 25_000);
    // try {
    //   const response = await fetch(INTERNET_SOURCE_URL, {
    //     signal: controller.signal,
    //   });
    //   // HTML 파싱 + 셀렉터 추출 로직 (1.5.6)
    // } finally {
    //   clearTimeout(timeoutId);
    // }

    const stubConfidence = makeStubConfidence();

    return {
      ok: true,
      result: {
        fetcherSlug: 'telenet-be',
        fetchedAt,
        data: [
          // ─── Essential Internet (150 Mbps) ─────────────────────────────
          {
            providerSlug: 'telenet-be',
            tariffSlug: 'telenet-internet-essential',
            tariffName: 'Essential Internet',
            category: 'internet_fixed',
            // 외부 사실: Telenet Essential Internet 시작가 ≈ €49/월 (ADR-0005)
            monthlyPriceCents: 4900,
            // 외부 사실: ONE/ONEup 활성화 무료 (ADR-0005 §외부 사실)
            activationFeeCents: 0,
            // 외부 사실: Wi-Fi booster 기본 무료 임대 (ADR-0005 §외부 사실)
            modemRentalCents: 0,
            promoPriceCents: null,
            promoMonths: null,
            promoDescription: null,
            commitmentMonths: 12,
            earlyTerminationFeeCents: 5000, // 약 €50 해지 위약금 (추정)
            attributes: {
              download_mbps: 150,
              upload_mbps: 15,
              unlimited_data: true,
              fair_use_gb: null,
              wifi_booster_included: true,
            },
            sourceUrl: INTERNET_SOURCE_URL,
            confidence: stubConfidence.confidence,
            confidenceReason: STUB_REASON,
            rawPayload: {
              stub: true,
              reason: STUB_REASON,
              fetcher_version: FETCHER_VERSION,
              fetched_at: fetchedAt,
              ...checkMonthlySanity(4900),
            },
          },

          // ─── ONE Internet (400 Mbps) ────────────────────────────────────
          {
            providerSlug: 'telenet-be',
            tariffSlug: 'telenet-one-internet',
            tariffName: 'ONE Internet',
            category: 'internet_fixed',
            // 외부 사실: Telenet ONE Internet ≈ €59/월 (시장 관찰값)
            monthlyPriceCents: 5900,
            activationFeeCents: 0,
            modemRentalCents: 0,
            // 외부 사실: 첫 3개월 프로모 있는 경우가 많음 (시장 관찰값)
            promoPriceCents: 4900,
            promoMonths: 3,
            promoDescription: '처음 3개월 €10 할인',
            commitmentMonths: 12,
            earlyTerminationFeeCents: 7500,
            attributes: {
              download_mbps: 400,
              upload_mbps: 40,
              unlimited_data: true,
              fair_use_gb: null,
              wifi_booster_included: true,
            },
            sourceUrl: INTERNET_SOURCE_URL,
            confidence: stubConfidence.confidence,
            confidenceReason: STUB_REASON,
            rawPayload: {
              stub: true,
              reason: STUB_REASON,
              fetcher_version: FETCHER_VERSION,
              fetched_at: fetchedAt,
              ...checkMonthlySanity(5900),
            },
          },

          // ─── Mobile GO 10 GB ────────────────────────────────────────────
          {
            providerSlug: 'telenet-be',
            tariffSlug: 'telenet-mobile-go-10',
            tariffName: 'Mobile GO 10 GB',
            category: 'mobile',
            // 외부 사실: Telenet Mobile GO 10 GB ≈ €20/월 (시장 관찰값)
            monthlyPriceCents: 2000,
            activationFeeCents: 0,
            modemRentalCents: null,
            promoPriceCents: null,
            promoMonths: null,
            promoDescription: null,
            commitmentMonths: 0,
            earlyTerminationFeeCents: null,
            attributes: {
              data_gb: 10,
              voice_minutes: 'unlimited',
              sms: 'unlimited',
              eu_roaming_included: true,
              throttle_after_gb_speed_kbps: null,
            },
            sourceUrl: MOBILE_SOURCE_URL,
            confidence: stubConfidence.confidence,
            confidenceReason: STUB_REASON,
            rawPayload: {
              stub: true,
              reason: STUB_REASON,
              fetcher_version: FETCHER_VERSION,
              fetched_at: fetchedAt,
              ...checkMonthlySanity(2000),
            },
          },

          // ─── ONE up 번들 (인터넷 + TV) ────────────────────────────────
          {
            providerSlug: 'telenet-be',
            tariffSlug: 'telenet-one-up-bundle',
            tariffName: 'ONE up (인터넷+TV 번들)',
            category: 'bundle_internet_tv',
            // 외부 사실: Telenet ONE up 번들 ≈ €80/월 (시장 관찰값)
            monthlyPriceCents: 8000,
            activationFeeCents: 0,
            modemRentalCents: 0,
            promoPriceCents: null,
            promoMonths: null,
            promoDescription: null,
            commitmentMonths: 24,
            earlyTerminationFeeCents: 12000,
            attributes: {
              download_mbps: 400,
              upload_mbps: 40,
              unlimited_data: true,
              fair_use_gb: null,
              wifi_booster_included: true,
              tv_channels: 100,
              tv_4k_included: true,
              dvr_hours: 100,
              mobile_lines_included: 0,
            },
            sourceUrl: INTERNET_SOURCE_URL,
            confidence: stubConfidence.confidence,
            confidenceReason: STUB_REASON,
            rawPayload: {
              stub: true,
              reason: STUB_REASON,
              fetcher_version: FETCHER_VERSION,
              fetched_at: fetchedAt,
              ...checkMonthlySanity(8000),
            },
          },
        ],
      },
    };
  },
};

export default telenet;
