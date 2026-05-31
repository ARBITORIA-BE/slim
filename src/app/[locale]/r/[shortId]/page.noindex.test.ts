/**
 * /r/[shortId] noindex 회귀 테스트 (PLAN 3.5.4 DoD #4).
 *
 * 왜 이 테스트가 필요한가?
 *   ADR-0021 §T8: 개별 비교 결과는 검색엔진 색인 금지 (PII 파생물 보호).
 *   PLAN 3.5.4 에서 다수 페이지에 hreflang alternates 를 추가했는데,
 *   /r/[shortId] 에 실수로 alternates 가 붙으면 noindex 의미가 희석될 수 있다.
 *   → generateMetadata 가 robots.index=false 를 유지함을 회귀 테스트로 고정.
 *
 * 검증 범위:
 *   1. 유효한 shortId → robots.index = false, robots.follow = true
 *   2. 무효한 shortId (패턴 불일치) → robots.index = false, robots.follow = false
 *   3. generateMetadata 에 alternates.languages 없음 (hreflang 추가 금지)
 */

import { describe, expect, it, vi } from 'vitest';

// ─── next-intl/server mock ──────────────────────────────────────────────────
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockImplementation(
    async ({ namespace }: { namespace: string }) =>
      (key: string) => `${namespace}.${key}`,
  ),
  setRequestLocale: vi.fn(),
}));

// ─── DB 쿼리 mock ────────────────────────────────────────────────────────────
// generateMetadata 는 DB 를 호출하지 않음 — 하지만 import 체인에서 db 모듈이
// 로드되므로 mock 으로 격리.
vi.mock('@/db', () => ({ db: {} }));
vi.mock('@/db/queries/comparison', () => ({
  getResultByShortId: vi.fn(),
  getResultItems: vi.fn(),
  getTopResultItem: vi.fn(),
}));
vi.mock('@/db/queries/providers', () => ({
  getExcludedProviders: vi.fn(),
}));
vi.mock('@/engine/usage-estimator', () => ({
  USAGE_ESTIMATOR_VERSION: '1.0.0',
  deriveUsageProfile: vi.fn(),
}));

// generateMetadata 를 import (page.tsx default export 는 미사용)
import { generateMetadata } from './page';

// ─── 유효한 shortId 픽스처 (nanoid 12자 URL-safe) ──────────────────────────
const VALID_SHORT_ID = 'abc123XYZ_-9'; // 12자, URL-safe alphabet

describe('/r/[shortId] generateMetadata — noindex 회귀', () => {
  it('유효한 shortId → robots.index = false', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ locale: 'nl-BE', shortId: VALID_SHORT_ID }),
    });
    expect(meta.robots).toMatchObject({ index: false });
  });

  it('유효한 shortId → robots.follow = true (ADR-0021 §T8 — follow 허용)', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ locale: 'nl-BE', shortId: VALID_SHORT_ID }),
    });
    expect(meta.robots).toMatchObject({ follow: true });
  });

  it('무효한 shortId (11자) → robots.index = false', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ locale: 'nl-BE', shortId: 'short11chr' }),
    });
    expect(meta.robots).toMatchObject({ index: false });
  });

  it('무효한 shortId (특수문자 포함) → robots.index = false, follow = false', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ locale: 'nl-BE', shortId: 'abc!@#def123' }),
    });
    // 패턴 불일치 → 두 번째 분기 (index: false, follow: false)
    expect(meta.robots).toMatchObject({ index: false, follow: false });
  });

  it('alternates.languages 없음 — hreflang 추가 금지 (ADR-0021 §T8 + PLAN 3.5.4)', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ locale: 'nl-BE', shortId: VALID_SHORT_ID }),
    });
    // alternates 가 있다면 languages 키가 없어야 함 (hreflang 미포함)
    expect(meta.alternates?.languages).toBeUndefined();
  });
});
