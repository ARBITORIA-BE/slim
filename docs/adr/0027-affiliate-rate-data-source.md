# ADR-0027: Affiliate rate data source — static TS const

## Status

**Accepted** (2026-05-13 — architect 권고, 운영자 최종 결정).
ADR-0026 §T4 의 "builder 결정" 표현을 본 정식 결정으로 격상. 옵션 C(정적 TS const) 채택 이유 명시 (AD-0026 §Alternatives 참조). 격상 트리거(계약 ≥ 6건 OR 분기 ≥ 2회 변경) 충족 시 옵션 B(별도 테이블) 재평가 → ADR Amendment 또는 신규 ADR-0028.

## Context

- **정책 배경**: ADR-0026 §T4 에서 제휴 수수료 단가의 데이터 출처를 3가지 옵션으로 열어두었다 — (a) `provider`/`tariff` 테이블 컬럼, (b) 별도 `affiliate_agreement` 테이블, (c) 정적 TS const. PLAN 4.3.a 에서 architect 가 분석한 결과, 현 시점(계약 ≤ 5건, €300/월 솔로 인프라 cap) 에서는 **옵션 C 가 최적**.
- **헌법 근거**: P1 (정보 우선 — 단가에도 출처 필드), P3 (투명성은 운영자의 짐 — 정산 데이터는 코드로 관리, 사람이 읽을 수 있음), §8 #4 (광고-비교 분리 — 제휴 정산이 마스터 데이터 스키마를 오염하지 않음).
- **비즈니스 컨텍스트**: 베네룩스 B2B 텔레컴 제휴 시장에서 CPA(Cost Per Action) flat fee 단가 계약이 표준. 운영자가 분기에 1~2회 계약을 손으로 갱신하는 수준(대량 네트워크 API 없음). 관계형 설계의 복잡도 대비 현재 비용 편익이 맞지 않음.
- **격상 근거**: PLAN 4.3 분해에서 이 선택이 "builder 결정" 에서 ADR로 격상된 이유는, 금융·정산 데이터 모델이 헌법 P1·P3 를 직접 강제할 정도의 중요성이 있기 때문.

## Decision

**5개 결정 (T1~T5).**

### T1 — 옵션 C 채택: 정적 TS const (`src/data/affiliate-rates.ts`)

`src/data/affiliate-rates.ts` 에 TypeScript const 배열로 제휴 단가 데이터를 관리한다. 운영자가 계약 변경 시 1줄 추가/수정 → PR 1건 → 빌드/배포의 표준 워크플로. 마이그레이션 0건, 데이터 스키마 변경 0건.

```typescript
// src/data/affiliate-rates.ts 예시
import { z } from 'zod';

export const AffiliateRateSchema = z.object({
  providerId: z.string().uuid('Provider UUID'),
  currency: z.literal('EUR'),
  amountCents: z.number().int().min(0),  // 단가 (cents), commission_amount_cents와 동일 단위
  commissionType: z.literal('CPA'),  // Cost Per Action flat fee
  source: z.string().nonempty(),  // 계약 PDF 경로 + 페이지 (예: "contracts/Proximus-2026-05.pdf#p2")
  fetchedAt: z.string().datetime().or(z.string().date()),  // ISO 8601, 계약 확인 일자
  effectiveFrom: z.string().date(),  // 유효 시작일 (ISO 8601)
  effectiveTo: z.string().date().optional(),  // 유효 종료일 (NULL = 무기한)
});

export type AffiliateRate = z.infer<typeof AffiliateRateSchema>;

export const AFFILIATE_RATES: AffiliateRate[] = [
  {
    providerId: '550e8400-e29b-41d4-a716-446655440001',  // Proximus
    currency: 'EUR',
    amountCents: 500,  // €5.00 per conversion
    commissionType: 'CPA',
    source: 'contracts/Proximus-2026-05.pdf#p2',
    fetchedAt: '2026-05-13',
    effectiveFrom: '2026-05-01',
    effectiveTo: undefined,  // 무기한
  },
  // ... 더 많은 계약
];

/**
 * 헬퍼: 공급사별 활성 단가 조회
 * @param providerId - provider.id UUID
 * @param affiliateStatus - provider.affiliate_status (ADR-0001 enum)
 * @returns 활성 단가 또는 null
 * 
 * 반환 대상: affiliate_status IN ('active_b2b_intra_eu', 'active_b2b_domestic_be')
 * 반환 안 함: 'pending', 'none', 'paused', 'terminated'
 */
export function getRateForProvider(
  providerId: string,
  affiliateStatus: string,
): AffiliateRate | null {
  const now = new Date();
  const activeStatuses = ['active_b2b_intra_eu', 'active_b2b_domestic_be'];
  
  if (!activeStatuses.includes(affiliateStatus)) return null;
  
  return AFFILIATE_RATES.find(
    rate =>
      rate.providerId === providerId &&
      new Date(rate.effectiveFrom) <= now &&
      (rate.effectiveTo ? new Date(rate.effectiveTo) >= now : true),
  ) ?? null;
}
```

