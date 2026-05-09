/**
 * Proximus 스텁 fetcher (PLAN 1.8)
 *
 * 왜 스텁인가?
 *   실 스크래핑은 셀렉터 깨짐 + 디버깅 시간 sink다. FOUNDER.md 컨텍스트:
 *   솔로 사이드, 개발 3개월. 실 스크래핑이 막히면 1.11 비교 엔진 / 1.10 투명성
 *   페이지 등 모든 후속 작업이 멈춘다. 스텁으로 파이프라인 통합 검증을 먼저
 *   진행하고, 실 스크래핑은 1.5.6 부채로 분리한다.
 *
 * P1 (정보 우선) 준수:
 *   confidence='low' + confidenceReason에 'stub fetcher' 명시.
 *   rawPayload에 { stub: true, reason } 명시. 사용자에게 거짓 '고신뢰'를 주지 않음.
 *
 * STUB_FAIL_PROXIMUS=1 환경변수:
 *   1.9 격리 동작 수동 검증용. 이 변수가 설정되면 FetchOutcome.ok=false 반환.
 *   실제 운영에서는 절대 설정하지 않는다.
 *
 * 실 스크래핑 준비:
 *   AbortController 25s timeout 코드 블록은 주석 처리됨. 실 fetch 전환 시
 *   주석 해제 + HTML 파싱 로직 추가 (1.5.6).
 *
 * 외부 사실 (ADR-0005 §외부 사실, WebSearch 2026-05-09):
 *   - Proximus Mobile Essential 5 GB ≈ €15/월
 *   - Proximus Mobile Smart 70 GB ≈ €25/월 (6개월 프로모 €15)
 *   - Proximus Mobile Unlimited ≈ €35/월 (throttle 512 Kbps)
 *   - Proximus Essential Internet ≈ €35/월 (150 Mbps)
 *
 * 결정 근거: docs/adr/0008-fetcher-interface-and-cron.md + ADR-0009
 *
 * harness:data Rule 1: 본 파일은 FetchOutcome(ok=true) 안의 FetchResult를 반환.
 * FetchResult 타입 출처: src/fetchers/types.ts
 */

import type { Fetcher, FetchOutcome } from './types';
import { checkMonthlySanity } from './confidence';
import { makeStubConfidence, stubFailOutcome, STUB_REASON } from './_shared';

// ─── 스텁 상수 ────────────────────────────────────────────────────────────

const FETCHER_VERSION = 'proximus-be@2026-05-09';

/**
 * Proximus 공식 모바일 요금제 마스터 페이지.
 * 실 스크래핑 전환 시 이 URL에서 HTML fetch → 파싱.
 */
const MOBILE_SOURCE_URL =
  'https://www.proximus.be/en/personal/products/mobile/mobile-subscriptions/proximus-mobile.html';

/**
 * Proximus 공식 인터넷 요금제 마스터 페이지.
 */
const INTERNET_SOURCE_URL =
  'https://www.proximus.be/en/personal/products/internet/home-internet.html';

// ─── Fetcher 구현 (공통 helper는 _shared.ts) ────────────────────────────────

