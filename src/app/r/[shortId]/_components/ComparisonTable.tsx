/**
 * ComparisonTable — 2층 비교 표 (PLAN 3.2, ADR-0021 §T2 2층 + §T5 caveats 매트릭스).
 *
 * 디자인:
 *   - Desktop (md:): native `<table>` — 정보 밀도 ↑ (다나와 스타일).
 *   - Mobile (<md): 카드 stack — 한 행 = 한 카드, 6 필드 수직.
 *   - 6 컬럼: 순위 / 공급사·요금제 / 월 비용 / 약정 / 절약 / 신뢰도.
 *   - 카테고리별 보조 텍스트 (subtitle): 공급사·요금제 셀 아래 1줄.
 *   - 프로모 / 활성화비 표기는 월 비용 셀 보조로 (T5 매트릭스 정합).
 *
 * 다크 패턴 회피 (헌법 §8 #3 + ADR-0021 §T5):
 *   - 색상 neutral. 절약액 강조 색상 X.
 *   - 음의 절약 (현재 요금제가 더 저렴) 도 정직 표기.
 *
 * 후속: 카테고리별 데이터/Mbps 별도 컬럼화는 비교 데이터 풍부해진 라운드에서 평가.
 */

import type { ResultRowData } from '@/db/queries/comparison';
import type { Confidence } from '@/db/schema/tariff_snapshot';
import type { TariffCategory } from '@/db/schema/tariff';

import { formatRelativeTime } from '../_lib/stale';
import { AffiliateDisclosureLine } from './AffiliateDisclosureLine';

// ─── Props ────────────────────────────────────────────────────────────────

export interface ComparisonTableProps {
  readonly rows: readonly ResultRowData[];
  /**
   * RSC 가 호출 시점 Date 주입 — `revalidate=3600` ISR 사이클 안에서 결정적 표시.
   * 테스트에서 고정 시각 주입 가능.
   */
  readonly now?: Date;
}

function SourceLink({
  href,
  fetchedAt,
  now,
}: {
  readonly href: string;
  readonly fetchedAt: Date;
  readonly now: Date;
}) {
  const relative = formatRelativeTime(fetchedAt, now);
  return (
    <a
      href={href}
      target="_blank"
      // rel="nofollow noopener" — 어트리뷰션 신호 X (헌법 P3 + ADR-0021 §T2 3층),
      // noopener 보안 (Tab nabbing 회피).
      rel="nofollow noopener"
      className="inline-flex flex-col items-start text-xs text-primary underline-offset-4 hover:underline"
    >
      <span>
        원본 보기 <span aria-hidden="true">↗</span>
        <span className="sr-only"> (새 창에서 열림)</span>
      </span>
      <span className="text-fg-soft">마지막 확인: {relative}</span>
    </a>
  );
}

// ─── 표시 helper ──────────────────────────────────────────────────────────

function formatEuro(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const sub = abs % 100;
  return sub === 0 ? `${sign}€${euros}` : `${sign}€${euros}.${sub.toString().padStart(2, '0')}`;
}

function formatCommitment(months: number): string {
  if (months === 0) return '없음';
  return `${months}개월`;
}

function formatSubtitle(
  category: TariffCategory,
  attrs: Record<string, unknown>,
): string {
  const parts: string[] = [];
  if (category === 'mobile') {
    const d = attrs['data_gb'];
    if (d === 'unlimited') parts.push('데이터 무제한');
    else if (typeof d === 'number') parts.push(`데이터 ${d} GB`);
    const v = attrs['voice_minutes'];
    if (v === 'unlimited') parts.push('통화 무제한');
    else if (typeof v === 'number') parts.push(`통화 ${v}분`);
  } else if (
    category === 'internet_fixed' ||
    category === 'bundle_internet_tv'
  ) {
    const down = attrs['download_mbps'];
    if (typeof down === 'number') parts.push(`${down} Mbps`);
    if (attrs['unlimited_data'] === true) parts.push('데이터 무제한');
    if (category === 'bundle_internet_tv') {
      const tv = attrs['tv_channels'];
      if (typeof tv === 'number') parts.push(`TV ${tv}채널`);
    }
  } else if (category === 'landline') {
    const m = attrs['calls_be_included_minutes'];
    if (m === 'unlimited') parts.push('BE 통화 무제한');
    else if (typeof m === 'number') parts.push(`BE 통화 ${m}분`);
  }
  return parts.join(' · ');
}

function formatPromoNote(
  promoPriceCents: number | null,
  promoMonths: number | null,
): string | null {
  if (promoPriceCents === null || promoMonths === null) return null;
  return `프로모 ${formatEuro(promoPriceCents)} (${promoMonths}개월)`;
}

function formatActivationNote(activationFeeCents: number): string | null {
  if (activationFeeCents <= 0) return null;
  return `활성화비 ${formatEuro(activationFeeCents)}`;
}

function formatSaving(cents: number): string {
  if (cents > 0) return `+${formatEuro(cents)}`;
  if (cents === 0) return '동일';
  return formatEuro(cents);
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
};

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    // PLAN 3.7.b — 인쇄 시 bg 안 보임 → print:border-current 로 배지 경계선 유지
    // (neutral 테두리, 빨강/노랑 경고색 없음 — 헌법 §8 #3).
    <span
      aria-label={`신뢰도 ${CONFIDENCE_LABEL[confidence]}`}
      className="inline-flex items-center gap-1 rounded-full border border-fg/15 bg-bg px-2 py-0.5 text-xs text-fg-soft print:border-current"
    >
      <span aria-hidden="true">●</span>
      {CONFIDENCE_LABEL[confidence]}
    </span>
  );
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────

