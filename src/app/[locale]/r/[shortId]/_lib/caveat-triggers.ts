/**
 * caveat-triggers — 계산 근거 펼치기의 "주의사항 트리거 조건" 표 (PLAN 3.5,
 * ADR-0021 §T5 계산 근거 컬럼 + §T7 / PLAN 4.28 i18n 전환)
 *
 * `deriveCaveats()` (src/engine/caveats.ts) 는 caveat *코드* 만 낸다. 코드만으로는
 * "왜 이게 떴는지" 를 보여줄 수 없으므로, 본 모듈이 *저장된 스냅샷 데이터*
 * (`comparison_result_item` JOIN `tariff` / `tariff_snapshot`) 와 `lockedInputs`
 * 의 usageProfile 로 규칙 1~7 을 *거울처럼* 재평가해 근거 행을 만든다. 규칙 8
 * (현재 요금제 신뢰도) 은 baseline confidence 가 별도 컬럼으로 저장되지 않으므로
 * 생략 — flat caveats 리스트가 이미 노출한다.
 *
 * PLAN 4.28 (2026-08-22): 한국어 문장 대신 **i18n 키 + 파라미터** 를 낸다.
 *   이전에는 "주의사항 발동 — 한도 초과 비용 미표시" 같은 *내부 진단 어휘* 가
 *   /en · /nl · /fr 에 그대로 노출됐다. 번역은 CalculationDetails 가 담당한다
 *   (`result.calculationDetails.triggers.*`).
 *
 * 순수성: 입력 동일 → 출력 동일, 입력 변형 X. 단위 테스트 대상.
 */

import type { TariffCategory } from '@/db/schema/tariff';
import type { Confidence } from '@/db/schema/tariff_snapshot';
import type { UsageProfile } from '@/engine/types';

// ─── 입출력 ───────────────────────────────────────────────────────────────

export type TriggerParams = Readonly<Record<string, string | number>>;

export interface CaveatTriggerRow {
  /** `result.calculationDetails.triggers.<conditionKey>` — 검사한 조건. */
  readonly conditionKey: string;
  readonly conditionParams?: TriggerParams;
  /** 이 조건이 주의사항을 발동시켰는가? */
  readonly triggered: boolean;
  /** `result.calculationDetails.triggers.<noteKey>` — 발동/미발동의 결과 설명. */
  readonly noteKey: string;
  readonly noteParams?: TriggerParams;
}

export interface CaveatTriggerInput {
  readonly category: TariffCategory;
  readonly commitmentMonths: number;
  readonly activationFeeCents: number;
  readonly promoMonths: number | null;
  readonly promoPriceCents: number | null;
  readonly monthlyPriceCents: number;
  /** `tariff.attributes` — data_gb / eu_roaming_included / download_mbps 등. */
  readonly attributes: Readonly<Record<string, unknown>>;
  /** lockedInputs.assumptions.usage_profile 또는 재추정값. */
  readonly usageProfile: UsageProfile;
  /** 후보 tariff_snapshot.confidence (high | medium — low 는 compare 입력 단계 제외). */
  readonly candidateConfidence: Confidence;
}

// ─── cents → € 문자열 (caveats.ts formatCentsAsEuro 동형 — 숫자 파라미터) ──

function euro(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const sub = abs % 100;
  return sub === 0
    ? `${sign}€${whole}`
    : `${sign}€${whole}.${sub.toString().padStart(2, '0')}`;
}

// ─── 핵심 ─────────────────────────────────────────────────────────────────

/**
 * deriveCaveats 규칙 1~7 을 트리거 근거 행으로 재평가. 규칙은 카테고리에 따라
 * *적용 가능할 때만* 행을 만든다 (mobile 전용 규칙을 internet 결과에 노이즈로
 * 끼우지 않음). 카테고리 무관 규칙(약정·활성화비·신뢰도)은 항상 행 생성.
 */
