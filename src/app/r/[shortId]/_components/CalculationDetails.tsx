/**
 * CalculationDetails — 계산 근거 펼치기 (ADR-0021 §T7).
 *
 * HTML `<details>` + `<summary>` native — JS 0, a11y 표준 (키보드 + 스크린리더
 * 자동 처리). 학습자 모드 친화 (브라우저 기본 동작).
 *
 * 노출 구성:
 *   1. 사용한 가정 (가구 형태 + usage-estimator 기본 프로파일 인용. 90일 후
 *      원본 입력 부재 시 정직 표기 — ADR-0007 §T9 / ADR-0021 §T7)
 *   2. 사용량 수치 (UsageProfile 필드별 표시)
 *   3. 적용 산식 (12개월/24개월 평균 + 활성화비 amortize)
 *   4. 주의사항 (caveats — deriveCaveats 결과)
 *   5. 주의사항 트리거 조건 (라운드 d, ADR-0021 §T5 계산 근거 컬럼) — *왜* 떴는지
 *      저장된 스냅샷 데이터로 재평가한 행 (deriveCaveatTriggers)
 *   6. 엔진 버전 (compare@... + usage-estimator@... — 결과 재현성)
 *
 * 데이터 출처: `/r/[shortId]` 페이지가 `comparison_result` + JOIN 한 실 값 전달
 * (라운드 a/b/c). triggerRows 는 rank=1 item 의 tariff/snapshot 컬럼 + lockedInputs
 * 의 usageProfile 로 page 가 derive (라운드 d).
 */

import type { ReactNode } from 'react';

import type { UsageProfile } from '@/engine/types';
import type {
  HouseholdTypeInput,
  TariffCategoryInput,
} from '@/types/comparison-input';

import type { CaveatTriggerRow } from '../_lib/caveat-triggers';

// ─── Props ────────────────────────────────────────────────────────────────

export interface CalculationBreakdown {
  /** ADR-0010 §T3 12개월 평균 (cents). 활성화비 amortize 포함. */
  readonly monthlyAvg12Cents: number;
  /** ADR-0010 §T3 24개월 평균 (cents). */
  readonly monthlyAvg24Cents: number;
  /** 1회성 활성화비를 12개월로 나눈 cents. 0 가능. */
  readonly activationAmortizedPerMonthCents: number;
}

export interface CalculationDetailsProps {
  readonly category: TariffCategoryInput;
  readonly householdType: HouseholdTypeInput | undefined;
  /** ADR-0007 §T2 input_attributes 명시값 (사용자 직접 입력). */
  readonly inputAttributes: Readonly<Record<string, unknown>>;
  /** UsageProfile — usage-estimator 가 derive 한 결과. */
  readonly usageProfile: UsageProfile;
  readonly breakdown: CalculationBreakdown;
  readonly caveats: readonly string[];
  /**
   * 라운드 d (PLAN 3.5) — caveat 트리거 근거 행 (deriveCaveatTriggers 결과).
   * undefined = 후보 0건 (rank=1 item 부재) — 트리거 표 섹션 비노출.
   */
  readonly triggerRows?: readonly CaveatTriggerRow[] | undefined;
  /**
   * 90일 보관 정책으로 원본 입력(`lockedInputs`)이 부재/일반화됨 (ADR-0007 §T9).
   * true 시 "사용한 가정" 섹션이 *재구성값임* 을 정직 표기 (ADR-0021 §T7).
   */
  readonly inputsAbsent?: boolean;
  /** ADR-0010 §T7 영구 링크 결과 재현성 — engineVersion + estimatorVersion 결합. */
  readonly engineVersion: string;
  readonly estimatorVersion: string;
}

// ─── 표시 helper ──────────────────────────────────────────────────────────

const HOUSEHOLD_LABELS: Record<HouseholdTypeInput, string> = {
  single: '혼자 (1인 가구)',
  couple: '커플 (2인 가구)',
  family_3_plus: '가족 (3인 이상)',
};

// ADR-0005 §Amendment 1 (2026-05-16): landline 제거 → 3값
const CATEGORY_LABELS: Record<TariffCategoryInput, string> = {
  mobile: '모바일',
  internet_fixed: '인터넷',
  bundle_internet_tv: '인터넷 + TV',
};

