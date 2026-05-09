/**
 * Proximus 스텁 fetcher 단위 테스트 (PLAN 1.8)
 *
 * 외부 호출 0 — 스텁이므로 실 HTTP fetch가 없다.
 * 테스트 목적: 인터페이스 준수 + P1 정직성(confidence='low') + 1.9 격리 트리거.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { proximus } from './proximus';

// ─── afterEach: 환경변수 정리 ─────────────────────────────────────────────
afterEach(() => {
  // STUB_FAIL_PROXIMUS 테스트가 다른 테스트에 영향 주지 않도록 초기화
  delete process.env['STUB_FAIL_PROXIMUS'];
});

// ─── 1. metadata 모양 검증 ────────────────────────────────────────────────
describe('ProximusFetcher — metadata', () => {
  it('FetcherMetadata 모든 필드 존재 + 올바른 값 (ADR-0008 §T5)', () => {
    const { metadata } = proximus;

    // /data-sources 1.10이 이 필드들을 읽는다
    expect(metadata.providerSlug).toBe('proximus-be');
    expect(metadata.displayName).toBe('Proximus');
    expect(metadata.country).toBe('BE');
    // ADR-0011 §T2 항목 3 Amendment: 스텁 fetcher는 'stub' (1.5.6 실 스크래핑 전환 시 'scraping'으로 변경)
    expect(metadata.method).toBe('stub');
    // version: "proximus-be@YYYY-MM-DD" 형식
    expect(metadata.version).toMatch(/^proximus-be@\d{4}-\d{2}-\d{2}$/);
    // homepageUrl: 실 URL
    expect(metadata.homepageUrl).toBe('https://www.proximus.be');
  });
});

// ─── 2. fetch() 성공 케이스 ───────────────────────────────────────────────
describe('ProximusFetcher — fetch() 성공', () => {
  it('FetchOutcome.ok=true + FetchResult 모양 검증', async () => {
    const outcome = await proximus.fetch();

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      throw new Error('ok=true 기대, false 반환됨');
    }

    const { result } = outcome;
    // fetcherSlug는 metadata.providerSlug와 일치해야 함 (cron 매핑 검증용)
    expect(result.fetcherSlug).toBe('proximus-be');
    // fetchedAt은 ISO 8601 형식 (ADR-0006 fetched_at NOT NULL)
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    // 스텁은 3 mobile + 1 internet = 4개 tariff 반환
    expect(result.data.length).toBeGreaterThanOrEqual(3);
  });

  it('모든 tariff가 올바른 providerSlug를 가진다 (T2 페치 단위)', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    for (const tariff of outcome.result.data) {
      expect(tariff.providerSlug).toBe('proximus-be');
    }
  });

  it('모든 가격이 정수 cents + 양수 (ADR-0005 §T2)', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    for (const tariff of outcome.result.data) {
      expect(Number.isInteger(tariff.monthlyPriceCents)).toBe(true);
      expect(tariff.monthlyPriceCents).toBeGreaterThan(0);
      // 통신 BE 상한 €1,000 (ADR-0008 §T3 sanity)
      expect(tariff.monthlyPriceCents).toBeLessThanOrEqual(100_000);
    }
  });

  it('모든 tariff에 sourceUrl이 실 Proximus URL이다 (P1 정보 우선)', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    for (const tariff of outcome.result.data) {
      // 스텁이라도 sourceUrl은 실 마스터 페이지를 가리켜야 함
      expect(tariff.sourceUrl).toMatch(/^https:\/\/www\.proximus\.be/);
    }
  });
});

// ─── 3. confidence='low' 강제 ─────────────────────────────────────────────
describe('ProximusFetcher — confidence (P1 정직성)', () => {
  it(
    '스텁 fetcher는 모든 tariff의 confidence가 low (ADR-0008 §T3 down-grade override)',
    async () => {
      const outcome = await proximus.fetch();
      if (!outcome.ok) throw new Error('fetch 실패');

      for (const tariff of outcome.result.data) {
        // 스텁은 실 셀렉터 매칭 없음 → 항상 low
        expect(tariff.confidence).toBe('low');
        // confidenceReason에 stub 명시 (P1 — 사용자에게 거짓 신뢰 주지 않음)
        expect(tariff.confidenceReason).toContain('stub fetcher');
      }
    },
  );

  it('rawPayload에 stub=true 명시 (P1 + ADR-0006 §T3)', async () => {
    const outcome = await proximus.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    for (const tariff of outcome.result.data) {
      expect(tariff.rawPayload['stub']).toBe(true);
      expect(tariff.rawPayload['fetcher_version']).toContain('proximus-be');
    }
  });
});

// ─── 4. STUB_FAIL_PROXIMUS=1 → 실패 outcome (1.9 격리 수동 검증용) ────────
describe('ProximusFetcher — STUB_FAIL 환경변수 (1.9 격리)', () => {
  it('STUB_FAIL_PROXIMUS=1 이면 FetchOutcome.ok=false 반환', async () => {
    process.env['STUB_FAIL_PROXIMUS'] = '1';

    const outcome = await proximus.fetch();

    // 1.9 격리: cron은 ok=false 확인 후 logger.error + continue
    expect(outcome.ok).toBe(false);
    if (outcome.ok) {
      throw new Error('ok=false 기대, true 반환됨');
    }

    expect(outcome.error.fetcherSlug).toBe('proximus-be');
    expect(outcome.error.kind).toBe('network');
    expect(outcome.error.message).toContain('STUB_FAIL_PROXIMUS');
    // 실패도 fetchedAt 보존 (P1 사후 분석)
    expect(outcome.error.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
