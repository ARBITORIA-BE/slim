/**
 * /data-sources — 투명성 페이지 (PLAN 1.10)
 *
 * 왜 이 페이지가 필요한가?
 *   헌법 §3 P3: "투명성은 운영자의 짐. 데이터로 보여준다."
 *   비교에서 제외된 공급사도 이름을 밝힌다.
 *   ADR-0011 §T2가 표시 항목 6개를 못 박는다.
 *
 * RSC (React Server Component) 이유:
 *   DB 쿼리를 클라이언트로 노출하지 않는다. ISR revalidate=3600 (ADR-0011 §T6).
 *   fetcher cron이 일 1회 06:00 UTC (ADR-0008 §T6) → 1시간 ISR이 충분.
 *
 * 표시 항목 6개 (ADR-0011 §T2):
 *   1. 공급사 이름 + 국가 + 슬러그
 *   2. 마지막 fetch 시각 (tariff_snapshot.fetched_at 최댓값)
 *   3. fetch 방법 (FetcherMetadata.method)
 *   4. 어필리에이트 가능 여부 + "순위 무영향" 텍스트
 *   5. 비교 사용 횟수 ("0회 — 런칭 초기 (2026년 5월~)" 부가 텍스트)
 *   6. 카테고리별 caveats 미리보기 (deriveCaveats 고정 입력 호출)
 *
 * 제외 공급사 섹션 (헌법 P3 + ADR-0009 §결정 4):
 *   Orange BE — "페이즈 5에서 평가 후 추가 예정"
 *
 * 새 의존성 추가 X (GATE-C 통과).
 * 다크 패턴 0 (헌법 §8 #3).
 *
 * 결정 근거: docs/adr/0011-data-sources-page-and-caveats-boundary.md
 */

import type { Metadata } from 'next';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { provider } from '@/db/schema/provider';
import { tariff } from '@/db/schema/tariff';
import { tariffSnapshot } from '@/db/schema/tariff_snapshot';
import { registry } from '@/fetchers/index';
import { getComparisonStatsByProvider } from '@/engine/comparison-stats';
import { deriveCaveats } from '@/engine/caveats';
import type { AffiliateStatus } from '@/db/schema/provider';
import type { FetcherMetadata } from '@/fetchers/types';

export const metadata: Metadata = {
  title: '데이터 출처',
  description:
    'Slim이 사용하는 통신 요금 비교 데이터의 출처, 수집 방법, 갱신 주기를 투명하게 공개합니다.',
  alternates: {
    canonical: '/data-sources',
  },
};

// ─── ISR 설정 ─────────────────────────────────────────────────────────────

/**
 * 왜 1시간 ISR인가?
 *   fetcher cron이 일 1회 06:00 UTC (ADR-0008 §T6)이므로 1시간 캐시는 충분.
 *   신선도보다 빌드 비용을 아끼는 선택 (솔로 사이드 월 €300 cap, FOUNDER.md).
 */
export const revalidate = 3600;

// ─── 데이터 패치 함수들 ────────────────────────────────────────────────────

/**
 * DB에서 공급사별 마지막 fetch 시각을 가져온다.
 *
 * 왜 tariff_snapshot.fetched_at의 최댓값을 쓰는가?
 *   한 공급사에 여러 tariff, 각 tariff에 여러 snapshot이 있다.
 *   "가장 최근에 수집된 데이터가 언제인가"를 보여주는 것이 사용자 입장에서 의미 있다.
 *   ADR-0011 §T2 항목 2: DISTINCT ON (tariff_id, fetched_at DESC) 후 max(fetched_at) per provider.
 */
