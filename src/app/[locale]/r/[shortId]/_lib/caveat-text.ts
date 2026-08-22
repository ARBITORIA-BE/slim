/**
 * caveat-text — 저장된 caveat 을 현재 로케일 문장으로 바꾼다 (PLAN 4.28, ADR-0055 §D1)
 *
 * 엔진(`src/engine/caveats.ts`)은 코드+파라미터만 낸다. 번역은 여기서 한 번만 한다 —
 * ResultConclusionCard 와 CalculationDetails 두 곳이 같은 함수를 쓴다 (문구 불일치 0).
 *
 * 레거시 처리:
 *   4.28 이전에 저장된 한국어 문장도 `parseCaveat` 가 코드로 되돌리므로 DB 백필 없이
 *   즉시 번역된다. 되돌리지 못한 문장만 원문 그대로 노출한다 — 억지 추측으로 뜻이
 *   바뀐 caveat 을 만드는 것보다 원문이 낫다 (P1). 이 경우는 `unresolved` 로 센다.
 */

import { parseCaveat } from '@/engine/caveat-codes';

/** next-intl 의 `caveats` 네임스페이스 translator (동기 t 함수). */
type CaveatTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export interface FormatCaveatsResult {
  /** 화면에 그대로 뿌릴 수 있는 문장 배열 (입력 순서 보존). */
  readonly texts: readonly string[];
  /** 복원된 코드 목록 — UI 가 특정 caveat 유무로 분기할 때 쓴다. */
  readonly codes: readonly string[];
  /** 코드로 되돌리지 못해 원문을 노출한 건수 — 회귀 감시용. */
  readonly unresolved: number;
}

/**
 * 저장 문자열 배열 → 번역 문장 배열.
 *
 * `confidenceMedium` 은 파서 기술 문구를 파라미터로 받는데, 비어 있으면
 * messages 의 중립 기본값(`confidenceMediumDefaultReason`)으로 채운다.
 */
export function formatCaveats(
  raw: readonly string[],
  t: CaveatTranslator,
): FormatCaveatsResult {
  const texts: string[] = [];
  const codes: string[] = [];
  let unresolved = 0;

  for (const item of raw) {
    const caveat = parseCaveat(item);
    if (caveat === null) {
      unresolved += 1;
      texts.push(item);
      continue;
    }
    codes.push(caveat.code);

    const params: Record<string, string | number> = { ...caveat.params };
    if (caveat.code === 'confidenceMedium') {
      const reason = params['reason'];
      if (typeof reason !== 'string' || reason.trim().length === 0) {
        params['reason'] = t('confidenceMediumDefaultReason');
      }
    }

    texts.push(t(caveat.code, params));
  }

  return { texts, codes, unresolved };
}
