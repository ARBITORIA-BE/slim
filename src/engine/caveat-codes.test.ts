/**
 * caveat-codes 단위 테스트 (PLAN 4.28, ADR-0055 §D1)
 *
 * 핵심 계약 3가지:
 *   1. 직렬화 ↔ 복원 왕복 무손실
 *   2. **레거시 한국어 문장 → 코드 복원** (DB 백필 없이 기존 영구 링크 다국어화)
 *   3. 알 수 없는 문자열은 null — 억지 추측으로 뜻이 바뀐 caveat 을 만들지 않는다
 */

import { describe, it, expect } from 'vitest';

import {
  CAVEAT_CODES,
  parseCaveat,
  parseLegacyCaveat,
  serializeCaveat,
  type Caveat,
} from './caveat-codes';

describe('serializeCaveat / parseCaveat — 왕복', () => {
  const cases: readonly Caveat[] = [
    { code: 'commitment', params: { months: 24 } },
    { code: 'activationFee', params: { amount: '€50' } },
    { code: 'promoEnds', params: { months: 6, price: '€16.99' } },
    { code: 'dataOverage', params: { usedGb: 10, planGb: 5 } },
    { code: 'noEuRoaming', params: {} },
    { code: 'speed4kInsufficient', params: { mbps: 50 } },
    { code: 'confidenceMedium', params: { reason: 'parse warnings: x' } },
    { code: 'currentTariffConfidence', params: { confidence: 'medium' } },
    { code: 'stubEstimate', params: {} },
  ];

  for (const c of cases) {
    it(`${c.code} 왕복 무손실`, () => {
      expect(parseCaveat(serializeCaveat(c))).toEqual(c);
    });
  }

  it('모든 코드가 테스트에 포함돼 있다 (코드 추가 시 테스트 누락 방지)', () => {
    expect(cases.map((c) => c.code).sort()).toEqual([...CAVEAT_CODES].sort());
  });

  it('직렬화 결과는 한글을 포함하지 않는다', () => {
    for (const c of cases) {
      expect(/[가-힣]/.test(serializeCaveat(c))).toBe(false);
    }
  });
});

describe('parseLegacyCaveat — 4.28 이전 저장분 복원', () => {
  it('약정', () => {
    expect(parseLegacyCaveat('24개월 약정 — 조기 해지 시 위약금 발생')).toEqual({
      code: 'commitment',
      params: { months: 24 },
    });
  });

  it('활성화 비용', () => {
    expect(parseLegacyCaveat('활성화 비용 €49.99 별도 (1회성)')).toEqual({
      code: 'activationFee',
      params: { amount: '€49.99' },
    });
  });

  it('프로모 종료 — 프로덕션 실측 문장', () => {
    expect(parseLegacyCaveat('프로모 가격은 첫 6개월만 — 이후 €16.99/월')).toEqual({
      code: 'promoEnds',
      params: { months: 6, price: '€16.99' },
    });
  });

  it('데이터 한도 초과 — 프로덕션 실측 문장', () => {
    expect(
      parseLegacyCaveat(
        '월 10GB 사용 → 본 요금제 5GB 초과. 한도 초과 비용은 표시되지 않습니다.',
      ),
    ).toEqual({ code: 'dataOverage', params: { usedGb: 10, planGb: 5 } });
  });

  it('EU 로밍', () => {
    expect(parseLegacyCaveat('EU 로밍 미포함')).toEqual({
      code: 'noEuRoaming',
      params: {},
    });
  });

  it('4K 속도', () => {
    expect(
      parseLegacyCaveat('4K 스트리밍에 권장 100 Mbps 미만 (본 요금제 50 Mbps)'),
    ).toEqual({ code: 'speed4kInsufficient', params: { mbps: 50 } });
  });

  it('신뢰도 medium', () => {
    expect(parseLegacyCaveat('비교 데이터 신뢰도: medium (셀렉터 fragile 또는 파싱 경고)')).toEqual(
      { code: 'confidenceMedium', params: { reason: '셀렉터 fragile 또는 파싱 경고' } },
    );
  });

  it('현재 요금제 신뢰도', () => {
    expect(parseLegacyCaveat('현재 요금제 데이터 신뢰도: medium')).toEqual({
      code: 'currentTariffConfidence',
      params: { confidence: 'medium' },
    });
  });

  it('내부 로드맵 용어("페이즈 5")가 든 레거시 문장도 코드로 접힌다', () => {
    // 이 문장은 사용자에게 의미 없는 내부 용어를 노출했다. 코드로 접으면
    // messages 의 중립 문구로 자동 교체된다.
    expect(parseLegacyCaveat('추정값 — 실 데이터 페이즈 5 이후')).toEqual({
      code: 'stubEstimate',
      params: {},
    });
  });

  it('알 수 없는 문장 → null (추측 금지)', () => {
    expect(parseLegacyCaveat('무언가 새로운 문장입니다')).toBeNull();
    expect(parseLegacyCaveat('')).toBeNull();
  });

  it('parseCaveat 도 레거시 경로를 탄다', () => {
    expect(parseCaveat('EU 로밍 미포함')?.code).toBe('noEuRoaming');
  });
});

describe('parseCaveat — 방어', () => {
  it('깨진 JSON → 레거시 폴백 후 null', () => {
    expect(parseCaveat('{"k":')).toBeNull();
  });

  it('알 수 없는 코드 → null', () => {
    expect(parseCaveat('{"k":"somethingElse"}')).toBeNull();
  });

  it('params 없는 직렬화도 복원된다', () => {
    expect(parseCaveat('{"k":"noEuRoaming"}')).toEqual({
      code: 'noEuRoaming',
      params: {},
    });
  });
});
