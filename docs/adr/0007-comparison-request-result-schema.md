# ADR-0007: `comparison_request` + `comparison_result` 스키마 (GDPR + 익명성 + 영구 링크)

## Status

Proposed (2026-05-09) — PLAN 항목 **1.4** + **1.5** 동시 결정. verifier가
typecheck/lint/test/migration-sql/harness:plan/harness:data 통과 확인 후
Accepted로 격상한다. **Legal review pending** — §Legal review pending 참조.

## Context

- PLAN 항목 **1.4** (`comparison_request`) + **1.5** (`comparison_result`) 동시
  결정. 두 테이블은 FK로 연결되며 GDPR 합법근거 / 익명성 / 영구 링크 보존이
  서로 얽혀 분리 설계 시 일관성이 깨진다.
- ADR-0001 / ADR-0005 / ADR-0006으로 `provider` / `tariff` / `tariff_snapshot`
  3 테이블이 확정됨. 본 ADR은 **사용자가 직접 입력하는 첫 테이블**(1.4) +
  **비교 엔진 1.11이 기록하는 첫 테이블**(1.5)이다.
- **헌법 §8 #1**: "사용자 데이터를 외부로 보내지 않는다 — GDPR Art. 6(1)(a)".
  본 ADR은 그 강제 위치를 *스키마 레이어*에서 잡는다.
- **운영자 컨텍스트** (`docs/FOUNDER.md`): 솔로 사이드, 월 €300, 외부
  변호사 €800/주 불가 → legal 에이전트 100% 의존, 베타 직전 1회 외부 감사.
  **본 ADR의 비-자명한 GDPR 결정**(T3 합법근거, T9 결과의 PII 판정)은
  Legal review 권장 표시.
- **MONETIZATION D (B2B Insights)**: M24+, ≥ 1,000명 단위 익명 집계만 판매.
  본 ADR의 `comparison_result`는 D 스트림의 *원천 데이터셋*이 된다 → 1행 = 1
  datapoint, 그러나 PII 결합 가능성을 차단해야 함.
- **PLAN §3.6 영구 링크 (`/r/[id]`)**: 비교 결과 스냅샷 영구 보관. URL 추측
  공격 + GDPR 삭제 요청과의 충돌 해결 필요.
- **PLAN §6.4 GDPR 도구**: 데이터 다운로드(`/account/export`) + 삭제
  (`/account/delete`). 익명 비교를 어떻게 *특정 사용자에게 귀속*시켜 다운로드/
  삭제하는가가 T1 식별자 모델의 핵심 트레이드오프.

### 외부 사실 (검증된 출처)

- **GDPR Art. 6(1)(a)~(f)** — 6가지 합법근거. 본 ADR과 직접 관련:
  - (a) Consent: "for one or more specific purposes" — 명시 + 구체적
  - (b) Contract performance: 계약 이행 또는 *사전 계약 단계* (data subject
    요청에 의한)
  - (f) Legitimate interest: 컨트롤러/제3자의 정당한 이익. **3-part test**
    (Legitimate Interest → Necessity → Balancing)
  - 출처: [GDPR Art. 6](https://gdpr-info.eu/art-6-gdpr/), [EDPB Guidelines
    1/2024 on legitimate interests (Oct 2024)](https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202401_legitimateinterest_en.pdf)
