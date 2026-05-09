/**
 * Fetcher 인터페이스 + FetchResult 타입 단위 테스트.
 *
 * 본 테스트는 *타입 모양*과 *런타임 사용 패턴*을 모두 검증한다. 실제 fetcher
 * 구현(1.8)은 별도 테스트 — 본 파일은 인터페이스 자체의 정합성만.
 *
 * 예시 도메인 = 통신 BE (proximus-be) — ADR-0005 §결정 1에 따른 카테고리.
 */
import { describe, it, expect } from 'vitest';
import type {
  FetchResult,
  FetchError,
  FetchOutcome,
  Fetcher,
  FetcherMetadata,
  TariffSnapshotInput,
} from './types';

describe('FetcherMetadata', () => {
  it('readonly 필드로 fetcher 자기 선언 (T5 — /data-sources 1.10 입력)', () => {
    const meta: FetcherMetadata = {
      providerSlug: 'proximus-be',
      displayName: 'Proximus',
      country: 'BE',
      method: 'scraping',
      version: 'proximus-be@2026-05-09',
      homepageUrl: 'https://www.proximus.be/en/mobile-subscription',
    };
    expect(meta.providerSlug).toBe('proximus-be');
    expect(meta.method).toBe('scraping');
    // P3 투명성 — method가 enum 3값 중 하나여야 함
    expect(['api', 'scraping', 'manual']).toContain(meta.method);
  });
});

describe('TariffSnapshotInput', () => {
  it('가격은 정수 cents (ADR-0005 §T2 + ADR-0006 §T2)', () => {
    const input: TariffSnapshotInput = {
      providerSlug: 'proximus-be',
      tariffSlug: 'mobile-smart-70',
      tariffName: 'Mobile Smart 70 GB',
      category: 'mobile',
      monthlyPriceCents: 2500, // €25.00 — 정수, 부동소수 위험 0
      activationFeeCents: 0,
      modemRentalCents: null, // 모바일은 모뎀 임대 개념 없음
      promoPriceCents: 1500, // €15.00 — 6 months promo
      promoMonths: 6,
      promoDescription: '처음 6개월 €10 할인',
      commitmentMonths: 0, // non-binding
      earlyTerminationFeeCents: null,
      attributes: {
        data_gb: 70,
        voice_minutes: 'unlimited',
        sms: 'unlimited',
        eu_roaming_included: true,
      },
      sourceUrl: 'https://www.proximus.be/en/mobile-subscription/smart',
      confidence: 'high',
      confidenceReason: 'selector .price--current matched 1; sanity passed',
      rawPayload: {
        fetcher_version: 'proximus-be@2026-05-09',
        url: 'https://www.proximus.be/en/mobile-subscription/smart',
        warnings: [],
        http: { status: 200, elapsed_ms: 432 },
      },
    };

    // 정수 cents 검증 — 1.12 ±0.01€ DoD가 정수 산술로 보장됨
    expect(Number.isInteger(input.monthlyPriceCents)).toBe(true);
    expect(input.monthlyPriceCents).toBe(2500);
    // 모바일 카테고리 invariant
    expect(input.category).toBe('mobile');
    expect(input.modemRentalCents).toBeNull();
  });

  it('인터넷 카테고리는 다른 attributes 모양 (Zod 단일 출처는 1.8)', () => {
    const input: TariffSnapshotInput = {
      providerSlug: 'telenet-be',
      tariffSlug: 'one-essential-internet',
      tariffName: 'Essential Internet',
      category: 'internet_fixed',
      monthlyPriceCents: 4900,
      activationFeeCents: 0, // ONE/ONEup 활성화 무료
      modemRentalCents: 200, // €2/월 추가 (Wi-Fi booster)
      promoPriceCents: null,
      promoMonths: null,
      promoDescription: null,
      commitmentMonths: 12,
      earlyTerminationFeeCents: 5000,
      attributes: {
        download_mbps: 150,
        upload_mbps: 15,
        unlimited_data: true,
        wifi_booster_included: true,
      },
      sourceUrl: 'https://www2.telenet.be/residential/en/pages/essential-internet.html',
      confidence: 'medium',
      confidenceReason: 'fallback selector matched (primary missing)',
      rawPayload: {
        fetcher_version: 'telenet-be@2026-05-09',
        url: 'https://www2.telenet.be/residential/en/pages/essential-internet.html',
        warnings: ['primary selector .tn-price not found, used .price-fallback'],
        http: { status: 200, elapsed_ms: 612 },
      },
    };
    expect(input.category).toBe('internet_fixed');
    expect(input.modemRentalCents).toBe(200);
    // 인터넷에는 download_mbps가 attributes에 있어야 자연스러움
    expect(input.attributes['download_mbps']).toBe(150);
  });
});

