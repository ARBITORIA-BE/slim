/**
 * /r/[shortId] — 영구 비교 결과 링크 (PLAN 3.1 + 3.6, ADR-0021 §T1/§T2/§T7/§T8).
 *
 * 라운드 (a) 풀 격상 (2026-05-11):
 *   - placeholder 헤더 제거 → 1층 결론 카드(`ResultConclusionCard`) 본격 노출.
 *   - `revalidate = 3600` ISR 1h (PLAN 3.6) — provider/tariff 마스터 변경 빈도 낮음.
 *   - 비교 후보 0건 시 정직 안내 (ADR-0011 §T2 항목 5 동형) — page.tsx 인라인.
 *   - 신규 가입자 케이스 (lockedInputs.current_tariff_id null) 결론 카드 메시지 분기.
 *
 * 라운드 (d) — 계산 근거 펼치기 풀 (PLAN 3.5, 2026-05-11):
 *   - rank=1 item 의 tariff/snapshot 컬럼 + lockedInputs usageProfile 로
 *     `deriveCaveatTriggers` → CalculationDetails 의 "주의사항 트리거 조건" 표.
 *   - `piiAnonymizedAt` 있을 시 CalculationDetails 에 `inputsAbsent` 전달 —
 *     "사용한 가정" 이 재구성값임을 정직 표기 (ADR-0007 §T9 / ADR-0021 §T7).
 *
 * 누적 (sub-task 3~5 + 라운드 a):
 *   - regex 통과 후 `getResultByShortId` 호출 — 미존재 시 `notFound()` (§T1).
 *   - rank=1 결과 + tariff_snapshot/tariff/provider JOIN 으로 1위 카드 표면화.
 *   - 90일 후 lockedInputs NULL 시 익명화 안내 배너 (§T9).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  getResultByShortId,
  getResultItems,
  getTopResultItem,
  type TopResultItemRow,
} from '@/db/queries/comparison';
import { getExcludedProviders } from '@/db/queries/providers';
import {
  USAGE_ESTIMATOR_VERSION,
  deriveUsageProfile,
} from '@/engine/usage-estimator';
import type { UsageProfile } from '@/engine/types';
import type {
  HouseholdTypeInput,
  PostalCountry,
  TariffCategoryInput,
} from '@/types/comparison-input';
import { POSTAL_COUNTRIES } from '@/types/comparison-input';
import { SITE_ORIGIN } from '@/lib/site';

import { BetaEstimatedBanner } from './_components/BetaEstimatedBanner';
import { CalculationDetails } from './_components/CalculationDetails';
import { ComparisonControls } from './_components/ComparisonControls';
import { ComparisonTable } from './_components/ComparisonTable';
import { ExcludedProvidersSection } from './_components/ExcludedProvidersSection';
import { ResultConclusionCard } from './_components/ResultConclusionCard';
import {
  deriveCaveatTriggers,
  type CaveatTriggerRow,
} from './_lib/caveat-triggers';
import { applyView, parseSearchParams } from './_lib/compare-view';

// ADR-0007 §T7 Amendment 1 + ADR-0021 §T1 부록 — nanoid default URL-safe alphabet
// 64 chars × 12자. 형식 통과 후 DB 존재 검증(아래 page 본문).
const SHORT_ID_PATTERN = /^[A-Za-z0-9_-]{12}$/;

// PLAN 3.6 ISR — provider/tariff 마스터 변경 빈도 낮음. 시계열 신선도는
// CalculationDetails 의 engineVersion 표기 + Sub-task 5 LEFT JOIN request 의
// piiAnonymizedAt 으로 표면화.
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shortId: string }>;
}): Promise<Metadata> {
  const { shortId } = await params;
  if (!SHORT_ID_PATTERN.test(shortId)) {
    return {
      title: '결과를 찾을 수 없음 | Slim',
      robots: { index: false, follow: false },
    };
  }
  const url = `${SITE_ORIGIN}/r/${shortId}`;
  return {
    title: '비교 결과 | Slim',
    description: '베네룩스 통신 요금제 비교 결과 — Slim',
    // ADR-0021 §T8: 개별 결과는 검색 엔진 인덱스 X (PII 파생물 보수 보호).
    robots: { index: false, follow: true },
    alternates: { canonical: url },
    openGraph: {
      title: '비교 결과 | Slim',
      description: '베네룩스 통신 요금제 비교 결과',
      url,
      type: 'website',
      // SC-G 적용: og:image 미설정 — 페이즈 4 ADR-OG 도입 시 동적 OG 일괄.
    },
  };
}

export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ shortId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { shortId } = await params;
  const sp = await searchParams;

  // 1. 형식 검증 — 미달 시 즉시 404.
  if (!SHORT_ID_PATTERN.test(shortId)) {
    notFound();
  }

  // 2. DB 존재 검증 — 미존재 시 404.
  const row = await getResultByShortId(shortId);
  if (!row) {
    notFound();
  }

  // 3. 국가 우선 추출 (라운드 c 제외 공급사 fetch 의 country 필터 입력).
  //    lockedInputs.postal_country NULL/누락 시 BE fallback (SC-B 1차 정합).
  const postalCountry = extractCountry(row.lockedInputs);

  // 4. rank=1 결과 + 전체 items + 제외 공급사 병렬 fetch.
  const [topItem, allItems, excludedProviders] = await Promise.all([
    getTopResultItem(row.resultId),
    getResultItems(row.resultId),
    getExcludedProviders(postalCountry),
  ]);

  // 4. URL params → 정렬/필터 view + 적용 (라운드 b — PLAN 3.2 SC-F).
  const tableView = parseSearchParams(sp);
  const visibleItems = applyView(allItems, tableView);

  // 5. lockedInputs / request / topItem → CalculationDetails + ResultConclusion 입력.
  const view = derivePageView(row, topItem);
  const isAnonymized = row.piiAnonymizedAt !== null;
  const basePath = `/r/${shortId}`;

  // 5.a. ADR-0013 Amendment 1 — BetaEstimatedBanner 트리거.
  // 적어도 1 row 가 stub 이면 배너 표시 (현 단계 = 전체 row stub).
  // 페이즈 5 부분 전환 시 some() 조건 그대로 유지됨.
  const showBetaBanner = allItems.some((item) => item.isStub);

  // 6. 라운드 d (PLAN 3.5) — caveat 트리거 조건 표. rank=1 item 의 tariff/snapshot
  //    컬럼 + usageProfile 로 deriveCaveats 규칙 1~7 거울 평가.
  const rank1 = allItems.find((i) => i.rank === 1) ?? null;
  const triggerRows: readonly CaveatTriggerRow[] | undefined = rank1
    ? deriveCaveatTriggers({
        category: rank1.category,
        commitmentMonths: rank1.commitmentMonths,
        activationFeeCents: rank1.activationFeeCents,
        promoMonths: rank1.promoMonths,
        promoPriceCents: rank1.promoPriceCents,
        monthlyPriceCents: rank1.monthlyPriceCents,
        attributes: rank1.attributes,
        usageProfile: view.usageProfile,
        candidateConfidence: rank1.confidence,
      })
    : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-10 md:px-6">
      <header className="flex flex-col gap-2">
        <span className="text-sm text-muted">결과 링크</span>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          비교 결과
        </h1>
        <p className="text-xs text-fg-soft">
          영구 ID:{' '}
          <code className="rounded bg-bg-warm px-1.5 py-0.5 font-mono">
            {shortId}
          </code>
        </p>
        {isAnonymized && (
          <p className="text-xs text-fg-soft">
            이 비교의 입력 가정은 90일 보관 정책으로 일반화되었습니다 — 비교 결과
            자체는 그대로 보존됩니다 (ADR-0007 §T9).
          </p>
        )}
      </header>

      {/* ADR-0013 Amendment 1 — 위치 2: ResultConclusionCard 바로 위. */}
      {showBetaBanner && <BetaEstimatedBanner />}

      {topItem ? (
        <>
          <ResultConclusionCard
            providerName={topItem.providerName}
            tariffName={topItem.tariffName}
            monthlySavingCents={topItem.monthlySavingCents}
            yearlySavingCents={topItem.yearlySavingCents}
            monthlyAvg12Cents={topItem.monthlyAvg12Cents}
            confidence={topItem.confidence}
            caveats={topItem.caveats}
            isNewSubscriber={view.isNewSubscriber}
            ctaHref={`/go/${shortId}/${topItem.itemId}`}
            providerId={topItem.providerId}
            affiliateStatus={topItem.affiliateStatus}
          />
          <section
            aria-labelledby="comparison-heading"
            className="flex flex-col gap-4"
          >
            <h2
              id="comparison-heading"
              className="font-display text-xl font-semibold tracking-tight text-fg"
            >
              비교 표
            </h2>
            <ComparisonControls basePath={basePath} view={tableView} />
            <ComparisonTable rows={visibleItems} />
          </section>
        </>
      ) : (
        <article
          aria-labelledby="no-candidates-heading"
          className="flex flex-col gap-3 rounded-2xl border border-fg/10 bg-bg-warm/60 p-6"
        >
          <h2
            id="no-candidates-heading"
            className="font-display text-xl font-semibold tracking-tight text-fg"
          >
            비교 후보가 없습니다
          </h2>
          <p className="text-sm leading-relaxed text-fg-soft">
            이 카테고리/지역의 비교 가능 공급사가 현재 0건입니다. NL/LU 공급사
            fetcher 추가는 페이즈 5에서 평가 후 진행 예정입니다 (ADR-0009 §결정 1).
          </p>
          <Link
            href="/data-sources"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            데이터 출처 페이지에서 상세 보기 →
          </Link>
        </article>
      )}

      <ExcludedProvidersSection providers={excludedProviders} />

      <CalculationDetails
        category={view.category}
        householdType={view.householdType}
        inputAttributes={view.inputAttributes}
        usageProfile={view.usageProfile}
        breakdown={view.breakdown}
        caveats={view.caveats}
        triggerRows={triggerRows}
        inputsAbsent={isAnonymized}
        engineVersion={row.engineVersion}
        estimatorVersion={view.estimatorVersion}
      />

      {/* PLAN 3.7.b — "새로 비교 / 홈" CTA 는 인쇄 노이즈 → print:hidden.
           어필리에이트 디스클로저 링크는 P3 강제 — 인쇄에서 반드시 보임 (숨기지 않음).
           nav 전체를 print:hidden 하면 P3 위반이므로, CTA 버튼만 개별 숨김.
           globals.css 의 `a[href^="http"]::after` 규칙으로 인쇄 시 URL 텍스트 노출. */}
      <nav className="flex flex-wrap gap-3">
        <Link
          href="/compare"
          className="print:hidden inline-flex items-center justify-center rounded-full bg-fg px-6 py-3 text-sm font-medium text-bg transition hover:bg-primary"
        >
          새로 비교 시작
        </Link>
        <Link
          href="/"
          className="print:hidden inline-flex items-center justify-center rounded-full border border-fg/15 bg-bg px-6 py-3 text-sm font-medium text-fg transition hover:border-fg/30"
        >
          홈으로 돌아가기
        </Link>
      </nav>

      {/* P3 — 어필리에이트 디스클로저 (헌법 §3 P3 + ADR-0021 §T9 Amendment 1).
           인쇄물에 반드시 표시되어야 함. print:hidden 절대 금지.
           인쇄 시 globals.css `a[href^="http"]::after` 규칙으로 URL 텍스트 자동 노출.
           단 이 링크는 상대 경로(/legal/...)이므로 ::after 는 미적용 — 텍스트 링크로 명시. */}
      <footer className="border-t border-fg/10 pt-4 text-xs text-fg-soft">
        어필리에이트 수수료 관련:{' '}
        <Link
          href="/legal/affiliate-disclosure"
          className="underline-offset-4 hover:underline"
        >
          /legal/affiliate-disclosure
        </Link>
        {' '}(페이즈 6.9 공개 예정). 비교 결과 순위는 알고리즘 기반이며 수수료에 영향받지 않습니다.
      </footer>
    </main>
  );
}

