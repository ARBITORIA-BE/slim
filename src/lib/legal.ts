/**
 * 사업자 법적 식별정보 단일 출처 (PLAN 4.10.a).
 *
 * 왜 단일 출처인가:
 *   벨기에 경제법전(CDE) Art. III.74 + XII.6 — 기업번호·VAT·법인명·연락처를
 *   모든 페이지에서 접근 가능하게 표시해야 한다. 여러 소비처(전역 footer,
 *   법무 페이지, 향후 인보이스)가 같은 값을 참조하므로 오타·불일치 리스크를
 *   단일 상수로 제거한다. (SITE_ORIGIN 단일화 패턴과 동형 — src/lib/site.ts)
 *
 * 값 출처: 운영자 제공 (2026-05-23). 회사번호 = KBO/BCE enterprise number.
 *   VAT = 기업번호에 'BE' 접두 (벨기에 관례).
 */

export interface LegalAddress {
  readonly street: string;
  readonly postalCode: string;
  readonly city: string;
  readonly country: string;
}

export interface LegalEntity {
  /** 법인명 — 개인사업자이므로 운영자 성명. */
  readonly legalName: string;
  /** KBO/BCE 기업번호 (raw, 10자리 숫자). */
  readonly enterpriseNumber: string;
  /** VAT 번호 (raw, 'BE' + 기업번호). */
  readonly vatNumber: string;
  /**
   * 등록 사업장 주소.
   * null = 미수령 → footer 에서 주소 줄 비노출 (헌법 P1: 추측 주소 금지).
   * 운영자 제공 시 채운다 (1줄 변경).
   */
  readonly address: LegalAddress | null;
  /** 법적 고지/문의 연락 이메일. */
  readonly contactEmail: string;
}

export const LEGAL_ENTITY: LegalEntity = {
  legalName: 'Kim Wonmin',
  enterpriseNumber: '1037548919',
  vatNumber: 'BE1037548919',
  // why: 등록 주소 미수령 (2026-05-23). 추측 주소를 넣지 않는다 — P1.
  address: null,
  contactEmail: 'kim.wonmin91@gmail.com',
};

/**
 * 기업번호 raw → 벨기에 관례 표기 (0000.000.000).
 * 예: '1037548919' → '1037.548.919'
 * why: 10자리가 아니면 raw 를 그대로 반환 — 잘못된 값을 가공해 그럴듯하게
 *      보이게 하지 않는다 (P1, 헌법 §8 #2 "가공하지 않는다").
 */
export function formatEnterpriseNumber(raw: string): string {
  if (!/^\d{10}$/.test(raw)) return raw;
  return `${raw.slice(0, 4)}.${raw.slice(4, 7)}.${raw.slice(7, 10)}`;
}

/**
 * VAT raw → 벨기에 관례 표기 (BE 0000.000.000).
 * 예: 'BE1037548919' → 'BE 1037.548.919'
 * 'BE' + 10자리 형식이 아니면 raw 를 그대로 반환 (방어적).
 */
export function formatVatNumber(raw: string): string {
  const m = /^BE(\d{10})$/.exec(raw);
  if (!m || m[1] === undefined) return raw;
  return `BE ${formatEnterpriseNumber(m[1])}`;
}
