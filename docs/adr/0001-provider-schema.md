# ADR-0001: `provider` 테이블 스키마 (공급사 마스터)

## Status

Accepted (2026-05-09) — verifier 통과: typecheck/lint/test/migration-sql/harness:plan 모두 통과. 마이그레이션 `drizzle/0000_amusing_cyclops.sql` 생성됨.

## Context

- PLAN 항목 **1.1** — 페이즈 1.A 데이터 레이어 첫 번째 테이블. 이후 1.2 `tariff`, 1.3 `tariff_snapshot`, 4.1 `affiliate_click`이 모두 이 테이블의 `id`를 외래키로 참조한다.
- **운영 주체 = BE 자영업자 (BTW 1037.548.919, Nivelles)**. 어필리에이트 정산은 intra-EU B2B 거래로 발생하며, 상대 공급사의 VAT ID 형식·검증 가능성이 우리의 부가세 처리(리버스 차지 vs 21% 청구)를 결정한다.
- **P3 (투명성)** 은 **비교에서 제외된 공급사도 이름을 밝힌다**. 즉 `provider` 테이블은 비교 가능 공급사뿐 아니라 "API 미제공으로 제외" 같은 정보용 레코드도 담아야 한다 — 전용 컬럼 필요.
- **P4 (어필리에이트 디스클로저)** 의 단가 공개는 `affiliate_status` 가 단순 boolean이 아니라 **세무·계약 상태**를 반영해야 한다. BE 내 거래는 BTW 21%, intra-EU는 리버스 차지로 다르게 처리되기 때문이다.

### 외부 사실 (검증된 출처)

