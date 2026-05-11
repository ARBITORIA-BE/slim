/**
 * caveat-triggers — 계산 근거 펼치기의 "주의사항 트리거 조건" 표 (PLAN 3.5,
 * ADR-0021 §T5 계산 근거 컬럼 + §T7).
 *
 * `deriveCaveats()` (src/engine/caveats.ts) 는 *한국어 caveat 텍스트* 만 출력한다
 * (ADR-0021 §T5 Amendment 1 — i18n 모듈 미신설). 그래서 caveat 문자열만으로는
 * "왜 이게 떴는지" 를 사용자에게 보여줄 수 없다. 본 모듈은 *저장된 스냅샷 데이터*
 * (`comparison_result_item` JOIN `tariff` / `tariff_snapshot`) 와 `lockedInputs`
 * 의 usageProfile 로 deriveCaveats 의 규칙 1~7 을 *거울처럼* 재평가해 트리거 근거
 * 행을 만든다. 규칙 8 (현재 요금제 신뢰도) 은 비교 baseline 의 confidence 가
 * 별도 컬럼으로 저장되지 않으므로 (caveats 배열 안에 텍스트로만 보존) 본 표에서는
 * 생략 — flat caveats 리스트가 그것을 이미 노출한다.
 *
 * 순수성: 입력 동일 → 출력 동일, 입력 변형 X. 단위 테스트 대상 (`caveat-triggers.test.ts`).
 */

import type { TariffCategory } from '@/db/schema/tariff';
import type { Confidence } from '@/db/schema/tariff_snapshot';
import type { UsageProfile } from '@/engine/types';

// ─── 입출력 ───────────────────────────────────────────────────────────────

export interface CaveatTriggerRow {
  /** 검사한 조건 (예: "약정 24개월", "활성화 비용 €50"). */
  readonly condition: string;
  /** 이 조건이 주의사항을 발동시켰는가? */
  readonly triggered: boolean;
  /** 발동/미발동의 결과 설명 (예: "조기 해지 시 위약금 — 발동", "무료 — 미발동"). */
  readonly note: string;
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

// ─── cents → € 문자열 (caveats.ts formatCentsAsEuro 동형 — UI 가 아닌 텍스트) ──

function euro(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const sub = abs % 100;
  return sub === 0
    ? `${sign}€${whole}`
    : `${sign}€${whole}.${sub.toString().padStart(2, '0')}`;
}

const TRIGGERED = '주의사항 발동';
const NOT_TRIGGERED = '미발동';

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
      condition: '약정 없음 (비구속)',
      triggered: false,
      note: `${NOT_TRIGGERED} — 위약금 위험 없음`,
    });
  } else {
    rows.push({
      condition: `약정 ${input.commitmentMonths}개월`,
      triggered: true,
      note: `${TRIGGERED} — 조기 해지 시 위약금`,
    });
  }

  // 2. 활성화 비용 (규칙 2) — 모든 카테고리.
  rows.push(
    input.activationFeeCents > 0
      ? {
          condition: `활성화 비용 ${euro(input.activationFeeCents)}`,
          triggered: true,
          note: `${TRIGGERED} — 1회성 비용 별도`,
        }
      : {
          condition: '활성화 비용 €0',
          triggered: false,
          note: `${NOT_TRIGGERED} — 무료`,
        },
  );

  // 3. 프로모 길이 (규칙 3) — 프로모가 *있을 때만* 행 생성.
  if (input.promoMonths !== null && input.promoMonths > 0) {
    const ends12 = input.promoMonths < 12 && input.promoPriceCents !== null;
    rows.push(
      ends12
        ? {
            condition: `프로모 ${input.promoMonths}개월 (< 12개월)`,
            triggered: true,
            note: `${TRIGGERED} — 이후 ${euro(input.monthlyPriceCents)}/월 정상가 전환`,
          }
        : {
            condition: `프로모 ${input.promoMonths}개월`,
            triggered: false,
            note: `${NOT_TRIGGERED} — 12개월 평균 시나리오 내 가치 ↓`,
          },
    );
  }

  // 4. 데이터 한도 초과 (규칙 4) — mobile 전용.
  if (input.category === 'mobile') {
    const dataGb = input.attributes['data_gb'];
    const usedGb = input.usageProfile.data_gb_used;
    if (dataGb === 'unlimited') {
      rows.push({
        condition: '데이터 무제한 요금제',
        triggered: false,
        note: `${NOT_TRIGGERED} — 한도 초과 없음`,
      });
    } else if (typeof dataGb === 'number' && typeof usedGb === 'number') {
      rows.push(
        usedGb > dataGb
          ? {
              condition: `월 ${usedGb}GB 사용 vs 본 요금제 ${dataGb}GB`,
              triggered: true,
              note: `${TRIGGERED} — 한도 초과 비용 미표시`,
            }
          : {
              condition: `월 ${usedGb}GB 사용 vs 본 요금제 ${dataGb}GB`,
              triggered: false,
              note: `${NOT_TRIGGERED} — 한도 내`,
            },
      );
    }
  }

  // 5. EU 로밍 (규칙 5) — mobile 전용.
  if (input.category === 'mobile') {
    const roaming = input.attributes['eu_roaming_included'];
    if (roaming === false) {
      rows.push({
        condition: 'EU 로밍 포함 여부: 미포함',
        triggered: true,
        note: `${TRIGGERED} — EU 로밍 미포함`,
      });
    } else if (roaming === true) {
      rows.push({
        condition: 'EU 로밍 포함 여부: 포함',
        triggered: false,
        note: `${NOT_TRIGGERED}`,
      });
    }
    // undefined → 정보 부재. 거짓 정보 회피 (P1) — 행 생성 X.
  }

  // 6. 4K 권장 속도 (규칙 6) — internet_fixed / bundle_internet_tv.
  if (
    input.category === 'internet_fixed' ||
    input.category === 'bundle_internet_tv'
  ) {
    if (input.usageProfile.streaming_4k === true) {
      const mbps = input.attributes['download_mbps'];
      if (typeof mbps === 'number') {
        rows.push(
          mbps < 100
            ? {
                condition: `4K 스트리밍 요청 + 본 요금제 ${mbps} Mbps`,
                triggered: true,
                note: `${TRIGGERED} — 권장 100 Mbps 미만`,
              }
            : {
                condition: `4K 스트리밍 요청 + 본 요금제 ${mbps} Mbps`,
                triggered: false,
                note: `${NOT_TRIGGERED} — 권장 속도 충족`,
              },
        );
      }
    } else {
      rows.push({
        condition: '4K 스트리밍 미요청',
        triggered: false,
        note: `${NOT_TRIGGERED} — 해당 없음`,
      });
    }
  }

  // 7. 비교 데이터 신뢰도 (규칙 7) — 모든 카테고리.
  rows.push(
    input.candidateConfidence === 'medium'
      ? {
          condition: '비교 데이터 신뢰도: medium',
          triggered: true,
          note: `${TRIGGERED} — 셀렉터/파싱 경고`,
        }
      : {
          condition: `비교 데이터 신뢰도: ${input.candidateConfidence}`,
          triggered: false,
          note: `${NOT_TRIGGERED}`,
        },
  );

  return rows;
}