async function getLastFetchedAtByProvider(): Promise<Map<string, Date>> {
  // 왜 3단 join인가?
  //   tariff_snapshot → tariff → provider 경로가 유일한 연결 경로 (ADR-0007 §T6 참조).
  const rows = await db
    .select({
      providerSlug: provider.slug,
      // sql<string>: max()는 timestamptz를 ISO string으로 반환한다 (Neon HTTP 드라이버).
      lastFetchedAt: sql<string>`max(${tariffSnapshot.fetchedAt})`,
    })
    .from(tariffSnapshot)
    .innerJoin(tariff, eq(tariff.id, tariffSnapshot.tariffId))
    .innerJoin(provider, eq(provider.id, tariff.providerId))
    .groupBy(provider.slug);

  const resultMap = new Map<string, Date>();
  for (const row of rows) {
    if (row.lastFetchedAt) {
      resultMap.set(row.providerSlug, new Date(row.lastFetchedAt));
    }
  }
  return resultMap;
}

/**
 * DB에서 provider 레코드를 모두 가져온다.
 *
 * 왜 전체를 가져오는가?
 *   - 비교 가능 공급사 (excludedReason IS NULL): 메인 표에 표시
 *   - 제외 공급사 (excludedReason IS NOT NULL): 제외 공급사 섹션에 표시
 *   헌법 P3: 제외된 공급사도 이름을 밝힌다 → 필터 없이 전체 로드.
 */
async function getAllProviders() {
  return await db
    .select({
      id: provider.id,
      name: provider.name,
      slug: provider.slug,
      country: provider.country,
      website: provider.website,
      affiliateStatus: provider.affiliateStatus,
      excludedReason: provider.excludedReason,
    })
    .from(provider);
}

// ─── 표시 helper ──────────────────────────────────────────────────────────

/**
 * fetch method → 한국어 사용자 친화 라벨.
 *
 * 왜 별도 함수인가?
 *   ADR-0011 §T2 항목 3 테이블이 정의한 4개 라벨을 단일 출처로 관리.
 *   페이즈 2 i18n 도입 시 이 함수만 교체.
 */
function formatMethod(method: FetcherMetadata['method']): string {
  switch (method) {
    case 'api':
      return '공식 API';
    case 'scraping':
      return '셀렉터 스크래핑';
    case 'manual':
      return '수동 입력';
    case 'stub':
      return '스텁 (개발 중)';
  }
}

/**
 * affiliate_status → 한국어 사용자 친화 라벨.
 *
 * 왜 별도 함수인가?
 *   ADR-0011 §T2 항목 4가 정의한 6개 라벨의 단일 출처.
 *   ADR-0001 enum 6값과 1:1 매핑.
 */
function formatAffiliateStatus(status: AffiliateStatus): string {
  switch (status) {
    case 'none':
      return '어필리에이트 없음';
    case 'pending':
      return '협상 중';
    case 'active_b2b_intra_eu':
      return '어필리에이트 활성';
    case 'active_b2b_domestic_be':
      return '어필리에이트 활성';
    case 'paused':
      return '일시 중단';
    case 'terminated':
      return '종료';
  }
}

/**
 * Date → 한국어 상대 시간 문자열 (예: "23시간 전").
 *
 * 왜 date-fns/dayjs를 쓰지 않는가?
 *   ADR-0011 §T4 #5: 새 의존성 추가 X (GATE-C). Intl.RelativeTimeFormat으로 충분.
 *   헌법 §3 P3: "23시간 전 기준"류 표시의 단일 출처.
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const rtf = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });

  if (diffMinutes < 60) {
    return rtf.format(-diffMinutes, 'minute');
  } else if (diffHours < 24) {
    return rtf.format(-diffHours, 'hour');
  } else {
    return rtf.format(-diffDays, 'day');
  }
}

// ─── caveats 미리보기 (ADR-0011 §T2 항목 6, 옵션 B — page.tsx 인라인) ────

/**
 * 카테고리별 대표 caveats 텍스트 미리보기를 생성한다.
 *
 * 왜 고정 입력인가?
 *   페이즈 1 시점 실 비교 결과가 없다 → deriveCaveats()를 대표 시나리오 입력으로
 *   호출해 "이런 주의사항이 붙을 수 있다"를 미리 보여준다 (ADR-0011 §T2 항목 6).
 *   페이즈 4 베타 시작 후 실 최빈 caveats로 교체 검토 (별도 작업, 본 파일 외부).
 *
 * 입력 시나리오:
 *   - mobile: 평균 커플 (PLAN 1.12 케이스 1) — 약정 없는 Proximus Smart 70GB
 *   - internet_fixed: VDSL→케이블 (PLAN 1.12 케이스 4) — Telenet 12개월 약정
 *   - bundle_internet_tv: Telenet ONE up 24개월 번들
 *   - landline: 활성화 비용 있는 기본 케이스
 *
 * 왜 TariffSnapshotLike 의 id/providerSlug/isAnomaly를 포함하는가?
 *   deriveCaveats()는 TariffSnapshotLike를 받는다. 이 필드들은 caveats 생성에
 *   사용되지 않지만 타입 계약을 충족해야 한다. 고정 더미값으로 채운다.
 */