### T2 — 필드 정의 (6개 필드 강제)

| 필드 | 타입 | 설명 | 강제 |
|---|---|---|---|
| `providerId` | `string` (UUID) | `provider.id` | FK처럼 동작, 런타임 검증 (4.3.e) |
| `currency` | `'EUR'` literal | 통화 | 베네룩스 고정 |
| `amountCents` | `number` (정수) | 단가 (센트) | `affiliate_click.commission_amount_cents` 와 동일 단위 + 정합 검사 (4.3.e) |
| `commissionType` | `'CPA'` literal | 정산 유형 | BE 텔레컴 표준은 CPA flat fee (장기 옵션 B 고려: `'CPL'` / `'CPS'` 추가) |
| `source` | `string` | 출처 (계약 PDF 경로/페이지) | P1 강제 — 어트리뷰션 단가도 출처를 가짐 |
| `fetchedAt` | ISO 8601 string | 운영자가 단가를 확인한 일자 | P1 강제 — 정산 기록의 증빙 |
| `effectiveFrom` | ISO 8601 date | 유효 시작일 | 계약 유효기간 추적 (upgrade 트리거) |
| `effectiveTo` | ISO 8601 date \| undefined | 유효 종료일 (NULL = 무기한) | 계약 수정/종료 추적 |

### T3 — 헬퍼 함수 동작: `getRateForProvider(providerId, affiliateStatus)`

```typescript
getRateForProvider(providerId: string, affiliateStatus: string): AffiliateRate | null
```

동작:
- Input: `providerId` (provider.id) + `affiliateStatus` (provider.affiliate_status enum 6값)
- Filter: `affiliateStatus IN ('active_b2b_intra_eu', 'active_b2b_domestic_be')` 만 반환. 그 외(`'pending'`, `'none'`, `'paused'`, `'terminated'`) 은 `null` 반환 (ADR-0026 §T4 "표시 대상" 정합).
- Filter: 유효기간 필터 — `now >= effectiveFrom && (effectiveTo ? now <= effectiveTo : true)`
- Return: 첫 일치 `AffiliateRate` 또는 `null`.

용도:
- `/legal/affiliate-disclosure` 페이지가 const 를 import 해 `getRateForProvider()` 로 공개 대상 단가 렌더.
- `bias-audit` 하네스가 const 를 import 해 `affiliate_click.commission_amount_cents` 와 정합 검사 (4.3.e).
- UI 컴포넌트(`AffiliateDisclosureLine` 등, 4.3.c)가 필요하면 const 를 직접 import.

### T4 — 격상 트리거 (옵션 B 재평가 조건)

이 const 방식은 **다음 두 조건 중 하나 만족 시** 옵션 B(별도 테이블 `affiliate_agreement`)로의 migration 을 검토해야 함:

1. **제휴 계약 ≥ 6건**
   - 현재: ≤ 5건 (Proximus / Telenet / Orange BE / Verizon(테스트) / KPN(미래) 등)
   - 임계: 6건 도달 → const 배열 크기 관리의 복잡도 상승
   
2. **분기당 변경 ≥ 2회**
   - 현재: 분기 1회 미만 (계약 연간 갱신)
   - 임계: 분기 2회 이상 → PR 1건/회의 오버헤드가 누적 + 데이터 병렬성 요구(시간대 기반 조회)

임계 도달 시:
- ADR-0027 Amendment (작은 변경) 또는 ADR-0028(새로운 `affiliate_agreement` 테이블)로 전환 검토.
- 옵션 B 마이그레이션 사유: (i) `affiliate_agreement` 테이블로 계약 메타(기간, 유형, 갱신 주기) 관리 + (ii) 런타임 쿼리로 현재 활성 단가 조회 + (iii) 시간대 기반 정산(프로모/대량 할인) 지원.

### T5 — P1 / P3 정합 강제 (코드 레벨 + 게이트)

