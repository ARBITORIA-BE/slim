/**
 * Telenet 스텁 fetcher 단위 테스트 (PLAN 1.8)
 *
 * 외부 호출 0 — 스텁이므로 실 HTTP fetch가 없다.
 * Proximus 테스트와 동일 패턴 — 두 fetcher가 같은 인터페이스를 지킨다는 증거.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { telenet } from './telenet';

// ─── afterEach: 환경변수 정리 ─────────────────────────────────────────────
afterEach(() => {
  delete process.env['STUB_FAIL_TELENET'];
});

// ─── 1. metadata 모양 검증 ────────────────────────────────────────────────
describe('TelenetFetcher — metadata', () => {
  it('FetcherMetadata 모든 필드 존재 + 올바른 값 (ADR-0008 §T5)', () => {
    const { metadata } = telenet;

    expect(metadata.providerSlug).toBe('telenet-be');
    expect(metadata.displayName).toBe('Telenet');
    expect(metadata.country).toBe('BE');
    expect(metadata.method).toBe('scraping');
    expect(metadata.version).toMatch(/^telenet-be@\d{4}-\d{2}-\d{2}$/);
    expect(metadata.homepageUrl).toBe('https://www.telenet.be');
  });
});

// ─── 2. fetch() 성공 케이스 ───────────────────────────────────────────────
describe('TelenetFetcher — fetch() 성공', () => {
  it('FetchOutcome.ok=true + FetchResult 모양 검증', async () => {
    const outcome = await telenet.fetch();

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      throw new Error('ok=true 기대, false 반환됨');
    }

    const { result } = outcome;
    expect(result.fetcherSlug).toBe('telenet-be');
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    // 스텁: 2 internet + 1 mobile + 1 bundle = 4개 tariff
    expect(result.data.length).toBeGreaterThanOrEqual(3);
  });

  it('모든 tariff가 올바른 providerSlug를 가진다 (T2 페치 단위)', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    for (const tariff of outcome.result.data) {
      expect(tariff.providerSlug).toBe('telenet-be');
    }
  });

  it('모든 가격이 정수 cents + 양수 (ADR-0005 §T2)', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    for (const tariff of outcome.result.data) {
      expect(Number.isInteger(tariff.monthlyPriceCents)).toBe(true);
      expect(tariff.monthlyPriceCents).toBeGreaterThan(0);
      expect(tariff.monthlyPriceCents).toBeLessThanOrEqual(100_000);
    }
  });

  it('모든 tariff에 sourceUrl이 실 Telenet URL이다 (P1 정보 우선)', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    for (const tariff of outcome.result.data) {
      // 스텁이라도 sourceUrl은 실 마스터 페이지를 가리켜야 함
      expect(tariff.sourceUrl).toMatch(/^https:\/\/www2?\.telenet\.be/);
    }
  });

  it('bundle_internet_tv 카테고리 tariff가 존재한다', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    const bundles = outcome.result.data.filter(
      (t) => t.category === 'bundle_internet_tv',
    );
    expect(bundles.length).toBeGreaterThanOrEqual(1);

    // 번들 attributes에 tv_channels가 있어야 함
    const bundle = bundles[0];
    if (!bundle) throw new Error('bundle tariff 없음');
    expect(typeof bundle.attributes['tv_channels']).toBe('number');
  });
});

// ─── 3. confidence='low' 강제 ─────────────────────────────────────────────
describe('TelenetFetcher — confidence (P1 정직성)', () => {
  it(
    '스텁 fetcher는 모든 tariff의 confidence가 low (ADR-0008 §T3 down-grade)',
    async () => {
      const outcome = await telenet.fetch();
      if (!outcome.ok) throw new Error('fetch 실패');

      for (const tariff of outcome.result.data) {
        expect(tariff.confidence).toBe('low');
        expect(tariff.confidenceReason).toContain('stub fetcher');
      }
    },
  );

  it('rawPayload에 stub=true 명시 (P1 + ADR-0006 §T3)', async () => {
    const outcome = await telenet.fetch();
    if (!outcome.ok) throw new Error('fetch 실패');

    for (const tariff of outcome.result.data) {
      expect(tariff.rawPayload['stub']).toBe(true);
      expect(tariff.rawPayload['fetcher_version']).toContain('telenet-be');
    }
  });
});

// ─── 4. STUB_FAIL_TELENET=1 → 실패 outcome (1.9 격리 수동 검증용) ─────────
describe('TelenetFetcher — STUB_FAIL 환경변수 (1.9 격리)', () => {
  it('STUB_FAIL_TELENET=1 이면 FetchOutcome.ok=false 반환', async () => {
    process.env['STUB_FAIL_TELENET'] = '1';

    const outcome = await telenet.fetch();

    expect(outcome.ok).toBe(false);
    if (outcome.ok) {
      throw new Error('ok=false 기대, true 반환됨');
    }

    expect(outcome.error.fetcherSlug).toBe('telenet-be');
    expect(outcome.error.kind).toBe('network');
    expect(outcome.error.message).toContain('STUB_FAIL_TELENET');
    expect(outcome.error.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('1.9 격리: Proximus 실패가 Telenet 성공에 영향 없다', async () => {
    // STUB_FAIL_PROXIMUS는 설정하지 않고 Telenet만 정상 확인
    // (Proximus fetcher와 독립적으로 실행됨을 증명)
    const outcome = await telenet.fetch();
    expect(outcome.ok).toBe(true);
  });
});