- **EU VAT ID 형식** — 위키피디아 [VAT identification number](https://en.wikipedia.org/wiki/VAT_identification_number):
  - BE: `BE` + 10자리 (1999년부터 0/1로 시작; 1로 시작하는 신형이 본 운영 주체 케이스)
  - NL: `NL` + 9자리 + `B` + 2자리 (예: `NL123456789B01`)
  - LU: `LU` + 8자리
- **VIES** — [EU 부가세 검증 API](https://ec.europa.eu/taxation_customs/vies/) 가 EU 회원국 VAT ID의 유효성을 실시간 검증한다. 리버스 차지 적용의 법적 근거가 되므로 **마지막 검증 시각**을 우리가 보관해야 한다 (감사 대비).

## Decision

### 1. 컬럼 (총 13개)

| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| `id` | `uuid` | PK, `defaultRandom()` | 1.3 / 4.1 외래키 대상 |
| `country` | `pgEnum('country', ['BE','NL','LU'])` | NOT NULL | 베네룩스 한정 |
| `name` | `text` | NOT NULL | 표시용 (예: "Engie") |
| `legal_name` | `text` | NOT NULL | 법인명 (예: "Engie Electrabel SA") |
| `slug` | `text` | UNIQUE, NOT NULL | URL용, kebab-case (예: `engie-be`) |
| `vat_id` | `text` | UNIQUE, NULL 허용 | EU VAT ID. 일부 소규모 미등록 가능 |
| `vat_id_verified_at` | `timestamptz` | NULL 허용 | VIES 마지막 확인. 1.6 워커가 갱신 |
| `website` | `text` | NOT NULL | 공식 사이트 (3층 원본 링크용) |
| `affiliate_status` | `pgEnum('affiliate_status', [6값])` | NOT NULL, 기본 `'none'` | 아래 §2 |
| `excluded_reason` | `text` | NULL 허용 | P3용. 비어있으면 "비교 가능" |
| `created_at` | `timestamptz` | NOT NULL, `defaultNow()` | |
| `updated_at` | `timestamptz` | NOT NULL, `defaultNow()` + `$onUpdate` | Drizzle 0.36 API |

> 모든 시간 컬럼은 `withTimezone: true` (Postgres `timestamptz`). Vercel/Neon이 UTC로 통일되도록.

### 2. `affiliate_status` enum (6값)

세무/계약 상태를 분리한다.

- `none` — 어필리에이트 관계 없음. 정보용으로만 비교에 포함.
- `pending` — 협상 중. 결과 페이지에는 일반 외부 링크로 노출.
- `active_b2b_intra_eu` — 계약 체결, **리버스 차지 (BTW 0%)**. NL/LU 공급사가 일반적.
- `active_b2b_domestic_be` — BE 내, **BTW 21% 청구**. BE 공급사 + Slim 운영 주체가 BE 자영업자라서 도메스틱 룰 적용.
- `paused` — 일시 중단 (가격 신뢰도 이슈, 정산 분쟁 등). 비교 가능하지만 "변경하기" CTA 비활성.
- `terminated` — 종료. `excluded_reason` 동반 권장.

### 3. 인덱스 / 제약

- `slug` UNIQUE
- `vat_id` UNIQUE (NULL 다수 허용 — Postgres 기본 동작)
- `(name, country)` UNIQUE 인덱스 — 한 나라 안에서 같은 이름 중복 방지
- `affiliate_status` 인덱스 — 어드민 대시보드 필터용 (페이즈 6.1)

### 4. 핵심 트레이드오프

- **`country` enum (3값) 고정** vs `text`. Enum 채택 — 베네룩스 한정 정책이 P0이다. 5.x에서 확장이 필요하면 ADR로 추가.
- **`affiliate_status` 6값 enum** vs `boolean is_partner`. 6값 채택 — 단순 boolean으로는 BTW 처리·일시 중단·디스클로저 단가가 다 무너진다.
- **`vat_id`를 `provider`에 직접** vs `legal_entity` 별도 테이블. 직접 채택 — YAGNI. 한 공급사당 한 법인이 베네룩스 99% 케이스. 다중 법인이 나오면 그때 분리 (ADR-XXXX).
- **`excluded_reason: text`** vs 별도 `excluded` boolean. 단일 컬럼 채택 — `NULL` = "비교 가능", `NOT NULL` = "제외 + 사유". 어드민이 사유를 강제로 적게 된다.

## Consequences

### 좋은 결과

- 1.2 `tariff`, 1.3 `tariff_snapshot`, 4.1 `affiliate_click` 가 깨끗한 `provider_id` FK로 시작 가능.
- BTW 정산이 `affiliate_status` 단일 enum으로 결정 — 회계 자동화 여지.
- P3 "제외된 공급사도 이름 공개"가 스키마 수준에서 강제됨 (`excluded_reason` 단일 텍스트 필드).
- `vat_id_verified_at` 가 GDPR 처리 등록부의 "VAT ID는 정산 목적 공식 데이터"라는 근거 자료로 직접 활용됨 (페이즈 6.8).

### 나쁜 결과 / 부채

- `affiliate_status` enum 변경은 Postgres에서 무거운 마이그레이션 (`ALTER TYPE`). 6값을 신중히 선택해야 한다 — 본 ADR이 경계 결정.
- `vat_id` 검증을 우리가 책임진다 — 페이즈 1.6의 cron에 VIES 워커가 추가되어야 한다 (후속 작업).
- BE/NL/LU 외 공급사가 추후 필요해지면 `country` enum 확장 + 마이그레이션. 지금은 의도된 제약.

### 후속 작업 (다른 PLAN 항목과 연결)

- **1.2** `tariff.provider_id` → `provider.id` FK (`onDelete: restrict` 권장)
- **1.3** `tariff_snapshot` 도 결국 `provider_id`까지 따라온다
- **1.6** Inngest cron에 **VIES 검증 워커** 추가 — `affiliate_status IN ('pending','active_b2b_*')` 인 행의 `vat_id_verified_at`을 일 1회 갱신
- **4.1** `affiliate_click.provider_id` FK
- **6.8** GDPR 처리 등록부에 **"공급사 VAT ID 보유"** 항목 추가 — 법적 근거 GDPR Art. 6(1)(c)/(f) (계약 이행 / 정당한 이익, 세무 의무)
- **6.9** `/legal/affiliate-disclosure` 가 `affiliate_status IN ('active_b2b_*')` 만 표시하고 단가 공개

## Alternatives considered

### A. `affiliate_status: boolean is_partner` (거부)

- 장점: 단순. 어드민 UI 토글 한 개.
- 단점: BTW 21% vs 0% 분기를 코드 레이어로 밀어내어 회계 버그 위험. paused/terminated 상태 표현 불가 → P3 위반 (제외 사유 추적 불가).
- **거부 사유**: 운영 주체가 BE 자영업자라서 세무 분기가 데이터 모델 책임이다.

### B. `vat_id`를 `legal_entity` 별도 테이블로 분리 (거부)

- 장점: 한 공급사가 여러 법인을 운영하는 케이스 (예: Engie BE / Engie NL 별 법인) 깔끔하게 표현.
- 단점: 페이즈 1에서 1:N 관계가 필요한 사례가 0건. 조인 1회 추가의 런타임 비용 + 복잡도.
- **거부 사유**: YAGNI. 베네룩스 99% 케이스에서 1 공급사 = 1 법인. 향후 필요 시 별도 ADR로 분리하면 데이터 마이그레이션 비용도 작다 (`provider.vat_id` → `legal_entity.vat_id`).

### C. `country: text` (거부)

- 장점: 5.x에서 확장 자유로움.
- 단점: 오타·소문자 등 더러운 데이터 진입. Drizzle 타입 안전성 손실.
- **거부 사유**: P4 (타입 안전). 베네룩스 외 확장은 ADR을 통한 명시적 결정 사건이어야 한다.

## 검증 방법

- `pnpm typecheck` 0 에러 (P4)
- `pnpm db:push` 드라이런으로 마이그레이션 SQL 생성 — verifier가 수행
- 후속 시드 데이터 (페이즈 1.8 fetcher 3개) 가 `country='BE'`, `affiliate_status='pending'` 또는 `'none'` 으로 깨끗이 들어가는지 확인
- VIES 워커(1.6) 도입 후 `vat_id_verified_at` 가 NULL이 아닌 행 비율을 모니터링 (목표: active_b2b_* 100%, pending 80%+)