- **P1 (정보 우선)**: 모든 entry 마다 `source` + `fetchedAt` NOT NULL (스키마 / Zod validation 강제).
  - 의미: 어트리뷰션 단가도 *출처를 가진다*. "이 €5 수수료가 정말 Proximus 계약에서 온 것인가?" 를 사용자가 검증 가능.
  - `/legal/affiliate-disclosure` 페이지에서 단가 표시할 때 `source` 링크 포함 (또는 각주 표시).

- **P3 (투명성은 운영자의 짐)**: 
  - `getRateForProvider()` 는 `active_b2b_*` 필터를 *코드로 강제* (ADR-0026 §T4 "표시 대상" 일관).
  - `bias-audit` 하네스가 이 const 를 런타임에 정합 검사 — `affiliate_click.commission_amount_cents` 와 같은 계약의 같은 단가가 두 곳이 다르면 **fail** (4.3.e).
  - 단가 변경 commit 메시지는 "chore(affiliate): 단가 갱신 — [공급사명] €X (계약 링크)" 형태 (변경 이력이 git log 에 남음).

## Alternatives considered

### (a) `provider` 또는 `tariff` 테이블에 `commission_rate_*` 컬럼 추가 — 거부

**장점:**
- (i) 관계형 정규화: 공급사마다 1행, 단가는 그 행의 컬럼.
- (ii) 데이터 스키마가 "마스터" 로 보임.

**단점:**
- (i) **헌법 §8 #4 위반 가능성**: 제휘 정산(commission)이 공급사 마스터 데이터(비교 알고리즘 입력)에 침투 → 광고-비교 영역 분리 모호화. 예를 들어 `provider.commission_amount` 가 있으면 미래에 "공급사 A 단가가 높으니 순위 올려주기" 식 요청이 들어올 가능성 상승.
- (ii) **마이그레이션 비용**: 기존 `provider` 스키마를 변경하려면 `drizzle/000X_*` 마이그레이션 + 기존 환경(production/preview/development 3갈래, ADR-0022)에서 데이터 일관성 유지 필요. 솔로 컨텍스트 + €300 cap 에서 과중.
- (iii) **갱신 오버헤드**: 계약이 바뀔 때마다 `provider` 행을 UPDATE. 만약 일부 공급사만 변경되면 다른 공급사는 냅둬야 함 → 의도하지 않은 이전 버전 혼용 위험. 시계열 버전 관리가 필요해지면 (b) 와 동등 복잡도.

**거부 이유**: 마이그레이션 비용 + 헌법 §8 #4 모호화 + €300 cap 부조화.

---

### (b) 별도 `affiliate_agreement` 테이블 (데이터 정규형) — 거부 아님, 지연 결정

**장점:**
- (i) 시계열 관리: `effective_from`/`effective_to` 로 계약 유효기간 추적 → DB 로 현재 활성 단가 쿼리 가능.
- (ii) 마스터 데이터 깨끗함: `provider` / `tariff` 는 순수 비교 데이터, 정산은 별도 테이블.
- (iii) 기존 마이그레이션 부담 0 (새 테이블이지 기존 수정 없음).
- (iv) 관계형 정규화 최고 형태.
- (v) 제휴 네트워크 도입 시(Impact/PartnerStack) 쉬운 확장 — `affiliate_agreement.network` 컬럼 추가.

**단점:**
- (i) **현 시점 비용 대비 가치 낮음**: 계약 5건, 변경 분기 1회 미만 → JOIN 오버헤드 vs 이득 비율 불리. `getRateForProvider()` 의 배열 선형 탐색(`find`)이 SQL JOIN 보다 빠름(작은 배열).
- (ii) **시간 비용**: 테이블 설계 + 마이그레이션 SQL + 추가 index + 쿼리 최적화 → architect/builder 시간 투자 3~5시간 (€300 cap + 솔로).
- (iii) **운영 난이도**: 계약 추가/수정 시 운영자가 SQL UPDATE 쓸 수 없음 → 어드민 UI 또는 builder 에게 PR 의뢰 필요 (const 처럼 PR 1건은 똑같지만, 데이터 검증이 더 복잡).
- (iv) **격상 트리거가 현시점에 미충족**: 계약 5건 < 6건 임계.

**거부 아님, 지연 결정**: T4 격상 트리거(계약 ≥ 6건 OR 분기 ≥ 2회 변경) 도달 시 → 본 ADR Amendment 또는 ADR-0028 로 옵션 B 재평가 + 마이그레이션 결정.