- **GDPR Recital 26** — 익명 vs 가명:
  - 익명 데이터 = "정보 주체가 더 이상 식별되지 않는" 데이터. GDPR 적용 X.
  - 가명 데이터 = "추가 정보 사용으로 자연인에게 귀속될 수 있는" 데이터. GDPR
    적용 O.
  - 식별 가능성 판단 기준: *available technology, technological developments,
    cost of identification, time required, practical means*.
  - 출처: [GDPR Recital 26](https://gdpr-info.eu/recitals/no-26/)
- **베네룩스 우편번호 + 인구 식별성** (재식별 위험 문헌):
  - **NL 시민 67%가 생년월일 + 4자리 우편번호(PC4)만으로 단일 식별** ([Koot 2010,
    PETS](https://petsymposium.org/2010/papers/hotpets10-Koot.pdf)).
  - 99.4% = 생년월일 + 전체 우편번호(PC6) + 성별.
  - 우리는 생년월일을 *받지 않으므로* 위 87%~99% 시나리오는 직접 적용 X. 그러나
    **PC4 + 가구 형태(혼자/커플/3+) + 현재 공급사 + 사용량 프로파일** 조합은
    *quasi-identifier*로 작동하며, 인구 밀도가 낮은 LU/소도시 BE에서는 단일
    식별 위험이 실재한다.
  - **방어책**: T2에서 우편번호를 PC4 그대로 보관하되 B2B 집계(MONETIZATION D)
    에는 **PC2 (앞 2자리, 지역) 단위 + ≥ 1,000명 K-anonymity** 강제. 본 ADR이
    schema-level에서 PC2 도출 가능성을 *컬럼 정책*으로 명시.
- **EDPB Guidelines 1/2024** — Legitimate interest 3-part test 강조: 필요성
  (necessity) + 균형 테스트(balancing) + LIA 문서화 의무. *처리 시작 시점에
  문서화*해야 함.

## Decision

T1~T10 10개 결정.

### T1 — 식별자 = 익명 UUID + 옵션 세션 fingerprint NULL (옵션 A 변형 채택)

**`comparison_request.id`** = `uuid` PK (`defaultRandom()`). 사용자 추적 불가
한 *진짜 익명* 식별자가 1차 모델.

**선택적 결합** — 향후 페이즈 6.4 GDPR 다운로드/삭제를 위해:
- `userAccountId uuid NULL` 컬럼 — 페이즈 6에서 회원가입 도입 시 *명시 동의 후*
  결합. 페이즈 1 시점에는 항상 NULL.
- `sessionFingerprint text NULL` 컬럼은 **추가하지 않는다**. 헌법 §8 #5 ("GDPR
  우회 추적 픽셀 X") + Recital 26의 가명화 = PII로 분류 위험.

**근거:**
- Recital 26: 익명 = GDPR 적용 X. UUID 단독 + PII 결합 부재 = *진짜 익명*.
- 페이즈 6.4 GDPR 다운로드/삭제는 **회원 계정**에서만 동작. 게스트 비교는
  근본적으로 "한 자연인의 데이터"임을 *증명할 수 없으므로* 다운로드/삭제 불가
  → UI에서 "회원가입 후 결과 영구 저장" 명시.
- 페이즈 4.6 베타 100명에서도 결과 영구 링크는 *URL 자체가 키*다 — 사용자가
  URL을 잃으면 우리도 못 찾는다. 이것이 P3 (운영자의 짐) 와 데이터 최소화의
  교차점.

**거부된 대안 — 옵션 B (session UUID 한 브라우저 = 한 ID로 묶음)**
- 장점: 한 사용자가 카테고리 여러 번 비교 시 자연스러운 "내 비교 히스토리".
- 단점: Recital 26의 *가명화* 정의에 정확히 해당 → PII로 분류 → 합법근거 필요
  → 첫 클릭에 동의 모달 → P2 (5분/5단계) 위반. **추적 픽셀의 부드러운 형태**
  로 헌법 §8 위반 위험.

**거부된 대안 — 옵션 C (게스트 = A, 로그인 = D 결합)**
- 장점: 가입 시 모든 게스트 결과 자동 결합.
- 단점: 페이즈 1에 회원 시스템이 없음. 페이즈 6.4에서 *그때 결정*하는 것이
  YAGNI 원칙. `userAccountId NULL` 컬럼만 미리 두면 마이그레이션 0건으로
  대응 가능.

### T2 — 입력 컬럼 = 평탄화 핵심 4 + JSONB attributes (옵션 A 채택)

**평탄화 핵심**:
- `category` — `tariff_category` enum 재사용 (ADR-0005 §T6, 4값)
- `postalCode` text NOT NULL — PC4(BE) / PC4-PC6(NL) / 4자리(LU). 형식 검증은
  Zod (`src/types/comparison-input.ts` 신설, 1.7과 같이).
- `householdType` enum NOT NULL — `('single', 'couple', 'family_3_plus')`
- `currentProviderId` uuid NULL — `provider.id` FK (`onDelete: SET NULL`)
  REFERENCES. NULL = "모르거나 없음". PLAN §2.4의 "선택적, 모르면 스킵"
  동기.

**JSONB**:
- `inputAttributes jsonb NOT NULL DEFAULT '{}'` — 카테고리별 변동 입력
  (mobile: `{ data_gb_used, voice_minutes_used }`; internet: `{ download_mbps_needed,
  household_devices }`). Zod 단일 출처 = `src/types/comparison-input.ts`.

**B2B 집계 도출 정책 (스키마 외 정책)**:
- `comparison_result` 집계 시 PC4 → **PC2** (앞 2자리, 지역) 변환 + K ≥ 1,000
  강제. 본 ADR은 *원본 PC4를 보관*하지만, 집계 ETL이 PC2로 일반화한다. 페이즈
  6.4 / MONETIZATION D 진입 시 ADR Amendment로 ETL 코드 위치 결정.

**근거:**
- 핵심 4 컬럼은 비교 엔진(1.11) 입력 — SQL JOIN/FILTER가 평탄화 컬럼에서
  나옴. JSONB만 두면 인덱싱 비효율.
- ADR-0005 §T1과 일관 — 컬럼화는 주류, JSONB는 진화 흡수.
- 우편번호 일반화(PC4 → PC2)를 *스키마에서 강제*하지 않는 이유: (a) 솔로
  운영자가 6개월 후 "이 비교는 왜 결과가 이상해?" 디버깅할 때 PC4가 필요. (b)
  베타 100명에서 디버깅 가치 > B2B 집계 위험. (c) MONETIZATION D는 M24+로
  멀어 — 그 시점에 ETL을 정확히 결정하면 됨.

**거부된 대안 — 모든 입력 jsonb 단일**
- 장점: 카테고리 추가 시 마이그레이션 0.
- 단점: 비교 엔진(1.11) hot path = `WHERE category = $1 AND postal_code LIKE
  '$2%'`. JSONB 추출 비용 + 인덱스 부재.

**거부된 대안 — PC4를 schema에서 PC2로 미리 일반화**
- 장점: K-anonymity 보장 단순.
- 단점: 같은 PC4 안에서도 LU/룩셈부르크시 vs 룩셈부르크 시골은 가격 분포가
  다름. 비교 결과 정확도 손실. 디버깅도 어려움.

### T3 — 합법근거 = (b) Contract performance + (a) Consent for affiliate redirect (옵션 B+a 채택)

**1차 합법근거**: GDPR Art. 6(1)(b) — *비교 서비스 제공 계약*. 사용자가
"비교 결과를 받으려고" 입력 → 우리가 "결과를 계산해서 표시"하는 것은 *계약
이행*에 필요하다.

**보조 합법근거 (특정 활동)**:
- 어필리에이트 리다이렉트(페이즈 4.1): **Art. 6(1)(a) 명시 동의** — 클릭 시
  "Slim에서 Proximus 사이트로 이동합니다. 사용자 데이터는 전송되지 않으나,
  방문 사실은 어트리뷰션을 위해 기록됩니다" 모달. 헌법 §8 #1과 정확히 일치.
- 후속 메일(페이즈 4.5): Art. 6(1)(a) 명시 옵트인.
- B2B Insights 집계(MONETIZATION D, M24+): **익명 데이터(Recital 26)**라
  GDPR 적용 X — 단 PC2 + K≥1000 일반화 *전제*.

**LIA(Legitimate Interest Assessment) 문서화 — 본 결정에는 불필요**:
- (b) Contract는 LIA 의무 없음. 단 *계약의 본질*을 사용자에게 명시해야 함 →
  페이즈 2.1 카테고리 선택 화면 하단에 "Slim 비교 서비스 이용 약관에 동의"
  체크 + `/legal/terms` 링크.

**거부된 대안 — Art. 6(1)(f) Legitimate interest 단독**
- 장점: 동의 모달 0. UX 가장 가벼움.
- 단점: EDPB Guidelines 1/2024가 *3-part test (legitimate / necessity /
  balancing) + LIA 문서화 의무*를 명시. 솔로 운영자에게 LIA 작성 + 분기 갱신
  부담. 비교 서비스의 본질이 "사용자 요청에 의한 계산"이라는 점에서 (b)가
  더 자연.

**거부된 대안 — Art. 6(1)(a) Consent 단독**
- 장점: 가장 안전.
- 단점: 모든 입력에 동의 모달 → P2 5분 플로우 깨짐. EDPB는 *consent를
  남발하면 의미 없음*을 강조 — "비교 결과 받기"는 명백한 계약 행위라 (b)가
  맞다.

**거부된 대안 — Art. 6(1)(b) + (f) 혼합**
- 장점: 어트리뷰션도 (f)로 처리 가능.
- 단점: 헌법 §8 #1이 *명시 동의* 못박음 — 어필리에이트 리다이렉트는 (a)가
  헌법 강제. 본 ADR은 헌법을 깨지 않는다.

### T4 — 리텐션 = 분리. result 영구 + request의 PII는 90일 후 NULL화 (옵션 C 채택)

**`comparison_request`**:
- 90일 후 cron이 **`postalCode`를 PC2로 일반화** + `inputAttributes`의 사용량
  필드 NULL화. 핵심 메타(`id`, `createdAt`, `category`, `householdType`,
  `currentProviderId`)는 영구.

**`comparison_result`**:
- *영구 보존*. 영구 링크(/r/[id]) 100% 동작. PII 파생물(가정/사용량)은 별도
  컬럼(T9 lockedInputs)이 90일 후 NULL.

**근거:**
- GDPR 데이터 최소화 원칙 친화 — 처리 목적(비교 결과 표시)이 종료되면
  원본 입력은 더 이상 필요 없음.
- 영구 링크의 *결과 자체*는 익명 — T9에서 `lockedInputs` JSONB가 PII
  파생물을 봉인하고 90일 후 일반화/삭제.
- 90일 = ADR-0006 §T6과 일관 (운영자 디버깅 윈도우).
- B2B 집계(MONETIZATION D, M24+)는 본 ADR의 영구 메타(category, PC2,
  householdType, savings) 만으로 가능 → 쓸 데이터는 보존, 쓰지 않을 데이터는
  최소화.

**거부된 대안 A — 30일 후 완전 삭제 (request + result)**
- 장점: 가장 보수적.
- 단점: 영구 링크(/r/[id]) 깨짐 → P2 (5분 결과) 가치 손실. 사용자가 결과
  URL을 친구에게 공유 → 30일 후 404 → 신뢰 손상.

**거부된 대안 B — request + result 모두 영구**
- 장점: 단순.
- 단점: GDPR 데이터 최소화 위반. PC4 + 가구 형태 + 사용량 영구 보유 = 솔로
  운영자에게 6개월 후 *고위험 자산*. 또한 데이터 침해 시 영향 범위 ↑.

### T5 — IP / device fingerprint 컬럼 = 0 (헌법 §8 #1 + #5 강제)

본 테이블 어디에도 IP / User-Agent / fingerprint 컬럼 *없음*.

**근거:**
- 헌법 §8 #1: "사용자 데이터를 외부로 보내지 않는다."
- 헌법 §8 #5: "GDPR 우회 추적 픽셀 X."
- 어트리뷰션(페이즈 4.1)은 *별도 ADR*에서 결정 — 본 ADR은 그것을 *선결*하지
  않는다. 4.1이 IP가 필요하다고 결정하면 `affiliate_click` 테이블에서만 가짐
  (TTL 24h 권장, 그 ADR에서 결정).
- Sentry/PostHog는 *우리가 직접 저장하지 않는다* — 그들의 cookieless 모드 +
  IP 익명화 옵션 사용 (페이즈 6 운영 ADR에서 결정).

### T6 — `comparison_result` = `comparison_result_item` 자식 테이블 (옵션 C 채택)

`comparison_result` (1) ↔ `comparison_result_item` (N).

**`comparison_result`** (부모, 한 비교 = 한 행):
- `id` uuid PK
- `requestId` uuid NULL → `comparison_request(id) ON DELETE SET NULL` (T8)
- `shortId` text UNIQUE NOT NULL (T7)
- `topSavingCents` bigint — 1위 추천의 절약액 (집계용)
- `topTariffSnapshotId` uuid → `tariff_snapshot(id) ON DELETE RESTRICT`
- `lockedInputs` jsonb — T9 (90일 후 NULL화)
- `engineVersion` text NOT NULL — 비교 엔진 1.11 버전 (예: `compare@2026-05-09`)
- `createdAt` timestamptz NOT NULL

**`comparison_result_item`** (자식, 결과의 각 행):
- `id` uuid PK
- `resultId` uuid NOT NULL → `comparison_result(id) ON DELETE CASCADE`
- `rank` integer NOT NULL — 1, 2, 3, ... (정렬 순서 보존)
- `tariffSnapshotId` uuid NOT NULL → `tariff_snapshot(id) ON DELETE RESTRICT`
- `monthlySavingCents` bigint NOT NULL
- `yearlySavingCents` bigint NOT NULL
- `caveats` text[] — PLAN 1.13 caveats 메커니즘 (예: "24개월 약정")
- `createdAt` timestamptz NOT NULL

**근거:**
- PLAN §3.2 비교 표는 *상위 5개 행* 반복 렌더링 — 자식 테이블 1:N이 자연.
- PLAN §3.5 "계산 근거 펼치기" — 각 행의 `tariffSnapshotId`가 *snapshot 단건*
  을 가리킴. 결과 페이지가 영구 링크인 동안 snapshot도 RESTRICT로 잠금.
- T7 영구 링크와 결합: `/r/[shortId]`로 부모 1행 + 자식 5행 SELECT → 표 렌더.
- ADR-0006 §T7과 일관 — 인덱스 스캔만으로 처리 가능.

**거부된 대안 A — `tariffSnapshotIds uuid[]` 단순**
- 장점: 테이블 1개.
- 단점: 행별 metadata(`rank`, `monthlySavingCents`, `caveats`) 표현 불가 →
  비교 엔진이 매번 재계산 → P1 (정보 우선) 위반 (영구 링크 = "원래 보여준
  값" 보존).

**거부된 대안 B — `comparison_result_snapshot` join 테이블 (M:N)**
- 장점: 같은 snapshot이 여러 비교에서 재사용.
- 단점: M:N이 필요 없음 (한 결과의 행이 다른 결과의 행과 *공유*되지 않음).
  YAGNI.

### T7 — 영구 링크 = `shortId` (nanoid 12자) + URL `/r/[shortId]` (옵션 A 채택)

**구현**:
- `shortId text NOT NULL UNIQUE` 컬럼. nanoid alphabet `'0123456789abcdefghijklmnopqrstuvwxyz'`
  (36 chars) × 12자리 = 36^12 ≈ 4.7 × 10^18 공간 → 추측 충돌 사실상 0.
- `nanoid` 라이브러리는 솔로 운영자 컨텍스트에서 추가 부담 0 (의존 zero-deps,
  ~150 bytes gzipped).

**근거:**
- UUID v4 노출은 추측 공격 차단되지만 36자 길이 → URL 친화 X.
- nanoid 12자 = "공유하기 쉬운" + "추측 불가" 균형. 실제 비교 결과 URL 예시:
  `https://slim.eu/r/a9k3lxq8mp4w`.
- `nanoid` vs `Hashids`: nanoid는 *암호적으로 안전한 random*, Hashids는
  *DB id encoding*. 우리는 *비밀스런 short ID*가 필요 → nanoid가 의도와 정확.

**거부된 대안 — UUID v4 그대로 노출**
- 장점: 의존 0.
- 단점: URL 길이 36자, 사용자가 공유 시 부담. 추측은 막지만 *시각적 noise*
  큼.

**거부된 대안 — Hashids (DB id 인코딩)**
- 장점: 가역적 (decoded 후 PK).
- 단점: salt 노출 시 모든 ID 추측 가능. 영구 링크의 보안 모델과 미스매치.

### T8 — `comparison_result.requestId` nullable + `ON DELETE SET NULL` (옵션 B 채택)

`comparison_result.requestId uuid NULL REFERENCES comparison_request(id) ON
DELETE SET NULL`.

**근거:**
- T4 리텐션과 결합: 90일 후 *request의 PII는 일반화*되지만 *request 행 자체는
  보존* (T4 결정). 그러나 향후 GDPR 삭제 요청 (페이즈 6.4) 또는 회계 정책으로
  *request 행 완전 삭제* 시 → result는 *익명으로 영구 보존*되어야 함 (영구
  링크 깨지지 않게).
- ADR-0006 §T7 마스터/스냅샷 분리 정신 일관 — 결과는 그 자체로 self-contained.
- `lockedInputs` JSONB(T9)가 결과 페이지 렌더에 필요한 입력을 봉인 → request
  행 부재 시에도 결과 페이지는 정상 렌더.

**거부된 대안 — NOT NULL + `ON DELETE CASCADE`**
- 장점: 정합성 강제.
- 단점: GDPR 삭제 요청 시 *결과 페이지가 깨진다* (비록 결과 자체는 익명에
  가깝지만 외부 공유된 영구 링크가 404). T4의 분리 의도와 모순.

### T9 — 결과의 PII = `lockedInputs jsonb` 분리 + 90일 후 NULL화

`comparison_result.lockedInputs jsonb` — 결과 계산 시 사용한 *입력 사본*
(우편번호, 가구 형태, 사용량 프로파일). PLAN §3.5 "계산 근거 펼치기"의 입력.

**90일 후**:
- T4 cron이 `lockedInputs = NULL` 갱신.
- 결과 페이지(/r/[shortId])는 그 시점부터 "이 비교의 입력 가정은 90일 보관
  정책으로 일반화되었습니다 — 비교 결과는 그대로 보존됩니다" 안내.

**근거:**
- 결과 자체(rank + savings + tariff_snapshot_id)는 본질적으로 *익명*에 가까움
  — Recital 26의 "reasonably likely identifiability"에서 솔로 운영자의 자원
  수준에서 재식별 비현실.
- 그러나 `lockedInputs` 안의 PC4 + 가구 형태 + 사용량 = T2와 동일한 quasi-
  identifier → PII로 분류. 분리 보관 + TTL이 정답.
- B2B Insights(MONETIZATION D)는 *집계만* 보내므로 `lockedInputs` 부재해도
  공급사가 받는 데이터는 동일.
- PLAN §3.5 "계산 근거 펼치기"는 90일 동안 100% 동작 → 베타 + 초기 사용자
  검증에 충분.

**거부된 대안 — 결과 전체에 PII 직접 컬럼화**
- 장점: SQL 단순.
- 단점: 결과 행 자체에 PII 결합 → result 영구 보존 정책(T4)과 충돌. 데이터
  최소화 위반.

### T10 — 비교 엔진 호출 모델 = 동기 + 5초 timeout (옵션 동기 채택)

**흐름**:
1. 사용자 입력 완료(페이즈 2.6) → POST `/api/compare`
2. API 라우트가 트랜잭션 시작:
   a. `comparison_request` insert (id 생성)
   b. 비교 엔진 1.11 호출 (순수 함수, ms 단위)
   c. `comparison_result` + `comparison_result_item[]` insert
   d. 트랜잭션 커밋
3. 응답에 `shortId` 포함 → 클라이언트가 `/r/[shortId]`로 redirect

**timeout = 5초**. 초과 시 사용자에게 "잠시 후 다시 시도" + Sentry 알림.

**근거:**
- 솔로 사이드 + €300 cap → Inngest 무료 티어 1K runs/월. 비교마다 Inngest 호출
  은 사치. PLAN 1.6의 cron(일 1회 fetcher)만 Inngest 사용.
- 비교 엔진 1.11은 *순수 함수* — 입력 = (현재 tariff_id, 사용량, 후보
  tariff[]). 후보 50개 이내에서 ms 단위 (ADR-0006 §T7 인덱스).
- Upstash Redis 캐시(5분 TTL, CLAUDE.md §5)로 같은 입력 재계산 회피 → 5초
  timeout이 보수적으로 충분.
- P2 (5분 / 5단계) — *결과를 즉시* 보여주는 동기 모델이 사용자 경험에 자연.
  "처리 중..." 폴링 화면은 5단계의 6번째 단계로 보임.

**거부된 대안 — 비동기 (Inngest job + 폴링/웹훅)**
- 장점: 무거운 계산 격리, 실패 재시도.
- 단점: Inngest 무료 티어 1K runs/월 → 비교 1K 도달 시 (페이즈 4 베타 후 즉시)
  유료 격상. 솔로 €300 cap 위협. 사용자 폴링 UX = 5분 약속 위반.

## Consequences

### 얻는 것

- 페이즈 1.4 + 1.5 두 테이블이 *동시에 결정* → fetcher 인터페이스(1.7) /
  비교 엔진(1.11)이 명확한 입출력 모양으로 시작 가능.
- GDPR 합법근거가 *처리 시작 시점에 문서화*됨 (EDPB 의무 — Art. 6(1)(b)
  계약 본질 + (a) 어필리에이트 동의).
- 영구 링크(`/r/[shortId]`)가 GDPR 삭제 요청과 *충돌하지 않음* (T8 SET NULL +
  T9 lockedInputs 분리).
- B2B Insights(MONETIZATION D, M24+)의 데이터셋이 *원천부터 K-anonymity 친화*
  (T2 PC4 → PC2 일반화 정책, T9 lockedInputs 분리).
- 헌법 §8 #1 (사용자 데이터 외부 X) + #5 (추적 픽셀 X) 가 *스키마 레이어*에서
  강제됨 (T5 IP 컬럼 0).

### 잃는 것 / 부채

- **세션 추적 불가**: 한 사용자의 카테고리 여러 번 비교를 자동 묶을 수 없음
  (T1 익명). 페이즈 6 회원 시스템에서 명시 동의 후 결합 가능 (`userAccountId`
  컬럼 미리 둠). 페이즈 1~5 베타에서는 의도된 제약.
- **`lockedInputs` 90일 후 NULL → "계산 근거" 손실**: 90일 이전 결과 페이지의
  *상세 가정*은 일반화 안내로 대체. 영구 링크 자체는 동작.
- **PC4 영구 보존 위험**: T4 90일 후 PC4 → PC2 일반화 cron이 *반드시 동작해야*
  K-anonymity 보장. 1.5.2 cron의 보조 작업으로 추가됨 (PLAN 1.5.2 갱신 필요).
- **LIA 부재 결정의 위험**: T3에서 (b) Contract 채택 → LIA 없음. 베타 직전
  외부 GDPR 감사(MONETIZATION ADR-0004 §결정 3, M16~M18)가 이 선택을 검증.
  미통과 시 (f) Legitimate interest로 회귀 + LIA 작성 (ADR Amendment).

### 후속 작업 (다른 PLAN 항목과 연결)

- **1.7 Fetcher 인터페이스**: `FetchResult`는 본 ADR의 입력 모양을 알 필요 없음.
  비교 엔진(1.11)이 두 ADR 사이의 변환 책임.
- **1.11 비교 엔진**: 입력 = `(comparisonRequestRow, candidateSnapshots[])`.
  출력 = `{ result: NewComparisonResult, items: NewComparisonResultItem[] }`.
  *순수 함수*로 작성 (1.12 12 케이스 단위 테스트 호환).
- **1.13 caveats 메커니즘**: `comparison_result_item.caveats text[]` 컬럼이
  본 ADR로 확정.
- **2.1~2.6 입력 플로우**: 페이즈 2.1 카테고리 선택 화면 하단에 *Slim 비교
  서비스 이용 약관 동의* 체크 → T3 Art. 6(1)(b) 계약의 본질 명시.
- **3.6 영구 링크**: `/r/[shortId]` 라우트 = `shortId`로 SELECT (T7).
- **4.1 어트리뷰션 (`affiliate_click`)**: 별도 ADR 필요. *그 ADR이* IP 보관/
  TTL/리다이렉트 동의 모달 결정. 본 ADR은 `comparison_result_item.id` →
  `affiliate_click.result_item_id` FK가 가능하도록 설계 완료.
- **6.4 GDPR 도구**: `/account/export` = `userAccountId IS NOT NULL` request +
  연결된 result. `/account/delete` = SET NULL request → result는 익명 보존.
  페이즈 6에서 회원 시스템과 함께 결정.
- **MONETIZATION D B2B Insights (M24+)**: ETL = `comparison_result` SELECT +
  PC4 → PC2 변환 + `category, householdType, topSavingCents` 집계 + K ≥ 1,000
  필터. 별도 ADR (M24+).

### 페이즈 6.4 / MONETIZATION D 호환성 매트릭스

| 시나리오 | 동작 |
|---|---|
| 게스트 비교 → 영구 링크 공유 | T7 shortId로 100% 동작 |
| 회원가입 → 과거 게스트 비교 결합 | 페이즈 6에서 `userAccountId` 결합 절차 결정 (이 ADR 외) |
| 회원이 데이터 다운로드 요청 | `userAccountId IS NOT NULL` request + result 직렬화 |
| 회원이 데이터 삭제 요청 | request DELETE → result.requestId SET NULL → 영구 링크 익명 보존 |
| 비회원이 결과 페이지 접근 (90일 이후) | result 행 + items 정상 표시, lockedInputs 일반화 안내 |
| B2B Insights 집계 (M24+) | result SELECT + PC2 일반화 + K ≥ 1,000 필터 |

## Legal review pending

다음 결정은 *비-자명한 GDPR 판단*이며 베타 직전(M8~M10) 또는 M16 평가 게이트
에서 legal 에이전트 또는 외부 감사 검토 권장:

1. **T3 합법근거 (Art. 6(1)(b) Contract performance 채택)** — EDPB Guidelines
   2/2019 (Art. 6(1)(b) 처리)와 EDPB Guidelines 1/2024 (Art. 6(1)(f)
   legitimate interests)을 함께 본 후, *비교 서비스가 "계약"의 정의를 만족하는가*
   에 대한 외부 견해. 베네룩스 자영업자 + 무료 서비스라는 특수 컨텍스트.
   미통과 시 (f) + LIA 작성으로 회귀.

2. **T9 결과의 PII 판정** — `comparison_result` 자체(rank + savings +
   snapshot ID)가 `lockedInputs` 분리 후에도 *Recital 26의 익명*으로 분류
   가능한가. 베네룩스 인구 밀도 + 솔로 운영자 자원 수준에서 재식별
   "reasonably likely"한지 판정. 미통과 시 result 자체에도 90일 TTL 적용
   (T4 변경).

## Alternatives considered (요약)

| Trade-off | 채택 | 거부된 주요 대안 |
|---|---|---|
| T1 | 익명 UUID + userAccountId NULL 미리 | session UUID (Recital 26 가명화) |
| T2 | 평탄화 4 + JSONB | 전체 jsonb (인덱스 손실) / PC4→PC2 미리 일반화 (디버깅 손실) |
| T3 | (b) Contract + (a) 어필리에이트 동의 | (f) 단독 (LIA 부담) / (a) 단독 (P2 위반) |
| T4 | result 영구 + request PII 90일 후 NULL | 30일 완전 삭제 (영구 링크 깨짐) |
| T5 | IP 컬럼 0 | (해당 없음 — 헌법 §8 강제) |
| T6 | result + result_item 1:N | uuid[] (rank/caveats 표현 불가) |
| T7 | nanoid 12자 shortId | UUID 노출 (URL 부담) / Hashids (보안 미스매치) |
| T8 | requestId NULL + SET NULL | NOT NULL CASCADE (GDPR 삭제 시 영구 링크 깨짐) |
| T9 | lockedInputs JSONB + 90일 NULL | 결과 직접 컬럼 (영구 보존 충돌) |
| T10 | 동기 + 5초 timeout | Inngest 비동기 (무료 티어 한계 + UX) |

## 검증 방법

### 1. typecheck / lint / test 0 에러

`pnpm typecheck && pnpm lint && pnpm test:run`

### 2. `pnpm harness:plan` + `pnpm harness:data` 통과

- harness:plan — PLAN 1.4/1.5 갱신 후 합계 표 정합 (Rule 2). 본문에서 명시한
  파일 경로(`src/db/schema/comparison_request.ts`, `src/db/schema/comparison_result.ts`)
  는 verify-plan.ts의 fileRe(`/`(...)\.(ts|tsx|js|jsx|sql|md)`/)에 *literal*로
  매칭됨 — 글롭 `*` 사용 X (verify-plan harness 회귀 사례 회피).
- harness:data — 본 ADR이 추가하는 컬럼 중 P1 룰(Rule 4)에 영향 없음
  (`source_url`/`fetched_at`은 `tariff_snapshot` 단독). 다른 룰 무관.

### 3. 마이그레이션 SQL 시각 검토

`pnpm db:generate` → `drizzle/0003_*.sql` 의 다음 객체 모두 존재 확인:
- `CREATE TYPE household_type` enum (3값)
- `CREATE TABLE comparison_request` (12 컬럼 추정, NOT NULL 7개)
- `CREATE TABLE comparison_result` (10 컬럼 추정)
- `CREATE TABLE comparison_result_item` (8 컬럼 추정)
- FK 5개: request → provider(currentProviderId, SET NULL), result → request
  (SET NULL), result → tariff_snapshot(topTariffSnapshotId, RESTRICT),
  result_item → result(CASCADE), result_item → tariff_snapshot(RESTRICT)
- 인덱스: request `(category, postalCode)`, request `(createdAt)` (T4 cron),
  result `shortId` UNIQUE, result `(createdAt)` (B2B 집계), result_item
  `(resultId, rank)`

### 4. 비교 엔진 회귀 (1.11/1.12에서 본격화)

본 ADR이 1.12 12 케이스 단위 테스트의 *입출력 모양*을 결정. 정수 cents 산술
(ADR-0005 §T2)이 result_item 컬럼에 직접 들어가므로 ±0 cent 보장.

## 다음 단계

1. **마이그레이션 생성** (사용자 실행):
   ```bash
   pnpm db:generate    # drizzle/0003_*.sql 생성
   pnpm db:push        # Neon에 적용 (확인 후)
   ```
   → 생성된 SQL은 verifier가 시각 검토. ADR-0001/0005/0006 패턴과 동일.

2. **PLAN 1.4 + 1.5 본문 갱신** — 원안 표기를 본 ADR의 컬럼 셋 + DoD로 갱신.
   ADR-0005/0006 갱신과 동일 패턴. PLAN 1.5.2 cron의 보조 작업에 *PC4→PC2
   일반화* + *lockedInputs NULL화* 추가 (T4).

3. **`src/types/comparison-input.ts` 신설 (1.7과 함께)** — `inputAttributes`
   카테고리별 Zod 스키마 단일 출처.

4. **`nanoid` 의존 추가** — `pnpm add nanoid`. 의존 zero-deps + 150 bytes.

5. **legal 에이전트 후속 검토** — §Legal review pending 의 2 항목 (T3/T9).
   M8 베타 직전 또는 M16 평가 게이트에서 호출.

6. **페이즈 4.1 어트리뷰션 ADR (별도)** — `affiliate_click` 테이블. 본 ADR이
   `comparison_result_item.id` FK 가능성을 열어둠.

## References

- 헌법: [`CLAUDE.md`](../../CLAUDE.md) — P1 (정보 우선), P3 (투명성), P4 (타입
  안전), §8 #1 (사용자 데이터 외부 X), §8 #5 (추적 픽셀 X)
- 운영자: [`docs/FOUNDER.md`](../FOUNDER.md) — 솔로 사이드, 외부 변호사 불가
- 수익화: [`MONETIZATION.md`](../../MONETIZATION.md) §4 (절대 하지 않을 일),
  §D (Slim Insights, M24+, K ≥ 1,000)
- 관련 ADR:
  - [ADR-0001](0001-provider-schema.md) — `provider` (FK 부모)
  - [ADR-0003](0003-plan-realism-solo-side.md) — 솔로 사이드 가정
  - [ADR-0004](0004-monetization-solo-side-rebalance.md) — €300 cap, B2B M24+
  - [ADR-0005](0005-tariff-schema-telecom.md) — `tariff` (간접 FK)
  - [ADR-0006](0006-tariff-snapshot-schema.md) — `tariff_snapshot` (FK 부모)
- 외부 GDPR 사실:
  - [GDPR Art. 6 — Lawfulness of processing](https://gdpr-info.eu/art-6-gdpr/)
  - [GDPR Recital 26 — Anonymous / Pseudonymous](https://gdpr-info.eu/recitals/no-26/)
  - [EDPB Guidelines 1/2024 on legitimate interests (2024-10)](https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202401_legitimateinterest_en.pdf)
  - [EDPB Guidelines 2/2019 on Art. 6(1)(b) — contract performance](https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines-art_6-1-b-adopted_after_public_consultation_en.pdf)
  - [Koot 2010 — Re-identifiability of Dutch citizens (PETS)](https://petsymposium.org/2010/papers/hotpets10-Koot.pdf)
  - [k-anonymity (Wikipedia)](https://en.wikipedia.org/wiki/K-anonymity)
  - [Quasi-identifier (Wikipedia)](https://en.wikipedia.org/wiki/Quasi-identifier)
- Drizzle docs:
  - [pgEnum + relations](https://orm.drizzle.team/docs/sql-schema-declaration)
  - [text array column](https://orm.drizzle.team/docs/column-types/pg)
  - [jsonb 컬럼](https://orm.drizzle.team/docs/column-types/pg#jsonb)
- nanoid: [Async secure URL-friendly ID](https://github.com/ai/nanoid)
