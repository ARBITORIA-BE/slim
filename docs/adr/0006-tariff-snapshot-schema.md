# ADR-0006: `tariff_snapshot` 테이블 스키마 (가격 시계열)

## Status

Proposed (2026-05-09) — PLAN 항목 **1.3** 데이터 레이어 세 번째 테이블. verifier
가 typecheck/lint/test/migration-sql/harness:plan/harness:data 통과 확인 후
Accepted로 격상한다.

## Context

- PLAN 항목 **1.3**. 1.1 `provider`(ADR-0001) + 1.2 `tariff`(ADR-0005)에 이은
  세 번째 테이블. **시계열 단독 책임** — ADR-0005 §결정 5(T5)의 마스터/스냅샷
  분리 원칙을 직접 받는다.
- ADR-0005 §영향에 명시된 1.3 컬럼 셋(`tariff_id`, `fetched_at`, `source_url`,
  `raw_payload jsonb`, `confidence enum`, `monthly_price_cents_at_fetch`)을
  본 ADR이 확정한다.
- **`harness:data` Rule 4**(`scripts/harness/data-fidelity.ts:81-113`)는 현재
  `tariff_snapshot` 스키마 부재로 `schema-tariff-snapshot-missing` warn을 1건
  발생시킨다. 본 ADR의 스키마가 머지되면 warn → 통과 (`source_url.notNull` +
  `fetched_at.notNull` 정규식 매칭 통과).
- **운영자 컨텍스트** (`docs/FOUNDER.md`): 솔로 사이드, 월 €300 ALL-IN, Neon
  free tier (0.5 GB 스토리지). 페이즈 1.5.2 `harness:price` 일 1회 cron 입력.
  통신 요금제는 가격 변동 빈도가 낮음(분기/반기) → 매일 같은 데이터 중복 가능성
  ↑ → **리텐션 정책이 스키마 단계에서 명시되어야 함**.
- 1.11 비교 엔진의 hot path = "각 tariff의 *최신* 스냅샷 1건". 인덱스 설계가
  성능 결정.

### 외부 사실 (검증된 출처)