---

### (c) 정적 TS const (`src/data/affiliate-rates.ts`) — **채택**

**장점:**
- (i) **구현 즉시 가능**: 파일 1개 생성 + const 배열 정의 + helper function 2줄 → 1시간 내외.
- (ii) **출처 강제**: `source` + `fetchedAt` 필드가 const entry 마다 NOT NULL → P1 자동 달성. DB 컬럼보다 더 간단히 출처 명시.
- (iii) **git history 활용**: PR title/description 에 계약 링크 + 변경 이유 명시 → 정산 이력이 git log 에 자동 기록 (감사 추적).
- (iv) **마이그레이션 0**: 기존 스키마 수정 없음.
- (v) **운영자 접근성**: 코드를 읽을 줄 아는 운영자라면 직접 수정 가능(PR 과정 거쳐서 code review 자동).
- (vi) **테스트 용이**: 단위 테스트(`affiliate-rates.ts`)에서 `AffiliateRateSchema` validation 강제 + 샘플 매칭 테스트.
- (vii) **€300 cap 정합**: 추가 인프라/쿼리 비용 0 (런타임 선형 탐색, 메모리 < 10KB).

**단점:**
- (i) **배열 크기 관리**: 계약 20개 넘으면 수동 관리 복잡도 상승 (하지만 T4 트리거가 6건에서 이미 경고).
- (ii) **이력 추적 불가**: DB 같은 시간대별 다중 계약 버전(A/B 테스트 등) 미지원. 현재 선형적 `effectiveFrom/To` 만 가능.
- (iii) **동시 수정 분산 위험**: 여러 팀이 동시에 같은 const 배열을 수정하면 git merge conflict. 현재 솔로이지만 미래 확장 시 고려 필요(→ 옵션 B 마이그레이션 신호).
- (iv) **배포 이후 즉시 반영 불가**: const 변경 = 빌드 + 배포(Vercel, 수 분). DB UPDATE 대비 1시간 느림. 하지만 현재 계약 변경 빈도(분기 1회)에서는 무시할 수준.

**채택 이유**: 현 시점(계약 ≤ 5, 변경 분기 1회 미만, €300 cap, 솔로)에서 **구현 비용 최소** + **출처 강제** + **git 감사 추적 자동** 조합이 가장 효율적. 미래 확장(계약 6+, 분기 2회)에서 자동으로 옵션 B 마이그레이션으로 진화 가능한 설계.

## Consequences

### 얻는 것

- ✅ **P1 (정보 우선) 자동 달성**: `source` + `fetchedAt` 필드가 const 마다 강제 → 모든 단가가 출처를 가짐.
- ✅ **P3 (투명성) 강화**: 단가 변경이 git commit 으로 기록 → 운영자·감사자가 "언제 어떤 계약이 몇 €로 변했나" 를 git log 에서 추적 가능.
- ✅ **헌법 §8 #4 (광고-비교 분리) 강화**: 정산 데이터가 공급사 마스터 스키마 밖 → 비교 알고리즘은 순수하게 유지.
- ✅ **구현 속도**: 1시간, 마이그레이션 0.
- ✅ **운영 비용**: 추가 인프라(테이블/index/쿼리) 0 + 추가 운영 복잡도 0.

### 잃는 것 / 부채

- ⚠️ **배열 크기 관리 부채**: 계약 6건 이상 시 수동 배열 관리 복잡도 상승 → T4 격상 트리거 설정으로 모니터링.
- ⚠️ **다중 버전(이력) 미지원**: DB 처럼 "2026-05 기간에는 €5, 2026-06 기간에는 €6" 같은 다층 관리 불가. `effectiveFrom/To` 선형 추적만 가능. 시간대별 버전 컨트롤이 필요해지면 옵션 B로 마이그레이션.
- ⚠️ **배포 지연**: 계약 변경 후 운영 반영까지 빌드 + 배포 수 분. 긴급 단가 수정이 필요하면 수동 hotfix 필요(현재는 불필요 시나리오, 격상 트리거 재평가 대상).

### 후속 작업