function formatEuro(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const sub = abs % 100;
  return sub === 0 ? `${sign}€${euros}` : `${sign}€${euros}.${sub.toString().padStart(2, '0')}`;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

// ─── UsageProfile 필드 노출 — 카테고리별 ──────────────────────────────────

function UsageList({
  category,
  profile,
}: {
  category: TariffCategoryInput;
  profile: UsageProfile;
}): ReactNode {
  const items: { label: string; value: string }[] = [];
  if (category === 'mobile') {
    if (profile.data_gb_used !== undefined) items.push({ label: '데이터 사용', value: `${profile.data_gb_used} GB / 월` });
    if (profile.voice_minutes_used !== undefined) items.push({ label: '통화', value: `${profile.voice_minutes_used} 분 / 월` });
    if (profile.sms_count !== undefined) items.push({ label: 'SMS', value: `${profile.sms_count} 건 / 월` });
    if (profile.eu_roaming_needed !== undefined) {
      items.push({ label: 'EU 로밍', value: profile.eu_roaming_needed ? '필요' : '불필요' });
    }
  }
  if (category === 'internet_fixed' || category === 'bundle_internet_tv') {
    if (profile.download_mbps_needed !== undefined) items.push({ label: '필요 다운로드 속도', value: `${profile.download_mbps_needed} Mbps` });
    if (profile.household_devices !== undefined) items.push({ label: '동시 디바이스', value: `${profile.household_devices} 대` });
    if (profile.streaming_4k !== undefined) {
      items.push({ label: '4K 스트리밍', value: profile.streaming_4k ? '필요' : '불필요' });
    }
  }
  if (category === 'bundle_internet_tv') {
    if (profile.tv_channels_needed !== undefined) items.push({ label: 'TV 채널 수', value: `${profile.tv_channels_needed} 개` });
    if (profile.tv_4k_needed !== undefined) {
      items.push({ label: '4K TV', value: profile.tv_4k_needed ? '필요' : '불필요' });
    }
  }
  // ADR-0005 §Amendment 1 (2026-05-16): landline 분기 제거 (D-1 흔적 제거)

  if (items.length === 0) {
    return <p className="text-sm text-fg-soft">사용량 정보 없음 (가구 형태 추정값 사용).</p>;
  }
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
      {items.map(({ label, value }) => (
        <div key={label} className="contents">
          <dt className="text-fg-soft">{label}</dt>
          <dd className="text-fg">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ─── 핵심 컴포넌트 ────────────────────────────────────────────────────────

export function CalculationDetails(props: CalculationDetailsProps) {
  const {
    category,
    householdType,
    inputAttributes,
    usageProfile,
    breakdown,
    caveats,
    triggerRows,
    inputsAbsent = false,
    engineVersion,
    estimatorVersion,
  } = props;

  const hasInputAttrs = Object.keys(inputAttributes).length > 0;
  const usageSource = inputsAbsent
    ? `원본 입력 부재 (90일 보관 정책) — 가구 형태 기반 추정 재구성 (${estimatorVersion})`
    : hasInputAttrs
      ? '사용자 직접 입력'
      : `가구 형태 기반 추정 (${estimatorVersion})`;

  return (
    <details className="rounded-2xl border border-fg/10 bg-bg-warm/30 p-4">
      <summary className="cursor-pointer select-none text-sm font-medium text-fg outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
        계산 근거 보기 — 사용한 가정 + 산식 + 주의사항 트리거 + 엔진 버전
      </summary>

      <div className="mt-4 flex flex-col gap-5">
        {inputsAbsent && (
          <p className="rounded-lg border border-fg/10 bg-bg/60 px-3 py-2 text-xs leading-relaxed text-fg-soft">
            이 결과는 저장 후 90일이 지나 원본 입력(우편번호·사용량 등)이 보관
            정책으로 부재합니다. 비교 결과 자체는 그대로 보존되며, 아래 가정은
            가구 형태 기반으로 재구성한 값입니다 (ADR-0007 §T9).
          </p>
        )}
        <Section title="사용한 가정">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-fg-soft">카테고리</dt>
            <dd className="text-fg">{CATEGORY_LABELS[category]}</dd>
            <dt className="text-fg-soft">가구 형태</dt>
            <dd className="text-fg">
              {householdType ? HOUSEHOLD_LABELS[householdType] : '미입력 (single 추정)'}
            </dd>
            <dt className="text-fg-soft">사용량 출처</dt>
            <dd className="text-fg">{usageSource}</dd>
          </dl>
        </Section>

        <Section title="사용량 수치">
          <UsageList category={category} profile={usageProfile} />
        </Section>

        <Section title="적용 산식">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-fg-soft">12개월 평균</dt>
            <dd className="text-fg">{formatEuro(breakdown.monthlyAvg12Cents)} / 월</dd>
            <dt className="text-fg-soft">24개월 평균</dt>
            <dd className="text-fg">{formatEuro(breakdown.monthlyAvg24Cents)} / 월</dd>
            <dt className="text-fg-soft">활성화비 amortize</dt>
            <dd className="text-fg">{formatEuro(breakdown.activationAmortizedPerMonthCents)} / 월 (12개월 분배)</dd>
          </dl>
        </Section>

        {caveats.length > 0 && (
          <Section title="주의사항">
            <ul className="flex list-inside list-disc flex-col gap-1 text-sm text-fg">
              {caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </Section>
        )}

        {triggerRows && triggerRows.length > 0 && (
          <Section title="주의사항 트리거 조건">
            <p className="text-xs text-muted">
              저장된 요금제 데이터와 사용량 가정으로 각 규칙을 재평가했습니다
              (ADR-0010 §T6).
            </p>
            <ul className="mt-1 flex flex-col gap-1.5 text-sm">
              {triggerRows.map((r, i) => (
                <li key={i} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                  <span
                    aria-hidden="true"
                    className={
                      r.triggered
                        ? 'mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-fg/60 sm:mt-0'
                        : 'mt-0.5 inline-block size-1.5 shrink-0 rounded-full border border-fg/30 sm:mt-0'
                    }
                  />
                  <span className="text-fg">{r.condition}</span>
                  <span className="text-fg-soft">— {r.note}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="엔진 버전">
          <code className="rounded bg-bg px-2 py-1 font-mono text-xs text-fg-soft">
            {engineVersion} / {estimatorVersion}
          </code>
          <p className="text-xs text-muted">
            영구 링크는 본 버전으로 재현됩니다 (ADR-0010 §T7 + ADR-0007 §T9).
          </p>
        </Section>
      </div>
    </details>
  );
}
