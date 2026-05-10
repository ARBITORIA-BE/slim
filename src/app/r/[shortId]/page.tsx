/**
 * /r/[shortId] — 영구 비교 결과 링크 (ADR-0007 §T7 + ADR-0016 §T7 + ADR-0021 §T1/§T7/§T8).
 *
 * 페이즈 3 1차 (현재): placeholder + T7 계산 근거 펼치기 골격 + T8 metadata.
 * 결과 페이지 풀버전(3.1~3.7 결과 카드 / 비교 표 / 제외 공급사) 은 페이즈 3 후속
 * 라운드 (`/r/[shortId]` 풀 격상) — ADR-0021 §T2.
 *
 * SC-G 적용 (T8): noindex + canonical + static OG (텍스트만, og:image 미설정).
 *   동적 OG 이미지는 페이즈 4 진입 시 별도 ADR-OG.
 *
 * P3 정직성 (ADR-0011 §T2 항목 5 동형) — 미구현을 명시하고 *언제* 구현하는지
 * 사용자에게 노출. CalculationDetails 는 mock breakdown + caveats 로 동작 (페이즈 3
 * 후속에서 실 compare() 결과 전달 시 prop 만 변경).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ENGINE_VERSION } from '@/engine/compare';
import { USAGE_ESTIMATOR_VERSION, deriveUsageProfile } from '@/engine/usage-estimator';

import { CalculationDetails } from './_components/CalculationDetails';

const SITE_ORIGIN = 'https://slim.lu';

// ADR-0007 §T7 Amendment 1 + ADR-0021 §T1 부록 — nanoid default URL-safe alphabet
// 64 chars × 12자. DB 존재 여부 검증은 Sub-task 5 진입 시 추가.
const SHORT_ID_PATTERN = /^[A-Za-z0-9_-]{12}$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shortId: string }>;
}): Promise<Metadata> {
  const { shortId } = await params;
  // 형식 미달 → 메타데이터도 not-found 신호 (Next.js 가 not-found.tsx 자동 매칭)
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
    // follow=true 는 페이지 내부 링크는 따라가도 됨 (브랜드 페이지 등).
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

export default async function ResultPlaceholderPage({
  params,
}: {
  params: Promise<{ shortId: string }>;
}) {
  const { shortId } = await params;

  // ADR-0021 §T1 — 형식 미달 shortId 는 즉시 404 (not-found.tsx 렌더).
  // DB 존재 여부 검증은 Sub-task 5 진입 시 comparison_result SELECT 후 추가.
  if (!SHORT_ID_PATTERN.test(shortId)) {
    notFound();
  }

  // 페이즈 3 1차 mock 데이터 — 실 결과 페이지 (T2 풀 격상) 진입 시 compare() +
  // comparison_result lookup 으로 교체.
  const mockUsageProfile = deriveUsageProfile('mobile', 'single', {});
  const mockBreakdown = {
    monthlyAvg12Cents: 2000,
    monthlyAvg24Cents: 1850,
    activationAmortizedPerMonthCents: 0,
  };
  const mockCaveats: string[] = [];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-10 md:px-6">
      <header className="flex flex-col gap-2">
        <span className="text-sm text-muted">결과 링크</span>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          비교 결과 페이지는 곧 추가됩니다
        </h1>
      </header>

      <section className="rounded-2xl border border-fg/10 bg-bg-warm/40 p-6 text-sm leading-relaxed text-fg-soft">
        <p>
          현재 페이즈 3 builder 1차 단계입니다. 결과 카드 / 비교 표 / 제외 공급사 섹션
          풀버전은 페이즈 3 후속 라운드(<strong className="text-fg">M6 진입 시점</strong>)에
          추가 예정입니다. 본 단계는 입력 플로우 + 계산 근거 펼치기 + 영구 링크 메타
          (canonical, noindex)만 검증합니다.
        </p>
        <p className="mt-3">
          이 링크는 영구 보존되므로 페이즈 3 후속 진입 후 다시 방문하시면 풀 결과를 보실 수 있습니다.
        </p>
        <p className="mt-3 text-xs">
          영구 ID: <code className="rounded bg-bg px-1.5 py-0.5 font-mono">{shortId}</code>
        </p>
      </section>

      <CalculationDetails
        category="mobile"
        householdType="single"
        inputAttributes={{}}
        usageProfile={mockUsageProfile}
        breakdown={mockBreakdown}
        caveats={mockCaveats}
        engineVersion={ENGINE_VERSION}
        estimatorVersion={USAGE_ESTIMATOR_VERSION}
      />

      <Link
        href="/"
        className="inline-flex items-center justify-center self-start rounded-full bg-fg px-6 py-3 text-sm font-medium text-bg transition hover:bg-primary"
      >
        홈으로 돌아가기
      </Link>
    </main>
  );
}