- **PLAN 4.3.b** — `src/data/affiliate-rates.ts` 신설 + `AffiliateRate` 타입 + `getRateForProvider()` 헬퍼 (builder).
- **PLAN 4.3.c** — UI 컴포넌트 `src/app/r/[shortId]/_components/AffiliateDisclosureLine.tsx` (4.4 동시 충족, builder).
- **PLAN 4.3.d** — `/legal/affiliate-disclosure` 페이지: const 를 import 해 공개 대상 단가 테이블 렌더 (legal 에이전트 검토).
- **PLAN 4.3.e** — 테스트:
  - (i) 정합: `affiliate-rates.ts` entry 의 `amountCents` vs 샘플 `affiliate_click.commission_amount_cents` 매칭 (단위 테스트).
  - (ii) 헬퍼: `getRateForProvider()` 의 필터 로직(affiliateStatus / 유효기간) 테스트.
  - (iii) `bias-audit` 확장: const 를 import 해 런타임 정합 검사 (주간 하네스).
- **ADR-0026 §T4 정리** — "builder 결정" → "ADR-0027 정식 결정(2026-05-13)" 으로 1줄 cross-ref.

## Verification

**구현 완료 (2026-05-13, 커밋 17cec6a): `src/data/affiliate-rates.ts` 신설 + 23 단위 테스트 → §T1~T5 충족.**

1. **파일 신설** ✅: `src/data/affiliate-rates.ts` 존재 + TypeScript 컴파일 통과 + Zod schema validation 통과.
2. **타입 검증** ✅: `AffiliateRate` 타입이 8 필드(providerId/currency/amountCents/commissionType/source/fetchedAt/effectiveFrom/effectiveTo?) 전부 포함 + 인터페이스 정의.
3. **헬퍼 검증** ✅: `getRateForProvider(providerId, affiliateStatus)` 함수 존재 + 필터 로직(affiliateStatus `active_b2b_*` 2값 분기 통과, 나머지 4값 null 반환, 유효기간 필터) 23 테스트 케이스로 검증.
4. **P1 강제** ✅: 모든 entry 의 `source` / `fetchedAt` 가 NOT NULL/empty + ISO 8601 형식 (테스트 6 케이스로 단언, Zod validation 강제).
5. **헌법 §8 #4 회귀** ✅: `src/engine/compare.ts` + `src/engine/**` 에서 affiliate-rates.ts import 0건 (정적 grep verify + compare.isolation.test.ts 18 통과 유지).
6. **`/legal/affiliate-disclosure`**: const 를 import 해 공개 대상 단가 렌더 + `source` 링크/각주 표시 (4.3.d 구현 후 확인).
7. **정합 테스트**: `affiliate-rates.ts` entry 와 샘플 `affiliate_click` 행의 `amountCents` 매칭 (4.3.e green 대기).
8. **`bias-audit` 정정**: const import 후 런타임 정합 검사 동작 (4.3.e green 대기).
9. **git history**: PLAN 4.3.b 커밋 "feat(plan-4.3.b): src/data/affiliate-rates.ts + 헬퍼 + 단위 테스트" 기록.

**회귀 트리거 (격상 조건 재평가):**
- (a) 제휴 계약 ≥ 6건 도달 → ADR-0027 Amendment 또는 ADR-0028 (테이블 마이그레이션) 검토 신설.
- (b) 분기 변경 ≥ 2회 도달 → 동일.
- (c) 계약 이력 추적(시간대별 다중 버전)이 필요해지면 → 동일.

## References

- 헌법: [`CLAUDE.md`](../../CLAUDE.md) — P1 (정보 우선 — 모든 데이터 출처), P3 (투명성 = 운영자의 짐 — git 감시추적), §8 #4 (광고-비교 분리 — 정산이 마스터 오염 X).
- 관련 ADR:
  - [ADR-0026](0026-affiliate-click-and-attribution.md) §T4 — 본 ADR 이 "builder 결정" 을 격상함. T4 §"정식 결정(2026-05-13)" 블록 참조.
  - [ADR-0001](0001-provider-schema.md) — `provider.affiliate_status` enum 6값 (`active_b2b_intra_eu` / `active_b2b_domestic_be` / 기타).
  - [ADR-0004](0004-monetization-solo-side-rebalance.md) — €300/월 cap 컨텍스트.
  - [ADR-0022](0022-database-environment-separation.md) — DB 환경 분리 (const 에는 무관).
- PLAN: [`PLAN.md`](../../PLAN.md) §4.3 (PLAN 4.3.a~e 분해, 4.3.a = 본 ADR).
- 외부 사실: 베네룩스 B2B 텔레컴 제휴 = CPA flat fee 표준 (구글/아마존 affiliate 문헌 참조 — 장기 조정 대상).
