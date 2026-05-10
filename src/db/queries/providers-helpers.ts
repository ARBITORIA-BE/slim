/**
 * Provider/tariff query 변환 helpers — DB import 없는 순수 모듈.
 *
 * 분리 이유: src/db/queries/providers.ts 가 module load 시 `@/db` 를 import
 * → DATABASE_URL 미설정 환경(vitest)에서 즉시 throw. 순수 helper 만 분리해
 * test 가 db import 우회.
 *
 * 패턴: src/engine/comparison-stats.test.ts 와 동형 — DB 쿼리 자체는 통합
 * 테스트 영역, 순수 변환만 단위 테스트.
 */

import type { ActiveTariff } from './providers-types';

/**
 * 평탄 tariff 배열 → providerId 별 그룹화 Map.
 *
 * client 컴포넌트가 provider 선택 시 sub-step `<Select>` 에 표시할 tariff 목록을
 * 빠르게 조회할 수 있도록 hash 화. 0 tariff 인 provider 도 key 부재로 자연 처리
 * (sub-step UI 가 "요금제 없음" 안내).
 */
export function groupTariffsByProvider(
  tariffs: ReadonlyArray<ActiveTariff>,
): Map<string, ActiveTariff[]> {
  const map = new Map<string, ActiveTariff[]>();
  for (const t of tariffs) {
    const list = map.get(t.providerId);
    if (list) {
      list.push(t);
    } else {
      map.set(t.providerId, [t]);
    }
  }
  return map;
}
