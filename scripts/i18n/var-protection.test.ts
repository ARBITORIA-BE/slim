/**
 * var-protection.test.ts — ICU 변수 보호 유틸 단위 테스트.
 *
 * PLAN 4.5.j.4.A.1 verifier FAIL 수정 검증:
 *   DeepL XML 태그 공백 흡수 버그에 대한 encodeVars/decodeVars 공백 보정.
 *
 * 검증 케이스:
 *   1. 기본 인코딩 — varStore 에 spaceBefore/spaceAfter 기록
 *   2. 공백 보정 — ko 원문에 공백 있는데 번역문에서 소실 → 복원
 *   3. 과교정 방지 — ko 에 공백 없으면 강제 삽입 안 함
 *   4. 복수 변수 처리
 *   5. 언어별 구두점 보존 — fr 콜론 뒤 공백 등 건드리지 않음
 */

import { describe, it, expect } from 'vitest';
import { encodeVars, decodeVars } from './var-protection';
import type { VarEntry } from './var-protection';

describe('encodeVars', () => {
  it('변수를 XML 태그로 치환하고 varStore 에 공백 정보 기록한다', () => {
    const store: VarEntry[] = [];
    const result = encodeVars('데이터 {value} GB', store);
    expect(result).toBe('데이터 <x id="0"/> GB');
    expect(store).toHaveLength(1);
    expect(store[0]).toEqual({ name: 'value', spaceBefore: true, spaceAfter: true });
  });

  it('변수 앞 공백 없을 때 spaceBefore=false 기록', () => {
    const store: VarEntry[] = [];
    encodeVars('Activeringskosten{amount}', store);
    expect(store[0]).toMatchObject({ name: 'amount', spaceBefore: false, spaceAfter: false });
  });

  it('복수 변수 처리 — 각자 독립 인덱스', () => {
    const store: VarEntry[] = [];
    const result = encodeVars('프로모 {price} ({months}개월)', store);
    expect(result).toBe('프로모 <x id="0"/> (<x id="1"/>개월)');
    expect(store[0]).toMatchObject({ name: 'price', spaceBefore: true, spaceAfter: true });
    // {months} 앞 '(' 는 공백 아님
    expect(store[1]).toMatchObject({ name: 'months', spaceBefore: false, spaceAfter: false });
  });
});

describe('decodeVars', () => {
  it('ko 원문에 양쪽 공백 있고 번역문에서 소실됐으면 복원한다', () => {
    // 시뮬레이션: "데이터 {value} GB" → DeepL → "Data<x id="0"/>GB" (공백 흡수)
    const store: VarEntry[] = [{ name: 'value', spaceBefore: true, spaceAfter: true }];
    const result = decodeVars('Data<x id="0"/>GB', store);
    // ko 에 양쪽 공백 있으므로 번역문에도 복원
    expect(result).toBe('Data {value} GB');
  });

  it('ko 원문에 공백 없고 번역문도 공백 없으면 그대로', () => {
    // "Activeringskosten{amount}" → DeepL → "Activeringskosten<x id="0"/>" (정상)
    const store: VarEntry[] = [{ name: 'amount', spaceBefore: false, spaceAfter: false }];
    const result = decodeVars('Activeringskosten<x id="0"/>', store);
    // ko 에 공백 없으므로 강제 삽입 안 함
    expect(result).toBe('Activeringskosten{amount}');
  });

  it('과교정 방지 — ko 에 공백 없고 번역문에 공백 있으면 번역문 공백 유지', () => {
    // 번역문이 자연스럽게 공백을 포함했을 때 건드리지 않는다
    const store: VarEntry[] = [{ name: 'amount', spaceBefore: false, spaceAfter: false }];
    const result = decodeVars('Frais d\'activation : <x id="0"/> (paiement unique)', store);
    // ko={amount} 이지만 fr 번역은 공백 추가 가능 — 그대로 유지
    expect(result).toBe("Frais d'activation : {amount} (paiement unique)");
  });

  it('복수 변수 — 각 변수 독립 공백 보정', () => {
    const store: VarEntry[] = [
      { name: 'price', spaceBefore: true, spaceAfter: true },
      { name: 'months', spaceBefore: false, spaceAfter: false },
    ];
    // DeepL 이 price 양쪽 공백을 흡수한 시나리오
    const result = decodeVars('Promotie<x id="0"/>(<x id="1"/>maanden)', store);
    expect(result).toBe('Promotie {price} ({months}maanden)');
  });

  it('savingYearly 패턴 — 앞 공백 있고 뒤 없는 경우', () => {
    // ko: "연 {amount}" → spaceBefore=true, spaceAfter=false (문자열 끝)
    const store: VarEntry[] = [{ name: 'amount', spaceBefore: true, spaceAfter: false }];
    // DeepL 이 공백 흡수: "Per jaar<x id="0"/>"
    const result = decodeVars('Per jaar<x id="0"/>', store);
    expect(result).toBe('Per jaar {amount}');
  });

  it('잘못된 인덱스는 {?} 로 대체', () => {
    const store: VarEntry[] = [];
    const result = decodeVars('test <x id="99"/>', store);
    expect(result).toBe('test {?}');
  });
});

describe('encodeVars + decodeVars 라운드트립', () => {
  it('ko 원문 공백 패턴이 번역문에서 보장된다', () => {
    const store: VarEntry[] = [];
    const koText = '데이터 {value} GB';
    const encoded = encodeVars(koText, store);

    // DeepL 이 공백을 흡수한 상황 시뮬레이션
    const fakeDeepLOutput = encoded.replace('데이터 ', 'Data').replace(' GB', 'GB');
    const decoded = decodeVars(fakeDeepLOutput, store);

    // ko 원문에 양쪽 공백 있으므로 번역문에도 복원됨
    expect(decoded).toBe('Data {value} GB');
  });

  it('통화 {value}분 — ko 에 앞 공백 있고 뒤 없음', () => {
    const store: VarEntry[] = [];
    const koText = '통화 {value}분';
    // encodeVars 로 store 에 공백 정보 채우기 (반환값은 사용 안 함 — store 부작용이 목적)
    encodeVars(koText, store);
    // store[0].spaceBefore = true, spaceAfter = false

    // DeepL 출력 시뮬레이션: "Call duration<x id="0"/>minutes"
    const fakeDeepL = 'Call duration<x id="0"/>minutes';
    const decoded = decodeVars(fakeDeepL, store);
    expect(decoded).toBe('Call duration {value}minutes');
  });
});