// ─── lockedInputs / request → page view (CalculationDetails + 결론 카드 신호) ──

interface PageView {
  category: TariffCategoryInput;
  householdType: HouseholdTypeInput | undefined;
  inputAttributes: Record<string, unknown>;
  usageProfile: UsageProfile;
  breakdown: {
    monthlyAvg12Cents: number;
    monthlyAvg24Cents: number;
    activationAmortizedPerMonthCents: number;
  };
  caveats: readonly string[];
  estimatorVersion: string;
  /**
   * 라운드 (a) — 결론 카드 메시지 분기. lockedInputs.current_tariff_id null/없음
   * 시 true (compare currentTariff null, ADR-0010 §T7 케이스 6).
   */
  isNewSubscriber: boolean;
}

function derivePageView(
  row: {
    requestCategory: TariffCategoryInput | null;
    requestHouseholdType: HouseholdTypeInput | null;
    requestInputAttributes: unknown;
    lockedInputs: unknown;
  },
  topItem: TopResultItemRow | null,
): PageView {
  const locked = extractLockedInputs(row.lockedInputs);

  const category: TariffCategoryInput = row.requestCategory ?? 'mobile';
  const householdType: HouseholdTypeInput | undefined =
    row.requestHouseholdType ?? locked.householdType ?? undefined;
  const inputAttributes: Record<string, unknown> =
    extractRecord(row.requestInputAttributes) ?? locked.inputAttributes ?? {};
  const usageProfile: UsageProfile =
    locked.usageProfile ??
    deriveUsageProfile(category, householdType, inputAttributes);
  const estimatorVersion = locked.estimatorVersion ?? USAGE_ESTIMATOR_VERSION;

  return {
    category,
    householdType,
    inputAttributes,
    usageProfile,
    breakdown: {
      monthlyAvg12Cents: topItem?.monthlyAvg12Cents ?? 0,
      monthlyAvg24Cents: topItem?.monthlyAvg24Cents ?? 0,
      // ADR-0010 §T4: 활성화비 12개월 amortize (1차 표시 단위).
      activationAmortizedPerMonthCents: topItem
        ? Math.round(topItem.activationFeeCents / 12)
        : 0,
    },
    caveats: topItem?.caveats ?? [],
    estimatorVersion,
    isNewSubscriber: locked.currentTariffId === null,
  };
}