export function deriveCaveatTriggers(
  input: CaveatTriggerInput,
): CaveatTriggerRow[] {
  const rows: CaveatTriggerRow[] = [];

  // 1. 약정 길이 (caveats.ts 규칙 1) — 모든 카테고리.
  if (input.commitmentMonths <= 0) {
    rows.push({
      conditionKey: 'commitmentNone',
      triggered: false,
      noteKey: 'noPenaltyRisk',
    });
  } else {
    rows.push({
      conditionKey: 'commitmentMonths',
      conditionParams: { months: input.commitmentMonths },
      triggered: true,
      noteKey: 'penaltyRisk',
    });
  }

  // 2. 활성화 비용 (규칙 2) — 모든 카테고리.
  rows.push(
    input.activationFeeCents > 0
      ? {
          conditionKey: 'activationFee',
          conditionParams: { amount: euro(input.activationFeeCents) },
          triggered: true,
          noteKey: 'oneTimeFee',
        }
      : {
          conditionKey: 'activationFeeNone',
          triggered: false,
          noteKey: 'freeActivation',
        },
  );

  // 3. 프로모 길이 (규칙 3) — 프로모가 *있을 때만* 행 생성.
  if (input.promoMonths !== null && input.promoMonths > 0) {
    const ends12 = input.promoMonths < 12 && input.promoPriceCents !== null;
    rows.push(
      ends12
        ? {
            conditionKey: 'promoShort',
            conditionParams: { months: input.promoMonths },
            triggered: true,
            noteKey: 'revertsTo',
            noteParams: { price: euro(input.monthlyPriceCents) },
          }
        : {
            conditionKey: 'promoLong',
            conditionParams: { months: input.promoMonths },
            triggered: false,
            noteKey: 'lowValueWithin12',
          },
    );
  }

  // 4. 데이터 한도 초과 (규칙 4) — mobile 전용.
  if (input.category === 'mobile') {
    const dataGb = input.attributes['data_gb'];
    const usedGb = input.usageProfile.data_gb_used;
    if (dataGb === 'unlimited') {
      rows.push({
        conditionKey: 'dataUnlimited',
        triggered: false,
        noteKey: 'noOverage',
      });
    } else if (typeof dataGb === 'number' && typeof usedGb === 'number') {
      rows.push(
        usedGb > dataGb
          ? {
              conditionKey: 'dataUsage',
              conditionParams: { usedGb, planGb: dataGb },
              triggered: true,
              noteKey: 'overageHidden',
            }
          : {
              conditionKey: 'dataUsage',
              conditionParams: { usedGb, planGb: dataGb },
              triggered: false,
              noteKey: 'withinLimit',
            },
      );
    }
  }

  // 5. EU 로밍 (규칙 5) — mobile 전용.
  if (input.category === 'mobile') {
    const roaming = input.attributes['eu_roaming_included'];
    if (roaming === false) {
      rows.push({
        conditionKey: 'roamingExcluded',
        triggered: true,
        noteKey: 'roamingMissing',
      });
    } else if (roaming === true) {
      rows.push({
        conditionKey: 'roamingIncluded',
        triggered: false,
        noteKey: 'noConcern',
      });
    }
    // undefined → 정보 부재. 거짓 정보 회피 (P1) — 행 생성 X.
  }

  // 6. 4K 권장 속도 (규칙 6) — internet_fixed / bundle_* (인터넷 포함 카테고리).
  // ADR-0042 §D1: bundle_mobile_internet / bundle_mobile_internet_tv 추가.
  if (
    input.category === 'internet_fixed' ||
    input.category === 'bundle_internet_tv' ||
    input.category === 'bundle_mobile_internet' ||
    input.category === 'bundle_mobile_internet_tv'
  ) {
    if (input.usageProfile.streaming_4k === true) {
      const mbps = input.attributes['download_mbps'];
      if (typeof mbps === 'number') {
        rows.push(
          mbps < 100
            ? {
                conditionKey: 'streaming4kOn',
                conditionParams: { mbps },
                triggered: true,
                noteKey: 'below100',
              }
            : {
                conditionKey: 'streaming4kOn',
                conditionParams: { mbps },
                triggered: false,
                noteKey: 'meets100',
              },
        );
      }
    } else {
      rows.push({
        conditionKey: 'streaming4kOff',
        triggered: false,
        noteKey: 'notApplicable',
      });
    }
  }

  // 7. 비교 데이터 신뢰도 (규칙 7) — 모든 카테고리.
  rows.push(
    input.candidateConfidence === 'medium'
      ? {
          conditionKey: 'confidence',
          conditionParams: { confidence: input.candidateConfidence },
          triggered: true,
          noteKey: 'selectorWarning',
        }
      : {
          conditionKey: 'confidence',
          conditionParams: { confidence: input.candidateConfidence },
          triggered: false,
          noteKey: 'noConcern',
        },
  );

  return rows;
}
