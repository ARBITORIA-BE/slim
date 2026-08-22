/**
 * caveat 코드 — 엔진은 *번역된 문장이 아니라 코드+파라미터* 를 낸다 (PLAN 4.28, ADR-0055)
 *
 * 왜 이 모듈이 생겼나 (2026-08-22 실측)
 *   `deriveCaveats` 가 한국어 문장을 그대로 만들어 DB(`comparison_result_item.caveats`)에
 *   저장했고, 결과 페이지가 그것을 그대로 렌더했다. 그래서 en · nl · fr 세 로케일이
 *   글자 하나까지 같은 한국어 13건을 노출하고 있었다. messages 의 `caveats.*` 키는
 *   4 로케일 모두 이미 존재했다 — **번역은 있었고 소비자만 없었다.**
 *
 * 설계 (ADR-0055 §D1)
 *   - 엔진 출력 타입은 `string[]` 유지. 대신 내용이 **JSON 직렬화된 코드+파라미터**다.
 *     → `comparison_result_item.caveats`(text[]) 스키마 변경 0, 마이그레이션 0.
 *   - 렌더 시점에 `parseCaveat()` 로 복원해 `caveats.*` 네임스페이스로 번역한다.
 *   - **레거시 한국어 문자열도 같은 함수가 코드로 되돌린다** (`parseLegacyCaveat`).
 *     이미 발급된 영구 링크가 DB 백필 없이 즉시 다국어로 복구된다 — 백필은 선택.
 *
 * 왜 코드 이름이 `messages.caveats.*` 키와 1:1 인가?
 *   중간 매핑 테이블을 하나 더 두면 키가 어긋날 때 조용히 깨진다. 코드 = 키로 두면
 *   번역 누락이 타입/테스트에서 바로 드러난다.
 */

/** `messages/*.json` 의 `caveats.*` 키와 1:1. */
export const CAVEAT_CODES = [
  'commitment',
  'activationFee',
  'promoEnds',
  'dataOverage',
  'noEuRoaming',
  'speed4kInsufficient',
  'confidenceMedium',
  'currentTariffConfidence',
  'stubEstimate',
] as const;

export type CaveatCode = (typeof CAVEAT_CODES)[number];

export type CaveatParams = Readonly<Record<string, string | number>>;

export interface Caveat {
  readonly code: CaveatCode;
  readonly params: CaveatParams;
}

/** 직렬화 형태 — 짧은 키(k/p)로 text[] 저장 부피를 줄인다. */
interface SerializedCaveat {
  readonly k: string;
  readonly p?: CaveatParams;
}

function isCaveatCode(value: unknown): value is CaveatCode {
  return (
    typeof value === 'string' && (CAVEAT_CODES as readonly string[]).includes(value)
  );
}

/** Caveat → DB/전송용 문자열. */
export function serializeCaveat(caveat: Caveat): string {
  const payload: SerializedCaveat =
    Object.keys(caveat.params).length > 0
      ? { k: caveat.code, p: caveat.params }
      : { k: caveat.code };
  return JSON.stringify(payload);
}

/**
 * 저장된 문자열 → Caveat.
 *
 * 3단계로 시도한다:
 *   1. JSON 직렬화 형태 (4.28 이후 저장분)
 *   2. 레거시 한국어 문장 (4.28 이전 저장분) → 템플릿 역매핑
 *   3. 실패 → null (호출자가 원문을 그대로 노출할지 숨길지 결정)
 */
export function parseCaveat(raw: string): Caveat | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      // @builder-justification: JSON.parse 결과는 unknown — 즉시 타입 가드로 검증
      const parsed = JSON.parse(trimmed) as unknown;
      if (typeof parsed === 'object' && parsed !== null && 'k' in parsed) {
        const { k, p } = parsed as { k: unknown; p?: unknown };
        if (isCaveatCode(k)) {
          return {
            code: k,
            params:
              typeof p === 'object' && p !== null ? (p as CaveatParams) : {},
          };
        }
      }
    } catch {
      // JSON 형태였으나 깨짐 → 레거시 경로로 폴백
    }
  }
  return parseLegacyCaveat(trimmed);
}

/**
 * 레거시 한국어 caveat 문장 → Caveat 역매핑 (PLAN 4.28).
 *
 * 4.28 이전에 저장된 행을 **DB 백필 없이** 다국어로 복구하기 위한 경로.
 * 템플릿이 9종뿐이고 파라미터(개월·금액·GB·Mbps)가 문장 안에 전부 남아 있어
 * 무손실 복원이 가능하다. 백필 스크립트도 같은 함수를 쓴다 (단일 출처).
 *
 * 매칭 실패 시 null — 억지 추측으로 잘못된 caveat 을 만들지 않는다 (P1).
 */
export function parseLegacyCaveat(raw: string): Caveat | null {
  const text = raw.trim();

  const commitment = text.match(/^(\d+)개월 약정 — 조기 해지 시 위약금 발생$/);
  if (commitment?.[1]) {
    return { code: 'commitment', params: { months: Number(commitment[1]) } };
  }

  const activation = text.match(/^활성화 비용 (.+?) 별도 \(1회성\)$/);
  if (activation?.[1]) {
    return { code: 'activationFee', params: { amount: activation[1] } };
  }

  const promo = text.match(/^프로모 가격은 첫 (\d+)개월만 — 이후 (.+?)\/월$/);
  if (promo?.[1] && promo[2]) {
    return {
      code: 'promoEnds',
      params: { months: Number(promo[1]), price: promo[2] },
    };
  }

  const overage = text.match(
    /^월 (\d+)GB 사용 → 본 요금제 (\d+)GB 초과\. 한도 초과 비용은 표시되지 않습니다\.$/,
  );
  if (overage?.[1] && overage[2]) {
    return {
      code: 'dataOverage',
      params: { usedGb: Number(overage[1]), planGb: Number(overage[2]) },
    };
  }

  if (text === 'EU 로밍 미포함') {
    return { code: 'noEuRoaming', params: {} };
  }

  const speed = text.match(
    /^4K 스트리밍에 권장 100 Mbps 미만 \(본 요금제 (\d+) Mbps\)$/,
  );
  if (speed?.[1]) {
    return { code: 'speed4kInsufficient', params: { mbps: Number(speed[1]) } };
  }

  const confidenceMedium = text.match(/^비교 데이터 신뢰도: medium \((.*)\)$/);
  if (confidenceMedium) {
    return {
      code: 'confidenceMedium',
      params: { reason: confidenceMedium[1] ?? '' },
    };
  }

  const currentConfidence = text.match(/^현재 요금제 데이터 신뢰도: (.+)$/);
  if (currentConfidence?.[1]) {
    return {
      code: 'currentTariffConfidence',
      params: { confidence: currentConfidence[1] },
    };
  }

  // 레거시 문구는 내부 로드맵 용어("페이즈 5")를 노출했다 — 코드로 접으면
  // messages 의 중립 문구("실 데이터는 향후 제공 예정")로 자동 교체된다.
  if (text === '추정값 — 실 데이터 페이즈 5 이후') {
    return { code: 'stubEstimate', params: {} };
  }

  return null;
}