describe('FetchResult', () => {
  it('한 fetcher = 한 provider의 모든 tariff 배열 (T2 페치 단위)', () => {
    const result: FetchResult = {
      fetcherSlug: 'proximus-be',
      fetchedAt: new Date().toISOString(),
      data: [
        {
          providerSlug: 'proximus-be',
          tariffSlug: 'mobile-essential',
          tariffName: 'Mobile Essential 5 GB',
          category: 'mobile',
          monthlyPriceCents: 1500,
          activationFeeCents: 0,
          modemRentalCents: null,
          promoPriceCents: null,
          promoMonths: null,
          promoDescription: null,
          commitmentMonths: 0,
          earlyTerminationFeeCents: null,
          attributes: { data_gb: 5, voice_minutes: 'unlimited', sms: 'unlimited' },
          sourceUrl: 'https://www.proximus.be/en/mobile-subscription/essential',
          confidence: 'high',
          confidenceReason: null,
          rawPayload: { fetcher_version: 'proximus-be@2026-05-09' },
        },
        {
          providerSlug: 'proximus-be',
          tariffSlug: 'mobile-smart-70',
          tariffName: 'Mobile Smart 70 GB',
          category: 'mobile',
          monthlyPriceCents: 2500,
          activationFeeCents: 0,
          modemRentalCents: null,
          promoPriceCents: 1500,
          promoMonths: 6,
          promoDescription: '6 months discount',
          commitmentMonths: 0,
          earlyTerminationFeeCents: null,
          attributes: { data_gb: 70, voice_minutes: 'unlimited', sms: 'unlimited' },
          sourceUrl: 'https://www.proximus.be/en/mobile-subscription/smart',
          confidence: 'high',
          confidenceReason: null,
          rawPayload: { fetcher_version: 'proximus-be@2026-05-09' },
        },
      ],
    };

    // 한 fetch 호출에 N tariff (Inngest free 무료 티어 보호)
    expect(result.data.length).toBe(2);
    expect(result.data.every((t) => t.providerSlug === 'proximus-be')).toBe(true);
    // ISO 8601 시각 (ADR-0006 fetched_at NOT NULL)
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('빈 배열도 정상 — 페이지에서 모든 요금제가 사라진 케이스', () => {
    const result: FetchResult = {
      fetcherSlug: 'proximus-be',
      fetchedAt: new Date().toISOString(),
      data: [],
    };
    // 1.6 cron이 빈 배열을 받으면 마스터를 isActive=false로 마킹할 수 있음
    // (ADR-0005 §T5 — fetcher가 페이지에서 사라짐 감지)
    expect(result.data.length).toBe(0);
  });
});

describe('FetchOutcome (T4 discriminated union)', () => {
  it('성공 분기 — type narrow로 result 접근 가능', () => {
    const outcome: FetchOutcome = {
      ok: true,
      result: {
        fetcherSlug: 'proximus-be',
        fetchedAt: new Date().toISOString(),
        data: [],
      },
    };

    if (outcome.ok) {
      // outcome.result로 narrow됨 — 컴파일러가 보장
      expect(outcome.result.fetcherSlug).toBe('proximus-be');
    } else {
      // 이 분기에는 도달하지 않아야 함
      expect.fail('ok=true outcome이 false 분기에 도달');
    }
  });

  it('실패 분기 — kind enum으로 Sentry 그룹핑 + 1.9 격리 메커니즘', () => {
    const error: FetchError = {
      fetcherSlug: 'proximus-be',
      fetchedAt: new Date().toISOString(),
      kind: 'parse',
      message: 'selector .price--current returned 0 elements (expected 1)',
      rawPayload: {
        fetcher_version: 'proximus-be@2026-05-09',
        url: 'https://www.proximus.be/en/mobile-subscription/smart',
        warnings: ['html structure changed?'],
      },
    };
    const outcome: FetchOutcome = { ok: false, error };

    if (!outcome.ok) {
      // outcome.error로 narrow — kind enum 4값 중 하나
      expect(['network', 'parse', 'sanity', 'unknown']).toContain(outcome.error.kind);
      // 부분 raw 보존 (P1 사후 분석)
      expect(outcome.error.rawPayload).toBeDefined();
      // 1.9 격리: cron이 logger.error 후 다음 fetcher로 continue
    } else {
      expect.fail('ok=false outcome이 true 분기에 도달');
    }
  });
});

describe('Fetcher 인터페이스', () => {
  it('metadata + fetch() 만 노출 — minimal surface', async () => {
    const mockFetcher: Fetcher = {
      metadata: {
        providerSlug: 'proximus-be',
        displayName: 'Proximus',
        country: 'BE',
        method: 'scraping',
        version: 'proximus-be@2026-05-09-test',
        homepageUrl: 'https://www.proximus.be',
      },
      async fetch() {
        return {
          ok: true,
          result: {
            fetcherSlug: 'proximus-be',
            fetchedAt: new Date().toISOString(),
            data: [
              {
                providerSlug: 'proximus-be',
                tariffSlug: 'mobile-smart-70',
                tariffName: 'Mobile Smart 70 GB',
                category: 'mobile',
                monthlyPriceCents: 2500,
                activationFeeCents: 0,
                modemRentalCents: null,
                promoPriceCents: null,
                promoMonths: null,
                promoDescription: null,
                commitmentMonths: 0,
                earlyTerminationFeeCents: null,
                attributes: { data_gb: 70 },
                sourceUrl: 'https://www.proximus.be/en/mobile-subscription/smart',
                confidence: 'high',
                confidenceReason: null,
                rawPayload: {},
              },
            ],
          },
        };
      },
    };

    expect(mockFetcher.metadata.providerSlug).toBe('proximus-be');
    const outcome = await mockFetcher.fetch();
    expect(outcome.ok).toBe(true);
  });
});