function getCaveatsPreview(): Record<string, string[]> {
  // 모바일 대표 시나리오: Proximus Smart 70GB (약정 없음, 6개월 프로모)
  const mobileCaveats = deriveCaveats({
    candidate: {
      id: 'preview-proximus-mobile-smart-70',
      providerSlug: 'proximus-be',
      tariffSlug: 'proximus-mobile-smart-70',
      category: 'mobile',
      monthlyPriceCents: 2500,
      activationFeeCents: 0,
      modemRentalCents: null,
      promoPriceCents: 1500,
      promoMonths: 6,
      commitmentMonths: 0,
      earlyTerminationFeeCents: null,
      confidence: 'low',
      confidenceReason: 'stub fetcher',
      isAnomaly: false,
      attributes: {
        data_gb: 70,
        voice_minutes: 'unlimited',
        eu_roaming_included: true,
      },
    },
    currentTariff: null,
    usageProfile: {
      data_gb_used: 15,
      voice_minutes_used: 200,
      streaming_4k: false,
    },
  });

  // 인터넷 대표 시나리오: Telenet Essential Internet (12개월 약정, 프로모 없음)
  const internetCaveats = deriveCaveats({
    candidate: {
      id: 'preview-telenet-internet-essential',
      providerSlug: 'telenet-be',
      tariffSlug: 'telenet-internet-essential',
      category: 'internet_fixed',
      monthlyPriceCents: 4900,
      activationFeeCents: 0,
      modemRentalCents: 0,
      promoPriceCents: null,
      promoMonths: null,
      commitmentMonths: 12,
      earlyTerminationFeeCents: 5000,
      confidence: 'low',
      confidenceReason: 'stub fetcher',
      isAnomaly: false,
      attributes: {
        download_mbps: 150,
        upload_mbps: 15,
        unlimited_data: true,
      },
    },
    currentTariff: null,
    usageProfile: {
      streaming_4k: false,
    },
  });

  // 번들 대표 시나리오: Telenet ONE up (24개월 약정)
  const bundleCaveats = deriveCaveats({
    candidate: {
      id: 'preview-telenet-one-up-bundle',
      providerSlug: 'telenet-be',
      tariffSlug: 'telenet-one-up-bundle',
      category: 'bundle_internet_tv',
      monthlyPriceCents: 8000,
      activationFeeCents: 0,
      modemRentalCents: 0,
      promoPriceCents: null,
      promoMonths: null,
      commitmentMonths: 24,
      earlyTerminationFeeCents: 12000,
      confidence: 'low',
      confidenceReason: 'stub fetcher',
      isAnomaly: false,
      attributes: {
        download_mbps: 400,
        tv_channels: 100,
        tv_4k_included: true,
      },
    },
    currentTariff: null,
    usageProfile: {
      streaming_4k: true,
    },
  });

  // 유선전화 대표 시나리오: 활성화 비용 있는 기본 케이스
  const landlineCaveats = deriveCaveats({
    candidate: {
      id: 'preview-example-landline',
      providerSlug: 'example-be',
      tariffSlug: 'example-landline',
      category: 'landline',
      monthlyPriceCents: 1500,
      activationFeeCents: 1000,
      modemRentalCents: null,
      promoPriceCents: null,
      promoMonths: null,
      commitmentMonths: 0,
      earlyTerminationFeeCents: null,
      confidence: 'low',
      confidenceReason: 'stub fetcher',
      isAnomaly: false,
      attributes: {},
    },
    currentTariff: null,
    usageProfile: {},
  });

  return {
    mobile: mobileCaveats.slice(0, 5), // ADR-0011: 5건 미만
    internet_fixed: internetCaveats.slice(0, 5),
    bundle_internet_tv: bundleCaveats.slice(0, 5),
    landline: landlineCaveats.slice(0, 5),
  };
}

