/**
 * providers query 변환 helper 단위 테스트.
 *
 * comparison-stats.test.ts 와 동일 패턴 — DB 쿼리 자체는 통합 테스트 영역,
 * 순수 변환 helper (`groupTariffsByProvider`) 만 검증.
 */

import { describe, expect, it } from 'vitest';

// providers.ts 는 db 를 module load time 에 import → DATABASE_URL 없는 vitest
// 환경에서 throw. 순수 helper 만 분리된 모듈에서 import 해 회피.
import { groupTariffsByProvider } from './providers-helpers';
import type { ActiveTariff } from './providers-types';

function makeTariff(id: string, providerId: string, name: string): ActiveTariff {
  return { id, providerId, name, slug: name.toLowerCase().replace(/\s+/g, '-') };
}

describe('groupTariffsByProvider', () => {
  it('빈 배열 → 빈 Map (0 tariff 안전)', () => {
    const map = groupTariffsByProvider([]);
    expect(map.size).toBe(0);
  });

  it('단일 provider 의 단일 tariff', () => {
    const map = groupTariffsByProvider([makeTariff('t1', 'p1', 'Mobile Essential')]);
    expect(map.size).toBe(1);
    expect(map.get('p1')).toHaveLength(1);
    expect(map.get('p1')?.[0]?.name).toBe('Mobile Essential');
  });

  it('단일 provider 의 다수 tariff 묶음', () => {
    const map = groupTariffsByProvider([
      makeTariff('t1', 'p1', 'Mobile Essential'),
      makeTariff('t2', 'p1', 'Mobile Smart'),
      makeTariff('t3', 'p1', 'Mobile Unlimited'),
    ]);
    expect(map.size).toBe(1);
    expect(map.get('p1')).toHaveLength(3);
  });

  it('여러 provider 분리 그룹화', () => {
    const map = groupTariffsByProvider([
      makeTariff('t1', 'p1', 'Mobile Essential'),
      makeTariff('t2', 'p2', 'ONE Internet'),
      makeTariff('t3', 'p1', 'Mobile Smart'),
      makeTariff('t4', 'p2', 'Essential Internet'),
    ]);
    expect(map.size).toBe(2);
    expect(map.get('p1')).toHaveLength(2);
    expect(map.get('p2')).toHaveLength(2);
  });

  it('알 수 없는 providerId 조회 → undefined (sub-step "요금제 없음" 안내 트리거)', () => {
    const map = groupTariffsByProvider([makeTariff('t1', 'p1', 'Mobile Essential')]);
    expect(map.get('p999')).toBeUndefined();
  });

  it('입력 배열 순서 보존 (각 provider 그룹 내)', () => {
    const map = groupTariffsByProvider([
      makeTariff('t1', 'p1', 'A'),
      makeTariff('t2', 'p1', 'B'),
      makeTariff('t3', 'p1', 'C'),
    ]);
    const names = map.get('p1')?.map((t) => t.name);
    expect(names).toEqual(['A', 'B', 'C']);
  });
});
