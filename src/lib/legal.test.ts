/**
 * legal.ts 단위 테스트 (PLAN 4.10.a DoD).
 * 표기 헬퍼 + LEGAL_ENTITY 계약 검증.
 */
import { describe, expect, it } from 'vitest';

import {
  LEGAL_ENTITY,
  formatEnterpriseNumber,
  formatVatNumber,
} from './legal';

describe('formatEnterpriseNumber', () => {
  it('10자리 → 0000.000.000 표기', () => {
    expect(formatEnterpriseNumber('1037548919')).toBe('1037.548.919');
  });

  it('10자리 아님 → raw 그대로 (가공 금지, P1)', () => {
    expect(formatEnterpriseNumber('123')).toBe('123');
    expect(formatEnterpriseNumber('BE1037548919')).toBe('BE1037548919');
    expect(formatEnterpriseNumber('')).toBe('');
  });
});

describe('formatVatNumber', () => {
  it("'BE'+10자리 → 'BE 0000.000.000' 표기", () => {
    expect(formatVatNumber('BE1037548919')).toBe('BE 1037.548.919');
  });

  it('형식 불일치 → raw 그대로', () => {
    expect(formatVatNumber('1037548919')).toBe('1037548919');
    expect(formatVatNumber('NL123456789B01')).toBe('NL123456789B01');
  });
});

describe('LEGAL_ENTITY 계약', () => {
  it('식별번호는 raw 값 (가공 전 저장)', () => {
    expect(LEGAL_ENTITY.enterpriseNumber).toBe('1037548919');
    expect(LEGAL_ENTITY.vatNumber).toBe('BE1037548919');
  });

  it('VAT = BE + 기업번호 일관성', () => {
    expect(LEGAL_ENTITY.vatNumber).toBe(`BE${LEGAL_ENTITY.enterpriseNumber}`);
  });

  it('주소 미수령 — null (P1 추측 금지)', () => {
    expect(LEGAL_ENTITY.address).toBeNull();
  });

  it('연락 이메일 존재', () => {
    expect(LEGAL_ENTITY.contactEmail).toContain('@');
  });
});