- **PostgreSQL 16 TOAST**: 2 KB 초과 컬럼 값은 자동 압축/외부 저장.
  [PG 16 — TOAST](https://www.postgresql.org/docs/16/storage-toast.html). →
  `raw_payload jsonb`가 큰 HTML 단편을 포함해도 행 자체 인덱스 비용은 영향 없음.
- **PostgreSQL 16 `DISTINCT ON`**: 정렬 순으로 첫 행만 반환. 적합한 인덱스가
  있으면 인덱스 스캔만으로 처리.
  [PG 16 — DISTINCT clause](https://www.postgresql.org/docs/16/sql-select.html#SQL-DISTINCT).
- **Neon Free tier 한계** (2026-05 기준): 0.5 GB 스토리지, 1개 프로젝트, 24시간
  미사용 시 자동 suspend. [Neon Pricing](https://neon.tech/pricing). →
  `raw_payload` 무제한 보존 시 fetcher 4개 × 일 1회 × 평균 5 KB × 365일 ≈ 7 MB/년
  (요금제 50개 가정). 위험은 작지만 **솔로가 6개월 후 fetcher가 잘못 폭주해**
  10~100배 데이터를 쌓는 시나리오는 실재 → 리텐션 정책 명시 필요.
- **ADR-0005 §결정 5(T5)**: `tariff` 마스터의 `valid_from/valid_to`는 제거됨.
  시계열은 `tariff_snapshot` 단독. 본 ADR은 이 분리를 *깨지 않는다*.

## Decision

T1~T7 7개 결정.

### T1 — Append-only insert. 라운딩/upsert 없음. (옵션 A 채택)

매 fetch가 새 row를 insert. 같은 `(tariff_id, fetched_at)` 중복도 그대로 보존.

**근거:**
- PLAN 1.6이 *일 1회 cron* (Inngest 무료 티어 한계). 정상 운영에서 같은 분에
  두 번 fetch 발생 시나리오는 거의 없음.
- 1.5.2 `harness:price` 일별 diff는 *append-only가 가장 정직한 입력*. 운영자가
  6개월 후 "왜 가격이 틀렸지?"를 디버깅할 때 모든 fetch 흔적이 살아있어야 함
  (P3 투명성).
- *수동* 재실행이나 fetcher 버그로 같은 시각 다중 insert가 발생해도 **데이터
  손실 없이 중복 흔적이 그대로 남는다** → 사후 분석 가능. upsert였다면 무엇이
  덮어졌는지 영원히 모름.
- `(tariff_id, fetched_at DESC)` 인덱스로 "최신 1건" 조회 비용은 동일.

**거부된 대안 — 옵션 B (분 단위 라운딩 후 upsert)**
- 장점: 운영자 수동 재실행 시 중복 노이즈 0.
- 단점: fetcher 버그(잘못된 파싱)가 *덮어쓰면서* 정상 데이터를 잃을 위험.
  솔로 운영자가 6개월 후 사실관계 추적 불가. P3 위반.

**거부된 대안 — 옵션 C (일 1회만 보존)**
- 장점: 스토리지 최소.
- 단점: 일 2회 cron으로 격상(트래픽 증가 시 PLAN 1.6에 명시) 시 스키마 자체
  변경. YAGNI 역방향 — 너무 일찍 제약.

### T2 — 가격 스냅샷 = 평탄화 핵심 컬럼 5개 + JSONB 미러 (옵션 C 채택)

**스냅샷 시점에 보존하는 cents 컬럼 (5개)**:
- `monthlyPriceCents` NOT NULL — 비교 엔진 1.11의 제1 입력
- `activationFeeCents` NOT NULL DEFAULT 0
- `modemRentalCents` NULL — 모바일 요금제는 NULL
- `promoPriceCents` NULL — 프로모 없으면 NULL
- `promoMonths` NULL

**+ `pricePayload jsonb`** — `tariff` 마스터에서 가격 관련 컬럼 *전체*를 미러
(보존). 미래 `early_termination_fee_cents`, `loyalty_discount_cents` 등 추가
필드도 fetcher 수정만으로 흡수.

**근거:**
- 비교 엔진 1.11의 hot path 입력은 평탄화된 5개 컬럼 — SQL `SELECT` + 정수
  산술. JSONB 추출(`->>`) 비용 0.
- 1.5.2 `harness:price` anomaly 감지는 `monthlyPriceCents` 일별 diff가 핵심
  (예: 어제 €25 → 오늘 €0 이면 fetcher 깨짐 의심). 평탄화 컬럼이 SQL diff에
  유리.
- `pricePayload`는 *감사 + 미래 호환*. ADR-0005의 `attributes` JSONB와 같은
  운영 패턴 — 컬럼화는 주류, JSONB는 진화 흡수.
- ADR-0005 §결정 4(T4) 프로모 평탄화와 일관 — 24개월 TCO 계산이 한 행에서
  가능 (1.12 12케이스 DoD).

**거부된 대안 — 옵션 A (`monthlyPriceCents` 1개만)**
- 장점: 스키마 최소. Neon free 0.5 GB 한계에 가장 친화.
- 단점: 1.11 비교 엔진이 24개월 TCO 계산 시 `tariff` 마스터 JOIN 필요. 마스터가
  *이후에 변경*되면 과거 비교 결과 재계산 시 거짓 결과(P1 위반). 즉 **"비교
  결과가 사용한 가격을 영원히 보존"** 원칙(P1, 결과 페이지 3.5 계산 근거)이
  깨짐.

**거부된 대안 — 옵션 B (모든 cents 컬럼 미러, JSONB 없음)**
- 장점: 평탄화만 — 인덱스/정렬 일관.
- 단점: 미래 가격 필드 추가 시 매번 마이그레이션. ADR-0005 §결정 1(T1)이
  attributes를 JSONB로 둔 같은 이유로 거부.

### T3 — `rawPayload jsonb` = 정규화된 JSON만 (HTML 단편은 별도 저장 X)

`rawPayload`는 fetcher가 페이지/API에서 추출 후 *정규화한* JSON. 원본 HTML은
보존하지 않음.

**스키마(권장, 강제 X)**:
```jsonc
{
  "fetcher_version": "proximus@2026-05-09",
  "url": "https://www.proximus.be/en/mobile-subscription/smart",
  "extracted": { /* 파싱 결과 — Zod 스키마 검증됨 */ },
  "warnings": ["unexpected discount banner; falling back to base price"],
  "http": { "status": 200, "elapsed_ms": 432 }
}
```

**근거:**
- HTML 원본은 페이지당 50~500 KB. 일 1회 × 50 요금제 × 365일 ≈ 9 GB/년 →
  Neon free 0.5 GB 18개월에 폭발. 솔로가 폭발 후 알아채기까지 알림 부담 큼.
- 정규화된 JSON은 5~20 KB 수준. 같은 가정에서 ≈ 360 MB/년 (안전 마진 충분).
- fetcher가 깨졌을 때 *재현은 fetcher 코드 + URL로 가능* (HTML 원본은 동적이라
  어차피 매번 다름). `fetcher_version` + `url`이 자가 진단의 단일 진입점.
- HTML 보존이 정말로 필요해지는 시점(예: 법적 분쟁)에는 별도 콜드 스토리지 (S3
  Glacier €1/TB/월)로 격상. 그 전에는 YAGNI.

**거부된 대안 — HTML 단편 + 정규화 JSON 둘 다 보존**
- 장점: 100% 감사 가능.
- 단점: Neon free 0.5 GB 한계 즉시 위협. 솔로가 모니터링 부담.

### T4 — `confidence` = 3값 enum + 자유 텍스트 사유 (옵션 C 채택)

`confidenceEnum` = `('high', 'medium', 'low')` + `confidenceReason text NULL`.

**근거:**
- P1 (정보 우선) — 결과 페이지 2층 비교 표(3.2)의 "신뢰도" 컬럼은 사용자에게
  노출. 3값 enum은 UI 색상 매핑(녹/황/적)에 직결.
- enum 3값은 *fetcher가 결정 가능한 카디널리티*. 0~100 scoring은 fetcher가
  점수를 어떻게 산정할지 매번 모호 → 계산기 인플레이션.
- `confidenceReason`은 운영자 + 어드민 대시보드(4.5.1)용 *디버깅 메모*. 사용자
  UI에는 기본 노출 X (요청 시 펼침). 솔로가 6개월 후 "왜 medium이었지?"를 자가
  진단 가능.
- ADR-0001의 `excluded_reason: text` 패턴과 일관 — *enum + 사유 텍스트* 운영
  관용구.

**confidence 휴리스틱 (강제 아님, fetcher 가이드)**:
- `high`: 공식 API 응답, 또는 안정 셀렉터로 파싱 + 가격 sanity 체크 통과
- `medium`: 스크래핑이지만 셀렉터가 fragile한 경우 / 프로모 가격이 모호하게
  표시되어 정상가만 신뢰
- `low`: 파싱이 부분 실패하여 전월 가격으로 fallback / 비교에서 자동 제외 권고

**거부된 대안 — 옵션 A (enum만, 사유 없음)**
- 장점: 가장 단순.
- 단점: 6개월 후 솔로 운영자가 "이 medium은 왜 medium이지?"를 알 수 없음 →
  P3 위반 (운영자 자신에게도 투명해야 함).

**거부된 대안 — 옵션 B (0~100 integer)**
- 장점: 수치적 비교/임계 설정 가능.
- 단점: fetcher가 점수 산정을 어떻게? 인위적. UI 색상 매핑 임계 결정도 매번
  토론. YAGNI.

### T5 — Anomaly = 별도 컬럼 + 별도 테이블 X (현 페이즈), 비교 차단은 confidence='low' AND/OR isAnomaly=true

**컬럼**:
- `isAnomaly boolean NOT NULL DEFAULT false`
- `anomalyReason text NULL` — 1.5.2 cron이 마킹 시 사유 기록

**1.5.2 워커 흐름**:
1. 매일 새 스냅샷 insert 후, 같은 `tariff_id`의 직전 스냅샷과 `monthlyPriceCents`
   비교
2. 변동률 ±50% 초과 OR `monthlyPriceCents = 0` 등 sanity 위반 시 `isAnomaly =
   true`, `anomalyReason = 'price_swing_>50%; prev=2500, curr=4500'` 마킹
3. Sentry 알림 (운영자 수동 검토)

**비교 엔진 1.11 차단**:
```sql
-- 최신 스냅샷 후보에서 anomaly 또는 confidence=low 제외
WHERE NOT is_anomaly AND confidence != 'low'
```

**근거:**
- P1 (정보 무결성) — 의심 데이터로 사용자 비교 결과를 오염시키지 않는다.
- 별도 컬럼이 SQL 필터/인덱스 단순. 1.5.2 워커 / 비교 엔진 / 어드민 모두 같은
  컬럼을 본다 → 진실 단일 출처.
- 별도 `tariff_snapshot_anomaly` 테이블은 페이즈 5에서 anomaly 종류가 다양해질
  때 도입 검토. 페이즈 1은 *boolean + text* 충분.

**거부된 대안 — 별도 `tariff_snapshot_anomaly` 테이블**
- 장점: anomaly 종류별 히스토리, M-to-M.
- 단점: 페이즈 1에서 JOIN 1회 추가 + 테이블 관리 추가. 솔로 디버깅 부담. ADR-0005
  §결정 4의 `tariff_promotion` 거부 이유와 동일 (어트리뷰션·디버깅 단순화).

### T6 — 리텐션 = 90일 슬라이딩 (`raw_payload` + `price_payload`만 NULL화), 메타는 영구 보존

**정책**:
- 90일 초과 스냅샷: `rawPayload = NULL`, `pricePayload = NULL` 로 갱신
- *메타데이터*는 영구: `id`, `tariffId`, `fetchedAt`, `sourceUrl`,
  `monthlyPriceCents`, `activationFeeCents`, `modemRentalCents`, `promoPriceCents`,
  `promoMonths`, `confidence`, `confidenceReason`, `isAnomaly`, `anomalyReason`
- 1.5.2 cron의 보조 작업으로 일 1회 `UPDATE` 실행

**근거:**
- 비교 엔진 1.11 + Danawa 스타일 가격 시계열 그래프(`docs/FOUNDER.md` §벤치마크
  Danawa)는 *cents 컬럼 + fetched_at만 있으면 동작*. JSONB 페이로드 없어도
  사용자 가치 100%.
- `rawPayload`/`pricePayload`는 *디버깅* 자산. 90일이면 *최근 fetcher 회귀*
  추적에 충분 (대부분 24~72h 내 발견).
- Neon free 0.5 GB에서 30~50 요금제 × 365일 × 5~20 KB JSONB ≈ 90~360 MB/년
  → 90일 NULL화하면 정상 운영에서 ≈ 25~90 MB만 활성. 18개월 안전.
- 영구 보존 메타는 행당 ~150 bytes → 1년 약 3 MB. 무시 가능.
- 페이즈 5(M16+) 격상 트리거: (a) 활성 요금제 수가 100개 초과, 또는 (b) Neon
  free 70% 도달 → S3 콜드 스토리지로 archived JSONB 이동(별도 ADR).

**거부된 대안 — 영구 보존 (`raw_payload` 영구)**
- 장점: 사후 감사 100%.
- 단점: 6개월 후 fetcher 폭주(예: timezone 버그로 분당 fetch) 시 0.5 GB 폭발
  위험을 *방치*. 솔로에게 위험 가시성 0.

**거부된 대안 — 30일**
- 장점: 더 보수적.
- 단점: fetcher 회귀가 1주 휴가 기간에 발생 → 복귀 시 추적 불가. 90일이 솔로
  현실(주 10~20h 작업) 균형점.

### T7 — "최신 스냅샷" = `(tariff_id, fetched_at DESC)` 복합 인덱스 + `DISTINCT ON` 쿼리 (옵션 A 채택)

**인덱스**:
```sql
CREATE INDEX tariff_snapshot_tariff_fetched_idx
  ON tariff_snapshot (tariff_id, fetched_at DESC);
```

**비교 엔진 쿼리 패턴 (Drizzle 의사코드)**:
```ts
// 최신 스냅샷 1건 per tariff (Postgres DISTINCT ON)
db.execute(sql`
  SELECT DISTINCT ON (tariff_id) *
    FROM tariff_snapshot
   WHERE tariff_id = ANY(${candidateIds})
     AND NOT is_anomaly
     AND confidence != 'low'
   ORDER BY tariff_id, fetched_at DESC
`)
```

**근거:**
- `(tariff_id, fetched_at DESC)` 복합 인덱스에서 `DISTINCT ON (tariff_id) ORDER
  BY tariff_id, fetched_at DESC`는 **인덱스 스캔만으로 처리 가능** (Postgres 16
  Index Skip Scan-like). 후보 50개 요금제에 대해 ms 단위.
- ADR-0005가 *마스터/스냅샷 분리*를 결정한 직접 효과 — 마스터에 `current_snapshot_id`
  컬럼을 *추가하지 않는다*. 그 변경은 ADR-0005 §결정 5(T5) Amendment를
  요구하며, fetcher가 매 insert 후 마스터 update를 실행하는 *추가 책임*을 만든다
  (트랜잭션 + 일관성 부담).
- 머티리얼라이즈드 뷰는 `REFRESH MATERIALIZED VIEW` 호출 책임이 추가되고,
  Neon free에서 추가 스토리지(뷰 자체) 발생. 50개 요금제에서 가치 0.

**거부된 대안 — 옵션 B (`tariff.current_snapshot_id` 컬럼)**
- 장점: O(1) lookup. JOIN 1회로 끝.
- 단점: ADR-0005 §결정 5(T5) Amendment 필요 (마스터 컬럼 추가). fetcher가 매
  insert 후 마스터 update 실행 → 두 번의 쓰기 + 트랜잭션. **fetcher가 일부 실패**
  시 마스터의 `current_snapshot_id`가 stale될 위험. 솔로 운영자가 "어, 왜 이
  요금제는 어제 데이터를 쓰지?"를 디버깅하기 어려움.
- ADR-0005의 마스터/스냅샷 분리 원칙을 **흐림**. 본 ADR은 이를 *깨지 않는다*.

**거부된 대안 — 옵션 C (머티리얼라이즈드 뷰 `tariff_latest_snapshot`)**
- 장점: 비교 엔진 SQL 단순.
- 단점: refresh 책임 추가. Neon 추가 스토리지. 50 요금제 규모에서 가치 0.
  페이즈 5에서 1000+ 요금제로 격상 시 재검토.

## Consequences

### 얻는 것

- 1.3 PLAN 항목의 모든 후속(1.5.2 `harness:price`, 1.11 비교 엔진, 결과 페이지
  3.5 계산 근거, Danawa 스타일 가격 그래프)이 *깨끗한 시계열 단일 테이블* 위에
  서 시작 가능.
- `harness:data` Rule 4 warn → 통과 (스키마에 `source_url.notNull()` +
  `fetched_at.notNull()` 정규식 매칭).
- ADR-0005의 마스터/스냅샷 분리 원칙 *유지*. 마스터 변경 0건.
- Neon free 0.5 GB 한계 안에서 18개월 안전 운영 (T6 90일 리텐션).
- P1 (정보 무결성) 강제: anomaly + confidence=low 데이터는 비교 엔진 입력에서
  자동 제외 (T5).
- 1.11 비교 엔진의 "최신 스냅샷" 쿼리가 인덱스 스캔만으로 ms 단위 (T7).

### 잃는 것 / 부채

- **비교 결과 영구 링크(3.6) 과거 분석**: 90일 후 `pricePayload` NULL → 90일
  이전 비교 결과의 *상세 페이로드*는 재구성 불가. 단 *사용된 cents 컬럼*은
  영구 보존되므로 비교 결과 자체는 재현 가능. 사용자 노출 영향 없음.
- **Anomaly 분류 단순함**: T5에서 `boolean + text`만으로 시작 → 페이즈 5에서
  anomaly 카테고리(가격 swing / 0가격 / null 데이터 / 셀렉터 깨짐 등)가
  분화되면 별도 ADR로 `tariff_snapshot_anomaly` 테이블 도입.
- **`raw_payload`가 정규화 JSON만**: 법적 분쟁 시 원본 HTML 부재. 통신 카테고리
  가격 시계열 분쟁은 페이즈 1 시점 위험 0에 가까움 — 페이즈 4 어트리뷰션 분쟁
  시 재평가.

### 후속 작업 (다른 PLAN 항목과 연결)

- **1.5.2 `harness:price`**: 본 ADR §T5 워커 흐름이 1.5.2의 핵심 알고리즘.
  Sentry 알림 임계값 = anomaly 마킹 + confidence='low' 비율 추이.
- **1.6 Inngest cron**: fetcher 실행 후 (a) `tariff` 마스터 upsert (b)
  `tariff_snapshot` insert (c) `tariff.lastSeenAt` 갱신. **본 ADR이 트랜잭션
  순서 결정** — 마스터 upsert가 먼저, 스냅샷 insert가 나중. 둘 다 성공 시에만
  커밋.
- **1.7 Fetcher 인터페이스**: `FetchResult` 타입에 `confidence`,
  `confidenceReason`, `pricePayload`, `rawPayload` 필드 강제. 본 ADR이 모양 결정.
- **1.10 `/data-sources` 페이지**: provider별 마지막 스냅샷의 `confidence`
  분포 + anomaly 비율 노출 (P3).
- **1.11 비교 엔진**: §T7 쿼리 패턴 사용. `WHERE NOT is_anomaly AND confidence
  != 'low'` 강제.
- **3.5 계산 근거 펼치기**: 비교 결과 카드에서 사용한 스냅샷 ID들 → 각
  스냅샷의 `fetched_at` + `source_url` 노출. P1.
- **6.3 가격 변동 모니터링**: 1.5.2의 정식화. 본 ADR의 `isAnomaly` +
  `confidence` + `monthlyPriceCents` 시계열이 입력.

## Alternatives considered (요약)

| Trade-off | 채택 | 거부된 주요 대안 |
|---|---|---|
| T1 | Append-only insert | 분 라운딩 후 upsert (사후 분석 손실) |
| T2 | 평탄화 5컬럼 + JSONB 미러 | 단일 컬럼만 (24개월 TCO 재계산 거짓 위험) |
| T3 | 정규화 JSON만 | HTML 단편 + JSON (Neon free 한계 위협) |
| T4 | 3값 enum + 사유 텍스트 | enum만 (자가 진단 불가) / 0-100 (산정 모호) |
| T5 | boolean + text 컬럼 | 별도 anomaly 테이블 (JOIN 부담, YAGNI) |
| T6 | 90일 후 JSONB NULL화 | 영구 보존 (폭발 위험) / 30일 (회귀 추적 손실) |
| T7 | `(tariff_id, fetched_at DESC)` + DISTINCT ON | 마스터에 current_snapshot_id (ADR-0005 분리 흐림) |

## 검증 방법

### 1. typecheck / lint / test 0 에러

`pnpm typecheck && pnpm lint && pnpm test:run`

### 2. `pnpm harness:data` 통과

- 본 ADR 머지 후 `schema-tariff-snapshot-missing` warn → 통과 (스키마 detection
  + `source_url.notNull` + `fetched_at.notNull` 정규식 매칭).
- 다른 룰(StaleLabel, fetcher FetchResult, UI PriceWithSource)은 본 ADR과 무관 —
  이전 상태 유지.

### 3. 마이그레이션 SQL 시각 검토

`pnpm db:generate` → `drizzle/0002_*.sql` 의 다음 객체 모두 존재:
- `CREATE TYPE confidence` enum (3값)
- `CREATE TABLE tariff_snapshot` (15개 컬럼, NOT NULL 제약 7개)
- FK `tariff_id` → `tariff(id) ON DELETE CASCADE`
- 인덱스 3개: `tariff_snapshot_tariff_fetched_idx`,
  `tariff_snapshot_anomaly_idx`, `tariff_snapshot_fetched_at_idx`
- ADR-0005와 동일 절차로 verifier가 SQL 1회 시각 검토.

### 4. 시계열 회귀 (1.5.2/1.11에서 본격화)

- 1.5.2 첫 가동 시 anomaly 마킹이 *false positive* < 5%. 초과 시 §T5 워커 임계
  재조정 (ADR Amendment).
- 1.11 비교 엔진의 "최신 스냅샷" 쿼리 EXPLAIN ANALYZE에서 *Index Scan* 등장
  (Seq Scan 0). 50 요금제에서 < 10ms.

## 다음 단계

1. **마이그레이션 생성** (사용자 실행):
   ```bash
   pnpm db:generate    # drizzle/0002_*.sql 생성
   pnpm db:push        # Neon에 적용 (확인 후)
   ```
   → 생성된 SQL은 verifier가 시각 검토. ADR-0001/0005 패턴과 동일.

2. **PLAN 1.3 본문 갱신** — 원안 5필드(`tariff_id`, `fetched_at`, `source_url`,
   `raw_payload`, `confidence`)를 본 ADR의 15컬럼 셋으로 갱신. ADR-0005가
   PLAN 1.2를 갱신한 것과 동일 패턴.

3. **1.7 Fetcher 인터페이스** 작성 시 `FetchResult` 모양에 본 ADR §T2/T3/T4
   필드 포함 (`pricePayload`, `rawPayload`, `confidence`, `confidenceReason`).

4. **1.5.2 `harness:price`** 첫 가동 시 §T5 워커 흐름 구현. Sentry 임계값
   초기 설정 → 30일 후 false positive 측정 → Amendment.

## References

- 헌법: [`CLAUDE.md`](../../CLAUDE.md) — P1 (정보 우선), P3 (투명성), P4 (타입 안전), P5 (ADR)
- 운영자: [`docs/FOUNDER.md`](../FOUNDER.md) — 솔로 사이드, Neon free 0.5 GB, Danawa 가격 시계열 벤치마크
- 관련 ADR:
  - [ADR-0001](0001-provider-schema.md) — `provider` (FK 조부모)
  - [ADR-0003](0003-plan-realism-solo-side.md) — 솔로 사이드 운영 가정
  - [ADR-0005](0005-tariff-schema-telecom.md) — `tariff` 마스터 (FK 부모, T5 시계열 분리 원칙)
- 외부 문서:
  - [PostgreSQL 16 — TOAST](https://www.postgresql.org/docs/16/storage-toast.html)
  - [PostgreSQL 16 — DISTINCT clause](https://www.postgresql.org/docs/16/sql-select.html#SQL-DISTINCT)
  - [PostgreSQL 16 — JSONB 인덱싱](https://www.postgresql.org/docs/16/datatype-json.html)
  - [Neon Pricing (Free tier 0.5 GB)](https://neon.tech/pricing)
- Drizzle docs:
  - [pgEnum + relations](https://orm.drizzle.team/docs/sql-schema-declaration)
  - [bigint mode 'number'](https://orm.drizzle.team/docs/column-types/pg#bigint)
  - [jsonb 컬럼](https://orm.drizzle.team/docs/column-types/pg#jsonb)
- Harness:
  - [`scripts/harness/data-fidelity.ts`](../../scripts/harness/data-fidelity.ts) Rule 4 — 본 ADR이 통과시키는 룰