export const proximus: Fetcher = {
  metadata: {
    providerSlug: 'proximus-be',
    displayName: 'Proximus',
    country: 'BE',
    /**
     * method='stub': 현재 개발용 고정 데이터 fetcher.
     * ADR-0011 §T2 항목 3 — 스텁임을 /data-sources 페이지에 정직하게 노출 (P1).
     * 1.5.6 실 스크래핑 전환 시 이 줄만 'scraping'으로 변경.
     */
    method: 'stub',
    version: FETCHER_VERSION,
    homepageUrl: 'https://www.proximus.be',
  },

  async fetch(): Promise<FetchOutcome> {
    const fetchedAt = new Date().toISOString();

    // ─── STUB_FAIL 환경변수 처리 (1.9 격리 수동 검증용) ───────────────────
    // _shared.ts의 stubFailOutcome 헬퍼 사용. 운영에서는 절대 설정하지 않는다.
    const failure = stubFailOutcome(
      'proximus-be',
      'STUB_FAIL_PROXIMUS',
      FETCHER_VERSION,
      fetchedAt,
    );
    if (failure) return failure;

    // ─── 실 fetch 준비 코드 (현재 비활성 — 1.5.6에서 활성화) ───────────────
    // const controller = new AbortController();
    // const timeoutId = setTimeout(() => controller.abort(), 25_000); // 25s
    // try {
    //   const response = await fetch(MOBILE_SOURCE_URL, {
    //     signal: controller.signal,
    //   });
    //   // HTML 파싱 + 셀렉터 추출 로직 (1.5.6)
    // } finally {
    //   clearTimeout(timeoutId);
    // }

    // ─── 스텁 데이터 (plausible — ADR-0005 §외부 사실 기반) ──────────────
    // 외부 사실: Proximus WebSearch 2026-05-09 기준 시장 관찰값
    const stubConfidence = makeStubConfidence();

    return {
      ok: true,
      result: {
        fetcherSlug: 'proximus-be',
        fetchedAt,
        data: [
          // ─── Mobile Essential 5 GB ──────────────────────────────────────
          {
            providerSlug: 'proximus-be',
            tariffSlug: 'proximus-mobile-essential',
            tariffName: 'Mobile Essential 5 GB',
            category: 'mobile',
            // 외부 사실: Proximus Essential ≈ €15/월 (2026-05-09 WebSearch)
            monthlyPriceCents: 1500,
            activationFeeCents: 0,
            modemRentalCents: null, // 모바일: 모뎀 임대 없음
            promoPriceCents: null,
            promoMonths: null,
            promoDescription: null,
            commitmentMonths: 0, // non-binding
            earlyTerminationFeeCents: null,
            attributes: {
              data_gb: 5,
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
              ...checkMonthlySanity(1500),
            },
          },

          // ─── Mobile Smart 70 GB ─────────────────────────────────────────
          {
            providerSlug: 'proximus-be',
            tariffSlug: 'proximus-mobile-smart-70',
            tariffName: 'Mobile Smart 70 GB',
            category: 'mobile',
            // 외부 사실: Proximus Smart 70 GB ≈ €25/월 (ADR-0005 §외부 사실)
            monthlyPriceCents: 2500,
            activationFeeCents: 0,
            modemRentalCents: null,
            // 외부 사실: 6 months promo discount ≈ €15/월 (ADR-0005 §외부 사실)
            promoPriceCents: 1500,
            promoMonths: 6,
            promoDescription: '처음 6개월 €10 할인 (non-binding 전용)',
            commitmentMonths: 0,
            earlyTerminationFeeCents: null,
            attributes: {
              data_gb: 70,
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
              ...checkMonthlySanity(2500),
            },
          },

          // ─── Mobile Unlimited ───────────────────────────────────────────
          {
            providerSlug: 'proximus-be',
            tariffSlug: 'proximus-mobile-unlimited',
            tariffName: 'Mobile Unlimited',
            category: 'mobile',
            // 외부 사실: Proximus Unlimited ≈ €35/월 (ADR-0005 §외부 사실)
            monthlyPriceCents: 3500,
            activationFeeCents: 0,
            modemRentalCents: null,
            promoPriceCents: null,
            promoMonths: null,
            promoDescription: null,
            commitmentMonths: 0,
            earlyTerminationFeeCents: null,
            attributes: {
              data_gb: 'unlimited',
              voice_minutes: 'unlimited',
              sms: 'unlimited',
              eu_roaming_included: true,
              // 외부 사실: Proximus Unlimited throttle after soft limit = 512 Kbps
              throttle_after_gb_speed_kbps: 512,
            },
            sourceUrl: MOBILE_SOURCE_URL,
            confidence: stubConfidence.confidence,
            confidenceReason: STUB_REASON,
            rawPayload: {
              stub: true,
              reason: STUB_REASON,
              fetcher_version: FETCHER_VERSION,
              fetched_at: fetchedAt,
              ...checkMonthlySanity(3500),
            },
          },

          // ─── Essential Internet ─────────────────────────────────────────
          {
            providerSlug: 'proximus-be',
            tariffSlug: 'proximus-internet-essential',
            tariffName: 'Internet Essential',
            category: 'internet_fixed',
            // 외부 사실: Proximus Essential Internet ≈ €35/월 (ADR-0005 §외부 사실)
            monthlyPriceCents: 3500,
            activationFeeCents: 0,
            // 외부 사실: Proximus 모뎀 임대 무료 (기본 모뎀 포함)
            modemRentalCents: 0,
            promoPriceCents: null,
            promoMonths: null,
            promoDescription: null,
            commitmentMonths: 0,
            earlyTerminationFeeCents: null,
            attributes: {
              download_mbps: 150,
              upload_mbps: 15,
              unlimited_data: true,
              fair_use_gb: null,
              wifi_booster_included: false,
            },
            sourceUrl: INTERNET_SOURCE_URL,
            confidence: stubConfidence.confidence,
            confidenceReason: STUB_REASON,
            rawPayload: {
              stub: true,
              reason: STUB_REASON,
              fetcher_version: FETCHER_VERSION,
              fetched_at: fetchedAt,
              ...checkMonthlySanity(3500),
            },
          },
        ],
      },
    };
  },
};

export default proximus;
