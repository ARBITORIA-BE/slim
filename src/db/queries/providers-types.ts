/**
 * Provider/tariff query 반환 타입 — DB import 없는 순수 타입 모듈.
 *
 * providers.ts (DB 쿼리) + providers-helpers.ts (순수 변환) 둘 다 사용.
 * 분리 이유: providers-helpers.ts 가 db import 회피하면서도 같은 타입 공유.
 */

export interface ActiveProvider {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export interface ActiveTariff {
  readonly id: string;
  readonly providerId: string;
  readonly name: string;
  readonly slug: string;
}