interface LockedFields {
  householdType?: HouseholdTypeInput;
  inputAttributes?: Record<string, unknown>;
  usageProfile?: UsageProfile;
  estimatorVersion?: string;
  /** null = 신규 가입자, string = uuid, undefined = lockedInputs NULL/누락. */
  currentTariffId?: string | null;
}

function extractLockedInputs(raw: unknown): LockedFields {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const result: LockedFields = {};

  if (isHouseholdType(obj['household_type'])) {
    result.householdType = obj['household_type'];
  }
  const inputAttrs = extractRecord(obj['input_attributes']);
  if (inputAttrs) {
    result.inputAttributes = inputAttrs;
  }

  // current_tariff_id — string uuid 또는 null. undefined 면 키 누락 (lockedInputs
  // NULL 또는 키 없음) → 결론 카드는 "기존 가입자/모름" 으로 보수 처리.
  const ctid = obj['current_tariff_id'];
  if (ctid === null) {
    result.currentTariffId = null;
  } else if (typeof ctid === 'string') {
    result.currentTariffId = ctid;
  }

  const assumptions = obj['assumptions'];
  if (assumptions && typeof assumptions === 'object' && !Array.isArray(assumptions)) {
    const a = assumptions as Record<string, unknown>;
    const usage = extractRecord(a['usage_profile']);
    if (usage) {
      result.usageProfile = usage as UsageProfile;
    }
    if (typeof a['estimator_version'] === 'string') {
      result.estimatorVersion = a['estimator_version'];
    }
  }
  return result;
}

function extractRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function isHouseholdType(v: unknown): v is HouseholdTypeInput {
  return v === 'single' || v === 'couple' || v === 'family_3_plus';
}

/**
 * lockedInputs.postal_country → PostalCountry. NULL/누락/잘못된 값 → 'BE' fallback
 * (페이즈 2 SC-B 1차 정합). 라운드 c — getExcludedProviders 국가 필터 입력.
 */
function extractCountry(raw: unknown): PostalCountry {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const c = (raw as Record<string, unknown>)['postal_country'];
    if (typeof c === 'string' && (POSTAL_COUNTRIES as readonly string[]).includes(c)) {
      return c as PostalCountry;
    }
  }
  return 'BE';
}