// ─── 카테고리 한국어 라벨 ────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  mobile: '모바일',
  internet_fixed: '고정 인터넷',
  bundle_internet_tv: '인터넷+TV 번들',
  landline: '유선전화',
};

// ─── 페이지 컴포넌트 ──────────────────────────────────────────────────────

/**
 * /data-sources 페이지 — 투명성 단일 진입점.
 *
 * 왜 async 서버 컴포넌트인가?
 *   DB 쿼리(provider, tariff_snapshot), 비교 통계(getComparisonStatsByProvider),
 *   registry 메타데이터를 서버에서 합성해 정적 HTML로 클라이언트에 전달한다.
 *   JS 번들 크기 0 추가 (클라이언트 상태 없음).
 */
export default async function DataSourcesPage() {
  // ─── 데이터 병렬 페치 ────────────────────────────────────────────────────
  // 왜 Promise.all인가?
  //   세 DB 쿼리 + 통계 쿼리가 독립적 → 병렬 실행으로 응답 시간 단축.
  //   (솔로 사이드 Neon free tier: 병렬 쿼리가 순차 대비 약 2-3배 빠름)
  const [providers, lastFetchedAtMap, comparisonStatsMap] = await Promise.all([
    getAllProviders(),
    getLastFetchedAtByProvider(),
    getComparisonStatsByProvider(),
  ]);

  // registry에서 slug → FetcherMetadata 매핑 생성
  const fetcherMetaMap = new Map(
    registry.map((f) => [f.metadata.providerSlug, f.metadata]),
  );

  // 비교 가능 공급사 / 제외 공급사 분리
  const comparableProviders = providers.filter((p) => !p.excludedReason);
  const excludedProviders = providers.filter((p) => !!p.excludedReason);

  // caveats 미리보기 (고정 입력 — ADR-0011 §T2 항목 6)
  const caveatsPreview = getCaveatsPreview();

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* ─── 페이지 헤더 ────────────────────────────────────────────────── */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold mb-2">데이터 출처</h1>
        <p className="text-sm text-gray-600 mb-1">
          Slim이 사용하는 비교 데이터의 출처와 수집 방법을 투명하게 공개합니다.
        </p>
        {/* ADR-0011 §T2 항목 5 운영자 명시 — 베타 전 0 카운트 안내 */}
        <p className="text-sm text-gray-500 italic">
          비교 데이터는 베타 (페이즈 4) 시작 후 누적됩니다.
        </p>
      </header>

      {/* ─── 어필리에이트 순위 무영향 공지 (ADR-0011 §T2 항목 4) ─────────── */}
      <div
        className="border border-gray-200 rounded p-4 mb-6 text-sm text-gray-700"
        role="note"
        aria-label="어필리에이트 정책 공지"
      >
        어필리에이트 여부는 결과 순위에 영향을 주지 않습니다 — 알고리즘은 절약액
        순입니다. 자세한 내용은{' '}
        <a
          href="/legal/affiliate-disclosure"
          className="underline hover:text-gray-900"
        >
          /legal/affiliate-disclosure
        </a>{' '}
        (페이즈 6.9에서 정식 공개 예정)에서 확인하실 수 있습니다.
      </div>

      {/* ─── 비교 가능 공급사 표 ─────────────────────────────────────────── */}
      <section aria-labelledby="providers-heading" className="mb-10">
        <h2 id="providers-heading" className="text-lg font-semibold mb-3">
          비교 대상 공급사
        </h2>

        {comparableProviders.length === 0 ? (
          <p className="text-sm text-gray-500">
            등록된 공급사가 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" aria-label="비교 대상 공급사 목록">
              <thead>
                <tr className="border-b border-gray-300 text-left">
                  <th scope="col" className="py-2 pr-4 font-medium">공급사</th>
                  <th scope="col" className="py-2 pr-4 font-medium">국가</th>
                  <th scope="col" className="py-2 pr-4 font-medium">마지막 수집</th>
                  <th scope="col" className="py-2 pr-4 font-medium">수집 방법</th>
                  <th scope="col" className="py-2 pr-4 font-medium">어필리에이트</th>
                  <th scope="col" className="py-2 font-medium">비교 사용 횟수</th>
                </tr>
              </thead>
              <tbody>
                {comparableProviders.map((p) => {
                  const meta = fetcherMetaMap.get(p.slug);
                  const lastFetchedAt = lastFetchedAtMap.get(p.slug);
                  // 왜 ?? 0 인가?
                  //   페이즈 1 시점 DB에 comparison_result_item이 없으므로
                  //   Map에 slug가 없다 → undefined → 0 으로 처리 (ADR-0011 §T2 항목 5).
                  const comparisonCount = comparisonStatsMap.get(p.slug) ?? 0;

                  return (
                    <tr
                      key={p.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      {/* 항목 1: 공급사 이름 + 슬러그 */}
                      <td className="py-2 pr-4">
                        <a
                          href={p.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium underline hover:text-gray-600"
                          aria-label={`${p.name} 공식 사이트 (새 탭에서 열림)`}
                        >
                          {p.name}
                        </a>
                        <span className="text-gray-400 text-xs ml-1 font-mono">
                          {p.slug}
                        </span>
                      </td>

                      {/* 항목 1: 국가 배지 */}
                      <td className="py-2 pr-4">
                        <span
                          className="inline-block bg-gray-100 text-gray-700 text-xs px-1.5 py-0.5 rounded font-mono"
                          title="운영 국가"
                        >
                          {p.country}
                        </span>
                      </td>

                      {/* 항목 2: 마지막 fetch 시각 */}
                      <td className="py-2 pr-4 text-gray-600">
                        {lastFetchedAt ? (
                          <time
                            dateTime={lastFetchedAt.toISOString()}
                            title={lastFetchedAt.toLocaleString('ko-KR')}
                          >
                            {formatRelativeTime(lastFetchedAt)}
                          </time>
                        ) : (
                          <span className="text-gray-400">아직 없음</span>
                        )}
                      </td>

                      {/* 항목 3: fetch 방법 */}
                      <td className="py-2 pr-4 text-gray-600">
                        {meta ? (
                          formatMethod(meta.method)
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* 항목 4: 어필리에이트 가능 여부 */}
                      <td className="py-2 pr-4 text-gray-600">
                        {formatAffiliateStatus(p.affiliateStatus)}
                      </td>

                      {/* 항목 5: 비교 사용 횟수 (운영자 GATE-A 명시) */}
                      <td className="py-2 text-gray-600">
                        {comparisonCount === 0 ? (
                          // ADR-0011 §Status: "0회 — 런칭 초기 (2026년 5월~)" 형식
                          <span>0회 — 런칭 초기 (2026년 5월~)</span>
                        ) : (
                          // 페이즈 4 베타 시작 후 자동으로 이쪽으로 분기
                          <span>최근 30일 {comparisonCount}회</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── 항목 6: caveats 미리보기 (ADR-0011 §T2 항목 6) ─────────────── */}
      <section aria-labelledby="caveats-heading" className="mb-10">
        <h2 id="caveats-heading" className="text-lg font-semibold mb-3">
          비교 결과 주의사항 예시
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          비교 결과에 자동으로 붙는 주의사항의 예시입니다. 실제 결과는 공급사와
          요금제에 따라 달라집니다.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(
            [
              'mobile',
              'internet_fixed',
              'bundle_internet_tv',
              'landline',
            ] as const
          ).map((cat) => {
            const preview = caveatsPreview[cat] ?? [];
            const label = CATEGORY_LABELS[cat] ?? cat;
            return (
              <div
                key={cat}
                className="border border-gray-200 rounded p-3"
                aria-labelledby={`caveats-${cat}-heading`}
              >
                <h3
                  id={`caveats-${cat}-heading`}
                  className="text-sm font-medium mb-2"
                >
                  {label}
                </h3>
                {preview.length === 0 ? (
                  <p className="text-xs text-gray-400">주의사항 없음</p>
                ) : (
                  <ul className="text-xs text-gray-600 space-y-1" role="list">
                    {preview.map((caveat, idx) => (
                      <li key={idx} className="flex items-start gap-1">
                        <span aria-hidden="true" className="text-gray-400 mt-0.5">•</span>
                        <span>{caveat}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── 제외 공급사 섹션 (헌법 P3 + ADR-0009 §결정 4) ──────────────── */}
      <section aria-labelledby="excluded-heading" className="mb-8">
        <h2 id="excluded-heading" className="text-lg font-semibold mb-3">
          비교 제외 공급사
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          아래 공급사는 현재 비교 대상에 포함되지 않습니다.
          사유를 투명하게 공개합니다 (헌법 §3 P3).
        </p>

        {/* DB에 등록된 제외 공급사 */}
        {excludedProviders.length > 0 && (
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse" aria-label="제외된 공급사 목록">
              <thead>
                <tr className="border-b border-gray-300 text-left">
                  <th scope="col" className="py-2 pr-4 font-medium">공급사</th>
                  <th scope="col" className="py-2 pr-4 font-medium">국가</th>
                  <th scope="col" className="py-2 font-medium">제외 사유</th>
                </tr>
              </thead>
              <tbody>
                {excludedProviders.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-2 pr-4 font-medium">{p.name}</td>
                    <td className="py-2 pr-4">
                      <span className="inline-block bg-gray-100 text-gray-700 text-xs px-1.5 py-0.5 rounded font-mono">
                        {p.country}
                      </span>
                    </td>
                    <td className="py-2 text-gray-600">{p.excludedReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Orange BE — ADR-0009 §결정 4 명시 항목 (DB 미등록이어도 고정 표시) */}
        {/* 왜 별도로 표시하는가?
            ADR-0009 §결정 4: /data-sources에 Orange BE CTA를 노출해 베타 사용자 신호 수집.
            click ≥ 20% 시 페이즈 5 우선 추가 결정에 활용 (ADR-0009 §검증 2).
            DB에 Orange BE가 없어도 이 섹션은 항상 표시된다. */}
        {!excludedProviders.some((p) => p.slug === 'orange-be') && (
          <div className="border border-gray-200 rounded p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-sm">Orange BE</p>
                <p className="text-xs text-gray-500 mt-0.5">BE</p>
                <p className="text-sm text-gray-600 mt-1">
                  페이즈 5에서 평가 후 추가 예정 (ADR-0009).
                </p>
              </div>
              {/* ADR-0009 §검증 2 CTA — click event는 페이즈 4 PostHog에서 측정 */}
              <a
                href="mailto:kim.wonmin91@gmail.com?subject=Orange%20BE%20비교%20요청"
                className="shrink-0 text-xs border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 transition-colors"
                aria-label="Orange BE 비교 요청 보내기"
                data-event="orange-be-cta-click"
              >
                Orange BE 비교 요청
              </a>
            </div>
          </div>
        )}
      </section>

      {/* ─── 페이지 푸터 ─────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-200 pt-4 text-xs text-gray-400">
        <p>
          데이터 수집 방법 · 공급사 추가 요청 · 오류 신고:{' '}
          <a
            href="mailto:kim.wonmin91@gmail.com"
            className="underline hover:text-gray-600"
          >
            kim.wonmin91@gmail.com
          </a>
        </p>
        <p className="mt-1">
          수집 주기: 일 1회 06:00 UTC (ADR-0008 §T6). ISR 캐시: 1시간.
        </p>
      </footer>
    </main>
  );
}
