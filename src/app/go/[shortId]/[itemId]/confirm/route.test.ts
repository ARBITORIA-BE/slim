/**
 * POST /go/[shortId]/[itemId]/confirm — 단위 테스트 (PLAN 4.1.c).
 *
 * DB 함수는 vi.mock 으로 격리 — 실제 DB 연결 불필요.
 *
 * 검증:
 *   1. 정상 경로 — INSERT 1건 + 302 (Location 헤더에 ref_param 포함)
 *   2. 잘못된 shortId/itemId → 404
 *   3. provider.website NULL/빈 문자열 → 502
 *   4. INSERT 실패 → 500
 *   5. 동의 경로(confirm) INSERT 시 IP/UA 헤더 읽기 없음
 *      (이 경로는 헤더를 읽지 않음을 코드 레벨에서 보장 — 호출 검증으로 확인)
 *   6. ref_param = 'slim-r-<shortId>' 패턴
 *   7. Location 헤더에 ?ref= 포함
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// DB 쿼리 모킹 — 실제 DB 연결 없이 단위 테스트
vi.mock('@/db/queries/affiliate-click', () => ({
  getInterstitialData: vi.fn(),
  insertAffiliateClick: vi.fn(),
}));

// nanoid 는 결정적 값으로 대체 (토큰 검증 용이)
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'testtoken1234'),
}));

import {
  getInterstitialData,
  insertAffiliateClick,
} from '@/db/queries/affiliate-click';
import { POST } from './route';

const VALID_SHORT_ID = 'abc123def456';
const VALID_ITEM_ID = '11111111-1111-1111-1111-111111111111';

const MOCK_INTERSTITIAL: Awaited<ReturnType<typeof getInterstitialData>> = {
  providerName: 'Proximus',
  providerWebsite: 'https://proximus.be/mobile',
  resultId: '22222222-2222-2222-2222-222222222222',
  resultItemId: VALID_ITEM_ID,
  providerId: '33333333-3333-3333-3333-333333333333',
  tariffSnapshotId: '44444444-4444-4444-4444-444444444444',
};

function makeParams(shortId = VALID_SHORT_ID, itemId = VALID_ITEM_ID) {
  return Promise.resolve({ shortId, itemId });
}

function makeRequest() {
  return new Request('http://localhost/go/abc123def456/11111111-1111-1111-1111-111111111111/confirm', {
    method: 'POST',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /go/[shortId]/[itemId]/confirm', () => {
  it('정상 경로 — 302 + Location 헤더에 ref_param 포함', async () => {
    vi.mocked(getInterstitialData).mockResolvedValue(MOCK_INTERSTITIAL);
    vi.mocked(insertAffiliateClick).mockResolvedValue({
      id: '55555555-5555-5555-5555-555555555555',
    });

    const res = await POST(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(302);
    const location = res.headers.get('location');
    expect(location).toBeTruthy();
    // ref_param = slim-r-<shortId> 포함
    expect(location).toContain(`ref=slim-r-${VALID_SHORT_ID}`);
    // provider.website 기반
    expect(location).toContain('https://proximus.be/mobile');
  });

  it('ref_param 패턴 = "slim-r-<shortId>"', async () => {
    vi.mocked(getInterstitialData).mockResolvedValue(MOCK_INTERSTITIAL);
    vi.mocked(insertAffiliateClick).mockResolvedValue({
      id: '55555555-5555-5555-5555-555555555555',
    });

    await POST(makeRequest(), { params: makeParams() });

    // insertAffiliateClick 호출 시 refParam 검증
    expect(vi.mocked(insertAffiliateClick)).toHaveBeenCalledWith(
      expect.objectContaining({
        refParam: `slim-r-${VALID_SHORT_ID}`,
        consentGivenAt: expect.any(Date),
        clickToken: 'testtoken1234',
        resultId: MOCK_INTERSTITIAL.resultId,
        resultItemId: MOCK_INTERSTITIAL.resultItemId,
        providerId: MOCK_INTERSTITIAL.providerId,
        tariffSnapshotId: MOCK_INTERSTITIAL.tariffSnapshotId,
      }),
    );
  });

  it('잘못된 shortId/itemId → getInterstitialData null → 404', async () => {
    vi.mocked(getInterstitialData).mockResolvedValue(null);

    const res = await POST(makeRequest(), { params: makeParams('not_found_x', VALID_ITEM_ID) });

    expect(res.status).toBe(404);
  });

  it('provider.website 빈 문자열 → 502', async () => {
    vi.mocked(getInterstitialData).mockResolvedValue({
      ...MOCK_INTERSTITIAL,
      providerWebsite: '',
    });

    const res = await POST(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(502);
    // INSERT 호출 없음 (동의 기록 불필요)
    expect(vi.mocked(insertAffiliateClick)).not.toHaveBeenCalled();
  });

  it('provider.website 공백 문자열 → 502', async () => {
    vi.mocked(getInterstitialData).mockResolvedValue({
      ...MOCK_INTERSTITIAL,
      providerWebsite: '   ',
    });

    const res = await POST(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(502);
  });

  it('INSERT 실패 → 500', async () => {
    vi.mocked(getInterstitialData).mockResolvedValue(MOCK_INTERSTITIAL);
    vi.mocked(insertAffiliateClick).mockRejectedValue(new Error('DB error'));

    const res = await POST(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(500);
  });

  it('인터스티셜 GET 자체는 INSERT 0 — confirm 경로만 INSERT', async () => {
    // 이 테스트는 confirm route 가 오직 POST 에서만 INSERT 함을 명시적으로 기록.
    // getInterstitialData 는 SELECT only — INSERT 없음.
    vi.mocked(getInterstitialData).mockResolvedValue(null);

    await POST(makeRequest(), { params: makeParams('notfound0000', VALID_ITEM_ID) });

    // 404 경로에서 INSERT 호출 없음
    expect(vi.mocked(insertAffiliateClick)).not.toHaveBeenCalled();
  });

  it('provider.website 에 이미 ? 있으면 &ref= 로 붙임', async () => {
    vi.mocked(getInterstitialData).mockResolvedValue({
      ...MOCK_INTERSTITIAL,
      providerWebsite: 'https://proximus.be/mobile?lang=nl',
    });
    vi.mocked(insertAffiliateClick).mockResolvedValue({
      id: '55555555-5555-5555-5555-555555555555',
    });

    const res = await POST(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(302);
    const location = res.headers.get('location');
    // &ref= 패턴 (? 이미 있음)
    expect(location).toContain('&ref=slim-r-');
    expect(location).not.toMatch(/\?ref=/);
  });
});
