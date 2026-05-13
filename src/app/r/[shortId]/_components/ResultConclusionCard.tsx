/**
 * ResultConclusionCard — 페이지 1층 결론 카드 (PLAN 3.1, ADR-0021 §T2 1층).
 *
 * 표시:
 *   - 1위 공급사 + 요금제명 (heading)
 *   - 핵심 메시지 (4 상태별 — positive saving / zero / negative / new subscriber)
 *   - 월 비용 (12개월 평균) + 예상 절약 (positive 만)
 *   - 신뢰도 배지 (confidence != 'high' 시 노출, ADR-0021 §T5 매트릭스)
 *   - caveats 리스트 (페이즈 4 i18n SC-E 전까지 단순 평탄 노출 — T5 Amendment 1)
 *   - 변경하기 CTA placeholder (페이즈 4 어트리뷰션 활성 — ADR-0021 §T2 결론 카드)
 *
 * 다크 패턴 회피 (헌법 §8 #3 + ADR-0021 §T5):
 *   - 색상 *neutral* — 빨강/노랑 강조 배지 X. 위급한 척 0.
 *   - "X명이 지금 보고 있어요" 류 0 (헌법 §8 #3).
 *   - 절약액 부풀리지 않음 — signed cents 그대로 노출 (negative 시 정직 표기).
 *
 * 후속 라운드 (b~d):
 *   - 비교 표 (3.2) 가 본 카드 아래에 노출 — 본 컴포넌트는 1위에만 집중.
 *   - caveats 매트릭스 (T5) i18n + 위치별 차등 노출은 i18n 라운드 (페이즈 4 SC-E).
 *   - CTA 활성 = 페이즈 4 어트리뷰션 ADR.
 */

import Link from 'next/link';

import type { Confidence } from '@/db/schema/tariff_snapshot';
import type { AffiliateStatus } from '@/db/schema/provider';

import { AffiliateDisclosureLine } from './AffiliateDisclosureLine';

// ─── Props ────────────────────────────────────────────────────────────────

export interface ResultConclusionCardProps {
  readonly providerName: string;
  readonly tariffName: string;
  /** ADR-0010 §T3 12개월 시나리오 월 절약액 (signed cents). */
  readonly monthlySavingCents: number;
  /** monthlySavingCents × 12. UI 단일 변환 출처. */
  readonly yearlySavingCents: number;
  /** 1위 요금제 12개월 평균 비용 (activation amortize 포함). */
  readonly monthlyAvg12Cents: number;
  readonly confidence: Confidence;
  readonly caveats: readonly string[];
  /**
   * 신규 가입자 케이스 (compare currentTariff null) — ADR-0010 §T7 케이스 6.
   * 이 경우 monthlySavingCents = -monthlyAvg12 (절약 의미 X, absolute cost).
   */
  readonly isNewSubscriber: boolean;
  /**
   * PLAN 4.1.c — 동의 인터스티셜 CTA href 구성.
   * shortId: comparison_result.short_id
   * itemId: comparison_result_item.id (1위 rank 행)
   * null 이면 CTA 비활성 (후보 0건 케이스).
   */
  readonly ctaHref: string | null;
  /** PLAN 4.3.c — AffiliateDisclosureLine: provider.id */
  readonly providerId: string;
  /** PLAN 4.3.c — AffiliateDisclosureLine: affiliate_status 분기 키 */
  readonly affiliateStatus: AffiliateStatus;
}

// ─── 표시 helper ──────────────────────────────────────────────────────────

function formatEuro(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const sub = abs % 100;
  return sub === 0 ? `${sign}€${euros}` : `${sign}€${euros}.${sub.toString().padStart(2, '0')}`;
}

interface Verdict {
  readonly headline: string;
  /** 절약액(월/연) 보조 표기를 보여줄지. negative/zero/new-subscriber 는 비노출. */
  readonly showSavings: boolean;
}