export function ComparisonTable({ rows, now }: ComparisonTableProps) {
  const ref = now ?? new Date();
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-fg/10 bg-bg-warm/40 p-6 text-sm text-fg-soft">
        해당 조건에 맞는 비교 결과가 없습니다. 위 필터를 조정해 보세요.
      </p>
    );
  }

  return (
    <>
      {/* Desktop: native table.
          PLAN 3.7.b — 인쇄 시 md: breakpoint 무관하게 테이블 표시 (`print:block`).
          mobile 카드 스택은 `print:hidden` — 표가 더 정보 밀도 높음. */}
      <div className="hidden overflow-x-auto rounded-2xl border border-fg/10 md:block print:block">
        <table
          aria-label="요금제 비교 표"
          className="w-full border-collapse text-sm"
        >
          <thead className="bg-bg-warm/60 text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                #
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                공급사 / 요금제
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                월 비용
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                약정
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                절약
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                신뢰도
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                원본
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const subtitle = formatSubtitle(r.category, r.attributes);
              const promoNote = formatPromoNote(r.promoPriceCents, r.promoMonths);
              const actNote = formatActivationNote(r.activationFeeCents);
              return (
                // React.Fragment — 데이터 행 + 디스클로저 행을 tbody 안 묶음
                <tr
                  key={r.tariffSnapshotId}
                  className="border-t border-fg/10 align-top"
                >
                  <th
                    scope="row"
                    className="px-4 py-3 text-left text-sm font-medium text-fg-soft"
                  >
                    #{r.rank}
                  </th>
                  <td className="px-4 py-3">
                    <div className="font-medium text-fg">{r.providerName}</div>
                    <div className="text-fg">{r.tariffName}</div>
                    {subtitle && (
                      <div className="mt-0.5 text-xs text-fg-soft">{subtitle}</div>
                    )}
                    {/* PLAN 4.3.c — 공급사 셀 하단: 디스클로저 라인 (ADR-0026 §T4) */}
                    <AffiliateDisclosureLine
                      providerId={r.providerId}
                      providerName={r.providerName}
                      affiliateStatus={r.affiliateStatus}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-fg">{formatEuro(r.monthlyAvg12Cents)} / 월</div>
                    {(promoNote || actNote) && (
                      <div className="mt-0.5 text-xs text-fg-soft">
                        {[promoNote, actNote].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-fg">
                    {formatCommitment(r.commitmentMonths)}
                  </td>
                  <td className="px-4 py-3 text-fg">
                    {formatSaving(r.monthlySavingCents)} / 월
                    <div className="mt-0.5 text-xs text-fg-soft">
                      연 {formatSaving(r.yearlySavingCents)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ConfidenceBadge confidence={r.confidence} />
                  </td>
                  <td className="px-4 py-3">
                    <SourceLink href={r.sourceUrl} fetchedAt={r.fetchedAt} now={ref} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: card stack — PLAN 3.7.b: 인쇄 시 숨김 (desktop table 사용). */}
      <ul aria-label="요금제 비교 (모바일)" className="flex flex-col gap-3 md:hidden print:hidden">
        {rows.map((r) => {
          const subtitle = formatSubtitle(r.category, r.attributes);
          const promoNote = formatPromoNote(r.promoPriceCents, r.promoMonths);
          const actNote = formatActivationNote(r.activationFeeCents);
          return (
            <li key={r.tariffSnapshotId}>
              <article className="flex flex-col gap-2 rounded-2xl border border-fg/10 bg-bg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-medium text-muted">#{r.rank}</span>
                    <h3 className="font-display text-base font-semibold text-fg">
                      {r.providerName} — {r.tariffName}
                    </h3>
                    {subtitle && (
                      <p className="mt-0.5 text-xs text-fg-soft">{subtitle}</p>
                    )}
                  </div>
                  <ConfidenceBadge confidence={r.confidence} />
                </div>
                <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-fg-soft">월 비용</dt>
                  <dd className="text-fg">
                    {formatEuro(r.monthlyAvg12Cents)} / 월
                    {(promoNote || actNote) && (
                      <span className="ml-2 text-xs text-fg-soft">
                        {[promoNote, actNote].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </dd>
                  <dt className="text-fg-soft">약정</dt>
                  <dd className="text-fg">{formatCommitment(r.commitmentMonths)}</dd>
                  <dt className="text-fg-soft">절약</dt>
                  <dd className="text-fg">
                    {formatSaving(r.monthlySavingCents)} / 월 · 연{' '}
                    {formatSaving(r.yearlySavingCents)}
                  </dd>
                </dl>
                <div className="mt-1 border-t border-fg/10 pt-2">
                  <SourceLink href={r.sourceUrl} fetchedAt={r.fetchedAt} now={ref} />
                </div>
                {/* PLAN 4.3.c — 카드 하단 슬롯: 디스클로저 라인 (ADR-0026 §T4) */}
                <AffiliateDisclosureLine
                  providerId={r.providerId}
                  providerName={r.providerName}
                  affiliateStatus={r.affiliateStatus}
                />
              </article>
            </li>
          );
        })}
      </ul>
    </>
  );
}