function deriveVerdict(
  monthlySavingCents: number,
  isNewSubscriber: boolean,
): Verdict {
  if (isNewSubscriber) {
    return {
      headline: '신규 가입자에게 가장 저렴한 요금제입니다.',
      showSavings: false,
    };
  }
  if (monthlySavingCents > 0) {
    return {
      headline: `월 ${formatEuro(monthlySavingCents)} 절약 가능합니다.`,
      showSavings: true,
    };
  }
  if (monthlySavingCents === 0) {
    return {
      headline: '현재 요금제와 동일한 수준입니다.',
      showSavings: false,
    };
  }
  return {
    headline: '현재 요금제보다 저렴한 후보를 찾지 못했습니다 — 유지 권장.',
    showSavings: false,
  };
}

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: '신뢰도 높음',
  medium: '신뢰도 보통 — 데이터 출처 검토 필요',
  low: '신뢰도 낮음 — 비교 엔진 자동 제외 대상',
};

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────

export function ResultConclusionCard(props: ResultConclusionCardProps) {
  const {
    providerName,
    tariffName,
    monthlySavingCents,
    yearlySavingCents,
    monthlyAvg12Cents,
    confidence,
    caveats,
    isNewSubscriber,
    ctaHref,
    providerId,
    affiliateStatus,
  } = props;
  const verdict = deriveVerdict(monthlySavingCents, isNewSubscriber);

  return (
    <article
      aria-labelledby="conclusion-heading"
      className="flex flex-col gap-4 rounded-2xl border border-fg/10 bg-bg-warm/60 p-6"
    >
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">
          1위 추천
        </span>
        <h2
          id="conclusion-heading"
          className="font-display text-2xl font-semibold tracking-tight text-fg"
        >
          {providerName} — {tariffName}
        </h2>
      </div>

      <p className="text-base leading-relaxed text-fg">{verdict.headline}</p>

      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-fg-soft">월 비용 (12개월 평균)</dt>
        <dd className="text-fg">{formatEuro(monthlyAvg12Cents)} / 월</dd>
        {verdict.showSavings && (
          <>
            <dt className="text-fg-soft">예상 절약</dt>
            <dd className="text-fg">
              월 {formatEuro(monthlySavingCents)} · 연 {formatEuro(yearlySavingCents)}
            </dd>
          </>
        )}
      </dl>

      {confidence !== 'high' && (
        // PLAN 3.7.b — 인쇄 시 배경색 안 보임 → border 로 배지 구분 유지.
        // ADR-0021 §T9 Amendment 1 색상 폴백: neutral 테두리·텍스트 (빨강/노랑 X).
        <p className="inline-flex w-fit items-center gap-2 rounded-full border border-fg/15 bg-bg px-3 py-1 text-xs text-fg-soft print:border-current">
          <span className="sr-only">신뢰도:</span>
          <span aria-hidden="true">●</span>
          {CONFIDENCE_LABELS[confidence]}
        </p>
      )}

      {caveats.length > 0 && (
        <section aria-labelledby="conclusion-caveats">
          <h3
            id="conclusion-caveats"
            className="text-sm font-semibold text-fg"
          >
            주의사항
          </h3>
          <ul className="mt-1 flex list-inside list-disc flex-col gap-1 text-sm text-fg">
            {caveats.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </section>
      )}

      {/* PLAN 4.1.c — "변경하기" CTA 활성화.
           ctaHref null = 후보 0건 케이스 → 버튼 비활성.
           // PLAN 4.1.d TODO: 다크패턴 0 검증 (동등 가시성, 긴급성 표현 X), 인터스티셜 스타일 최종화.
           인쇄에서 숨김 (클릭 불가 환경 + 노이즈). */}
      {ctaHref ? (
        <Link
          href={ctaHref}
          className="print:hidden inline-flex w-fit items-center justify-center rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-bg transition hover:bg-primary"
        >
          변경하기
        </Link>
      ) : (
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="비교 후보 없음"
          className="print:hidden inline-flex w-fit cursor-not-allowed items-center justify-center rounded-full border border-fg/15 bg-bg px-5 py-2.5 text-sm font-medium text-fg-soft opacity-70"
        >
          변경하기
        </button>
      )}

      {/* PLAN 4.3.c — 결론 카드 하단 슬롯: 디스클로저 라인 (ADR-0026 §T4).
           인쇄물에서도 표시 (print:hidden 금지 — 헌법 P3). */}
      <AffiliateDisclosureLine
        providerId={providerId}
        providerName={providerName}
        affiliateStatus={affiliateStatus}
      />
    </article>
  );
}
