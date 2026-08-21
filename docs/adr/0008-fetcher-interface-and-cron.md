# ADR-0008: Fetcher 인터페이스 + Inngest cron 인프라

## Status

Proposed (2026-05-09) — PLAN 항목 **1.6** + **1.7**. verifier가
typecheck/lint/test/harness:plan/harness:data 통과 확인 후 Accepted로 격상한다.

## Context

- PLAN 항목 **1.6** (Inngest cron 셋업) + **1.7** (Fetcher 인터페이스 정의).
  *짝을 이루는 결정* — cron이 fetcher를 호출하므로 인터페이스 모양과 cron의 step
  분할 정책이 한 ADR에서 함께 결정되어야 일관성이 깨지지 않는다.
- 본 ADR이 **확정하는 후속 작업**:
  - **1.8** Proximus / Orange BE / Telenet fetcher 3개 실 구현은 본 ADR의
    `Fetcher` 인터페이스 + `FetchResult` 모양만 따라가면 통과해야 한다.
  - **1.9** Fetcher 실패 격리 — 본 ADR의 `step.run()` 분할 + discriminated
    union 결과가 격리의 메커니즘.
  - **1.10** `/data-sources` 투명성 페이지는 본 ADR의 fetcher metadata + cron
    실행 결과(lastRunAt/confidence)를 표면화.
- 페이즈 0에서 만든 최소 스텁(`src/fetchers/types.ts`)은 *어떤 카테고리에도
  쓸 수 있는 제네릭 컨테이너*였다. 페이즈 1에서 통신 BE 카테고리가 확정되고
  (ADR-0005), 시계열 스키마(ADR-0006)가 fetcher의 출력 모양을 직접 결정하므로
  본 ADR은 **그 매핑을 타입으로 못 박는다**.
- **운영자 컨텍스트** (`docs/FOUNDER.md`): 솔로 사이드, 월 €300 ALL-IN, Inngest
  free tier 강제. 디버깅 용이성 + 무료 티어 한계가 *완벽한 일반화*보다 가중치가
  크다.

### 외부 사실 (검증된 출처 — 2026-05-09)

- **Inngest Hobby (Free) tier**:
  - **50,000 executions/월** ([Inngest Pricing](https://www.inngest.com/pricing))
  - **5 concurrent steps**
  - **100k events/월** included
  - **24h 추적/로그 보존**
  - 20회 연속 실패 시 함수 자동 일시정지 (Free 한정)
  - step timeout 명시값 부재 → 보수적으로 30s를 페이지 fetch + DB write 1회
    합산 상한으로 가정 (worst-case Vercel Edge function timeout과 일치)
- **Inngest Cron 표기**:
  - 표준 5필드 cron + `TZ=` 접두사 지원
    ([Scheduled Functions](https://www.inngest.com/docs/guides/scheduled-functions))
  - DST 전환 시간대(02-03 local) 회피 권장 → **항상 `TZ=UTC`** 사용
  - `jitter: '5m'` 옵션으로 thundering herd 분산 가능
- **Inngest + Next.js 15 App Router**:
  - `app/api/inngest/route.ts` 에서 `serve({ client, functions })` 호출
  - `GET`, `POST`, `PUT` 메서드 모두 export 필요
  - `INNGEST_EVENT_KEY` (이벤트 송신 인증) + `INNGEST_SIGNING_KEY` (서버 ↔
    Inngest 통신 서명) 두 환경변수
- **현재 운영 일정**: 3 fetcher × 일 1회 × 30일 ≈ **90 events/월** + 각 1
  fetcher 당 평균 6 step run (fetch → parse → upsert master → insert snapshot →
  update lastSeenAt → finalize) → **540 step runs/월**. Inngest Free 5만 한도의
  ≈1.1% — 안전 마진 90배.

## Decision

T1~T10 10개 결정.

### T1 — `FetchResult.data = TariffSnapshotInput[]` (옵션 B + 배열 채택)

`FetchResult` 의 `data` 필드는 *고정 모양 + 배열*. 한 fetcher가 한 provider의
*모든* tariff 스냅샷 인풋을 한 번에 반환한다.

```ts
type TariffSnapshotInput = {
  // ─── 마스터 식별자 (cron이 upsert에 사용) ───────────────────
  providerSlug: string;       // provider 테이블 slug FK lookup용
  tariffSlug: string;         // tariff 테이블 (providerId, slug) UNIQUE
  tariffName: string;
  category: TariffCategory;   // ADR-0005 enum 4값

  // ─── 가격 (cents) — ADR-0005 + ADR-0006 §T2 평탄화 5컬럼 ───
  monthlyPriceCents: number;
  activationFeeCents: number; // 무료 = 0
  modemRentalCents: number | null;
  promoPriceCents: number | null;
  promoMonths: number | null;
  promoDescription: string | null;

  // ─── 약정 ─────────────────────────────────────────────────
  commitmentMonths: number;   // 0 = 약정없음
  earlyTerminationFeeCents: number | null;

  // ─── 카테고리별 변동 — JSONB로 attributes ────────────────
  attributes: Record<string, unknown>; // Zod (1.8) 단일 출처

  // ─── 시계열 메타 (ADR-0006 NOT NULL) ──────────────────────
  sourceUrl: string;          // 정확한 페이지 URL
  confidence: 'high' | 'medium' | 'low';
  confidenceReason: string | null;
  rawPayload: Record<string, unknown>; // 정규화 JSON only (ADR-0006 §T3)
};
```

**근거:**
- ADR-0005 (`tariff` 마스터) + ADR-0006 (`tariff_snapshot` 시계열) 가 fetcher의
  출력 모양을 *이미 결정*. 제네릭으로 두면 fetcher 3개가 매번 매핑을 다르게
  만들 위험 — 페이즈 1.5.1 공통화에서 부채 폭발.
- ADR-0006 §T2 평탄화 5컬럼 + JSONB 미러를 *fetcher 책임*으로 강제 → cron
  step(insert)는 dumb mapping (1:1) → 디버깅 시 fetcher만 보면 됨.
- 배열 결정(provider 한 번에 N tariff): Proximus 페이지 한 번 fetch에 Smart 5
  / Smart 70 / Unlimited 등 3-7개 tariff 등장. fetcher 인스턴스를 카드별로
  쪼개면 (옵션 B) 같은 페이지를 N번 fetch — Inngest free 50k executions / 무료
  tier 도달이 N배 빨라짐.
- *카테고리별 attributes의 타입 안전*은 1.8 fetcher 구현 시 Zod 스키마
  (`src/types/tariff-attributes.ts`, ADR-0005 §결정 1)로 런타임 검증. 컴파일
  타임 안전은 카테고리별 generic으로 옵션 C 가능하지만 — 솔로 디버깅 + YAGNI로
  거부.

**거부된 대안 — 옵션 A (제네릭 `data: T`)**
- 장점: fetcher 자유도 ↑.
- 단점: 1.8 fetcher 3개가 출력 모양을 매번 다르게 만들면 cron step의 mapper가
  3중 분기 → 1.5.1 공통화에서 부채 폭발. 솔로 컨텍스트에서 가치보다 비용 큼.

**거부된 대안 — 옵션 C (카테고리별 generic `TariffSnapshotInput<TAttrs>`)**
- 장점: attributes 컴파일 타임 안전.
- 단점: cron step의 mapper가 generic 4분기 (4 카테고리). 페이즈 5 카테고리
  추가 시 generic 시그니처 마이그레이션. 페이즈 1에서 가치 0 (한 fetcher = 한
  카테고리). YAGNI.

### T2 — 페치 단위 = 한 fetcher = 한 provider의 *모든* tariff (옵션 A 채택)

```ts
interface Fetcher {
  readonly providerSlug: string;     // provider 테이블 slug
  readonly metadata: FetcherMetadata;
  fetch(): Promise<FetchOutcome>;    // 배열을 안에 담아 반환 (T4 union)
}
```

**근거:**
- T1과 일관 — 한 페이지 fetch에 N tariff 등장 (Proximus mobile subscription
  page에 Essential/Smart/Unlimited 동시 노출). N번 fetch = N배 무료 tier 소진.
- Inngest free 50k executions/월 한도 내에서 *N 인스턴스 모델은 즉시 위협*
  (3 provider × 평균 5 tariff × 매일 = 450 executions, 잘못 폭주 시 5천 도달
  쉬움). *3 인스턴스 모델은 90 executions/월* — 555배 안전 마진.
- 솔로 디버깅: "Proximus 깨짐" → 한 fetcher 파일 열기. tariff별 fetcher라면
  10개 파일 갈아엎기.

**거부된 대안 — 옵션 B (1 fetcher = 1 tariff)**
- 장점: 한 tariff 변경이 다른 tariff에 영향 0 (격리 강함).
- 단점: 페이지 N번 fetch (Inngest exec 폭증) + 코드 N배. 솔로 운영 비현실.

**거부된 대안 — 옵션 C (`Fetcher.list()` + `Fetcher.fetchOne(id)` 분할)**
- 장점: 어드민에서 "Proximus Smart 70만 재실행" 가능.
- 단점: 클래스 인스턴스 패턴 + 두 단계 호출 → cron step 분할 복잡. 페이즈 1
  운영 가치 0. 페이즈 4.5+ 어드민 dashboard 진입 시 재검토 가능 (별도 ADR).

### T3 — Confidence = 표준 휴리스틱 함수 + fetcher 자체 결정 hybrid (옵션 B 채택, 단 fetcher가 override 가능)

`src/fetchers/confidence.ts` (1.8과 함께 신설) 에 `computeConfidence(input)`
공통 휴리스틱. fetcher는 기본값으로 사용하되, 자체 sanity 체크 결과로 *down-grade*
override 가능 (up-grade는 거부 — 휴리스틱이 보수적이라야 안전).

**휴리스틱 (ADR-0006 §T4 예시 기반)**:
- `monthlyPriceCents <= 0` → `low` + `"non-positive price"`
- `monthlyPriceCents > 100,000` (€1,000/월 초과 — 통신 BE에서 비현실) → `low`
- 정상가가 직전 스냅샷 대비 ±50% 변동 의심 → cron step이 anomaly 마킹 (fetcher
  외부)
- `rawPayload.warnings.length > 0` → `medium`
- 위 조건 모두 통과 → `high`

**근거:**
- ADR-0006 §T4가 confidence enum 자체는 결정. 본 ADR은 *결정 책임*을 못 박는다.
- fetcher가 자체 결정만 하면 (옵션 A) 3개 fetcher가 매번 다른 기준 → 비교 결과
  의 색상 매핑 불일치 → P1 위반.
- 표준 휴리스틱만 (옵션 B 순수)이면 fetcher가 알아낸 fragile selector 정보를
  못 살림. **Hybrid: 휴리스틱은 floor (최소 보수), fetcher는 down-grade만**.
- ADR-0001의 `excluded_reason: text` + ADR-0006의 `confidence_reason`
  운영 관용구와 일관 — *enum + 근거 텍스트*.

**거부된 대안 — 옵션 A (fetcher 자체 결정만)**
- 장점: fetcher가 자기 안정성에 100% 책임.
- 단점: 3 fetcher 기준 불일치 → 사용자가 보는 "신뢰도" 색의 의미가 fetcher마다
  다름 → P3 위반 (운영자 자가 일관성 잃음).

### T4 — Discriminated union 결과 (옵션 C 채택)

```ts
type FetchOutcome =
  | { ok: true; result: FetchResult }
  | { ok: false; error: FetchError };

interface FetchResult {
  fetcherSlug: string;
  fetchedAt: string;          // ISO 8601 — cron이 ADR-0006 fetched_at으로 사용
  data: TariffSnapshotInput[];
}

interface FetchError {
  fetcherSlug: string;
  fetchedAt: string;          // 실패도 시각 보존 (P1 사후 분석)
  kind: 'network' | 'parse' | 'sanity' | 'unknown';
  message: string;
  rawPayload?: Record<string, unknown>; // 부분 raw로 디버깅 가능
}
```

**근거:**
- 옵션 A (throw + step.run catch) 만으로는 fetcher가 *부분 성공* 표현 불가
  (예: "Proximus 페이지 5개 중 3개만 파싱 성공"). **부분 성공은 throw로
  표현하면 catch 후 정보 0**.
- 옵션 B (`success: boolean` + optional error)는 type-narrowing 약함
  (`result.data` 가 `success: false`에서 undefined인지 컴파일러가 모름).
- discriminated union(`ok: true | false`)은 TypeScript exhaustive check + cron
  step에서 `if (!outcome.ok) ...` 분기 명확.
- 1.9 격리(다음 fetcher 진행)는 cron step에서 `outcome.ok` 검사 후 Sentry로
  보고 + 다음 step으로 진행 — *본 ADR이 격리 메커니즘 결정*.

**거부된 대안 — 옵션 A (throw)**
- 장점: 가장 단순.
- 단점: 부분 성공 표현 불가, raw_payload 보존 불가, P1 위반 위험.

**거부된 대안 — 옵션 B (`success` + optional)**
- 장점: 단순.
- 단점: type narrowing 약함. exactOptionalPropertyTypes 환경에서 verbose.

### T5 — Fetcher metadata = 인터페이스 안 객체 (옵션 A 채택)

```ts
interface FetcherMetadata {
  readonly providerSlug: string;     // provider 테이블 slug FK
  readonly displayName: string;      // /data-sources 1.10 노출
  readonly country: 'BE' | 'NL' | 'LU';
  readonly method: 'api' | 'scraping' | 'manual';  // P3 투명성
  readonly version: string;          // "proximus@2026-05-09" — rawPayload.fetcher_version
  readonly homepageUrl: string;      // /data-sources 링크
}
```

`src/fetchers/index.ts` 에 *추가로* registry pattern (옵션 B 병행). registry는
1.6 cron이 fetchers를 import하는 단일 진입점.

**근거:**
- 1.10 `/data-sources` 페이지가 표시할 정보는 *fetcher 자체가 선언*하는 게
  진실 단일 출처. provider 테이블이 마스터지만, fetcher가 *어떻게 가져오는지*는
  코드에서만 알 수 있다.
- registry는 cron 호출 + 어드민 발견을 위한 운영 자산. fetcher 자체에 metadata
  넣고 registry는 단순 배열 export — 두 모델 모두 채택 시 진실 단일 출처는
  fetcher 객체.
- ADR-0001 `provider.affiliate_status` 와 분리: provider는 *세무/계약*, fetcher
  metadata는 *코드 작동 방식*. 한 provider에 두 fetcher가 붙는 시나리오(예:
  Proximus mobile + internet 따로)도 자연스럽게 표현.

**거부된 대안 — 옵션 B만 (registry 단독, fetcher에는 providerId만)**
- 장점: 인터페이스 단순.
- 단점: `/data-sources` 페이지가 어디서 method/version 가져오나? registry에
  중복 선언? → 진실 단일 출처 손실.

### T6 — Cron 주기 = 일 1회 일괄 (옵션 A 채택, 수동 트리거 지원)

```ts
inngest.createFunction(
  {
    id: 'daily-fetch-all',
    triggers: [
      { cron: 'TZ=UTC 0 6 * * *' },        // 매일 06:00 UTC = 07:00~08:00 BE
      { event: 'fetchers/run.requested' }, // 수동 트리거 (어드민 / 디버깅)
    ],
  },
  async ({ step, event }) => { /* T7 */ },
);
```

**근거:**
- ADR-0006 §T1 — 일 1회는 통신 카테고리 가격 변동 빈도(분기/반기)에 충분.
- 06:00 UTC = BE 07-08시 (DST 따라). 사용자가 깨어나기 전 신선한 데이터.
  공급사 사이트 트래픽 골짜기.
- 단일 cron + 일괄 step.run = Inngest UI에서 *한 줄로 실행 추적*. 솔로 운영 +
  Inngest free 24h 로그 보존 한계와 양립.
- 수동 이벤트 트리거 동시 등록 — 어드민 / 로컬 디버깅에서 즉시 재실행 가능.
  cron 함수 신호 한 곳으로 통일 (옵션 A + C 결합).
- DST 전환은 `TZ=UTC` 명시로 회피 (Inngest 권장).

**거부된 대안 — 옵션 B (fetcher별로 다른 시간)**
- 장점: 공급사 부하 분산, 한 번에 셋이 깨지는 위험 ↓.
- 단점: 함수 3개 → Inngest UI 추적 산만, 솔로 디버깅 시 "어느 함수 보지?" 인지
  부하. *3 fetcher 부하는 1초당 1 req 미만*이라 분산 가치 0.

### T7 — Step 분할 = 1 step = 1 fetcher run + 분리된 1 step = DB write (옵션 C 채택)

```ts
// 의사코드
async ({ step, logger }) => {
  for (const fetcher of registry) {
    // Step A: 네트워크 + 파싱 (재시도 가능, 30s timeout)
    const outcome = await step.run(
      `fetch-${fetcher.metadata.providerSlug}`,
      async () => fetcher.fetch(),
    );

    if (!outcome.ok) {
      // 1.9 실패 격리: 다음 fetcher로 진행
      logger.error({ fetcher: fetcher.metadata.providerSlug, error: outcome.error });
      // Sentry capture는 별도 step 없이 logger 자체로 (ADR-0008 §T10)
      continue;
    }

    // Step B: DB write (마스터 upsert + 스냅샷 insert + lastSeenAt)
    await step.run(
      `persist-${fetcher.metadata.providerSlug}`,
      async () => persistFetchResult(outcome.result),
    );
  }
},
```

**근거:**
- 옵션 A (1 step = 1 fetcher): 네트워크 실패 시 DB write까지 재시도 = 같은
  raw_payload로 중복 insert 위험 (ADR-0006 §T1 append-only를 *원하지 않는
  중복으로 더럽힘*).
- 옵션 B (1 step = 1 snapshot insert): step run 카운트 N×M (3 fetcher × 평균
  5 tariff × 매일 = 450/월, 무료 50k의 1%). *수치는 안전*하지만 cron 실행 1회의
  Inngest UI 트레이스가 50줄로 산만.
- **옵션 C (네트워크 step + DB step 분리)**: 네트워크 실패는 fetch step만
  재시도 → raw_payload 1회만 insert. DB step은 트랜잭션이라 원자적.
  step run/cron = 6 (3 × 2). 무료 한도 90×365 = ~33k/년 (50k 한도 안). UI 트레이스
  = 6줄 (한 눈에 보임).
- 1.9 실패 격리는 `for ... continue` 루프 + 각 fetcher가 자체 step → 한
  fetcher 폭발이 다음 fetcher에 영향 0.
- **후속 메일 7일 트리거** (ADR-0028 §T6) — 동일 step.run() 패턴 (네트워크 + DB write 분리 + idempotency 필터) 재사용.

**거부된 대안 — 옵션 B (1 step = 1 insert)**
- 장점: DB 실패 시 1 insert만 재시도.
- 단점: step run 카운트 5배. UI 트레이스 산만. 솔로 디버깅 부담.

### T8 — Event = `fetchers/run.requested`

```ts
type FetchersRunRequested = {
  name: 'fetchers/run.requested';
  data: {
    requestedBy: 'cron' | 'admin' | 'dev';
    only?: string[]; // 특정 provider slug만 (디버깅)
  };
};
```

**근거:**
- Inngest 컨벤션: `<entity>/<action>.<state>` (kebab + dot). 헌법 §6 명령어
  사전 외 추가 영역이지만 Inngest 자체 표준 따름.
- `only?` 필드 — 솔로 디버깅 시 "Proximus만 다시 돌려" 가능. 평소 cron은 없이.
- 페이즈 5에서 카테고리 추가되어도 동일 이벤트로 통일 가능 (`only`로 분리 가능).

### T9 — API route = `src/app/api/inngest/route.ts` + 환경변수 2개

`.env.local` 에 **두 개**:
```bash
INNGEST_EVENT_KEY=...   # https://app.inngest.com/env/production/manage/keys
INNGEST_SIGNING_KEY=...
```

`.env.example` 에 placeholder + 코멘트로 무료 티어 가입 안내.

**dev/local**: 환경변수 부재 시 Inngest는 자동으로 dev mode (로컬 devserver
경유). 프로덕션은 두 키 모두 필요.

**근거:**
- Next.js 15 App Router 표준 위치 (`app/api/<name>/route.ts`).
- 단, 본 프로젝트는 `src/app/...` 구조 (`src/app/page.tsx` 존재 확인됨) →
  **실제 경로 = `src/app/api/inngest/route.ts`**.
- 두 키는 Inngest 공식 문서 기준 ([Inngest serve()](https://www.inngest.com/docs/sdk/serve))
  필수. 키 부재 시 dev mode 자동 fallback도 공식.

### T10 — Fetcher 실행 컨텍스트 = DB는 module-level 싱글턴 + step별 fresh logger

**DB**: `src/db/index.ts` 의 `db` 싱글턴을 모든 step이 공유. Neon serverless +
`@neondatabase/serverless` HTTP 드라이버는 connection pooling이 *서버리스*
환경에서 자동 — Inngest worker process마다 1 connection만 유지.

**Logger**: Inngest의 step context (`{ step, logger }`)에서 logger 사용. Sentry
캡처는 `logger.error` 내부에서 (Sentry SDK는 페이즈 0에서 통합됨, page 4.5.2
정식화).

**Timeout**: step별 30s 보수 가정. fetcher fetch에서 AbortController로 25s
명시 (5s 마진 — DB write timeout 여유).

**근거:**
- Neon serverless HTTP 드라이버는 stateless — connection pool 부담 없음
  (`@neondatabase/serverless` 0.10).
- step.run() 내 throw는 Inngest가 자동 retry (default 3회) + Sentry는 logger를
  통해 캡처 (페이지 4.5.2 정식화 예정).
- 25s fetch timeout은 *일반적인* 페이지 응답 (Proximus avg 432ms — ADR-0006
  rawPayload 예시) 의 50배 마진. 30s step timeout 전에 명확히 끝남.

## Consequences

### 얻는 것

- 1.8 fetcher 3개 구현이 *본 ADR만 따라가면* 통과 (T1~T5 인터페이스 + T6~T10
  cron 인프라).
- ADR-0005 / ADR-0006 의 스키마 결정이 fetcher 출력 모양으로 *타입 강제* —
  매핑 일관성 컴파일 타임 보장.
- Inngest free tier 90 events/월 + ~180 step runs/월 = 한도의 0.4% — 555배 안전
  마진. 솔로가 잘못 폭주해도 알아챌 시간 충분.
- 1.9 실패 격리가 *for-loop continue* + discriminated union으로 본 ADR 단계에서
  완료. 1.9는 별도 코드 작업 없이 ADR 채택만으로 통과.
- 1.10 `/data-sources` 페이지가 fetcher.metadata + tariff.lastSeenAt 두 입력
  으로 자연 구성 — P3 투명성.
- harness:data Rule 1 (`src/fetchers/**/*.ts` 가 `FetchResult` 반환) 통과 유지
  — 인터페이스 이름 보존.

### 잃는 것 / 부채

- **카테고리별 attributes 컴파일 타임 안전 부재** (T1 거부 대안 C). 1.8 fetcher
  구현 시 Zod 스키마(`src/types/tariff-attributes.ts`) 가 단일 출처 — 런타임
  검증으로 전이됨. 페이즈 5에서 카테고리 추가 시 generic 도입 검토.
- **Tariff별 재실행 불가** (T2 옵션 C 거부). 어드민 dashboard(4.5.1) 또는
  페이즈 5 진입 시 별도 ADR로 `Fetcher.fetchOne(slug)` 추가 검토.
- **수동 트리거 인증 부재** (T6/T8). `fetchers/run.requested` 이벤트는 누구나
  Inngest 키로 발사 가능. 페이즈 4.5 어드민 대시보드 신설 시 별도 가드 ADR.
- **Inngest free tier 재해석 불가**. 페이즈 5 카테고리 확장으로 fetcher 5+,
  하루 2회 격상 시 (PLAN 1.6 본문) 한도 재검토 — 별도 ADR.

### 후속 작업 (다른 PLAN 항목과 연결)

- **1.8** Proximus / Orange BE / Telenet fetcher: 본 ADR §T1 `TariffSnapshotInput`
  + §T4 `FetchOutcome` 만 구현. `Fetcher` 객체로 export, registry에 추가.
- **1.9** Fetcher 실패 격리: 본 ADR §T7 `for...continue` 패턴이 *메커니즘
  자체*. 별도 코드 작업 없음 — 1.8 fetcher 구현 + ADR 채택으로 통과.
- **1.10** `/data-sources` 페이지: `registry.map(f => f.metadata)` + provider별
  `tariff.lastSeenAt` 조회. P3 투명성 (method 필드 노출 — api/scraping/manual).
- **1.5.2** `harness:price` cron: 본 ADR cron 인프라 *재사용*. 별도 cron
  function 추가 (anomaly 감지 알고리즘 ADR-0006 §T5). step.run() 패턴 동일.
- **4.5.2** Sentry 알림: 본 ADR §T10 `logger.error` → Sentry 캡처. 임계값은
  4.5.2에서 결정.

## Alternatives considered (요약)

| Trade-off | 채택 | 거부된 주요 대안 |
|---|---|---|
| T1 | `data: TariffSnapshotInput[]` 고정 모양 | 제네릭 `data: T` (1.5.1 부채) / 카테고리 generic (YAGNI) |
| T2 | 1 fetcher = 1 provider all tariffs | 1 fetcher = 1 tariff (Inngest exec N배) |
| T3 | 표준 휴리스틱 + fetcher down-grade | 자체 결정만 (3 fetcher 기준 불일치) |
| T4 | discriminated union | throw (부분 성공 손실) / optional error (narrow 약함) |
| T5 | 인터페이스 metadata + registry | registry-only (단일 출처 손실) |
| T6 | 일 1회 06:00 UTC + 수동 이벤트 | fetcher별 시간 분산 (UI 산만) |
| T7 | 네트워크 step + DB step 분리 | 1 step (재시도 시 중복) / 1 step per insert (UI 산만) |
| T8 | `fetchers/run.requested` | (대안 없음 — Inngest 컨벤션) |
| T9 | `src/app/api/inngest/route.ts` + 2 env keys | (대안 없음 — 공식 위치) |
| T10 | DB 싱글턴 + step별 logger | step별 fresh DB (서버리스 무가치) |

## 검증 방법

### 1. typecheck / lint / test 0 에러

`pnpm typecheck && pnpm lint && pnpm test:run` — `src/fetchers/types.ts`,
`src/fetchers/index.ts`, `src/lib/inngest.ts`, `src/inngest/functions.ts`,
`src/app/api/inngest/route.ts` 모두 strict 통과.

### 2. `pnpm harness:data` Rule 1 통과 유지

`src/fetchers/**/*.ts` (types.ts 제외) 의 fetcher 파일이 `FetchResult` 이름을
포함해야 통과. 본 ADR이 인터페이스를 evolve하면서도 `FetchResult` 식별자는
보존(타입 이름 그대로) — Rule 1 회귀 0.

### 3. `pnpm harness:plan` 통과

PLAN 1.6 / 1.7 본문에 *예상 파일 경로*가 백틱으로 노출됨 — verify-plan이
parse하지만 [x] 마킹은 사용자 승인 후 plan-tracker가 처리. 본 ADR은 [x]를 직접
하지 않음.

### 4. Inngest dev 모드 로컬 실행

`pnpm dev` + `npx inngest-cli@latest dev` 후 http://127.0.0.1:8288 에서
`fetchers/run.requested` 이벤트 발사 → cron 함수가 dry-run mode (fetcher 0개
등록된 1.8 진입 전)로 ok 응답.

### 5. 1.8 진입 시 회귀 (이 ADR이 옳은지)

- fetcher 3개 구현 후 `pnpm test` 통과 (각 fetcher 단위 테스트)
- 일 1회 cron 실 가동 후 Inngest UI에서 step run 카운트 ≤ 6/cron 확인
- Neon DB에 `tariff_snapshot` 행 3 fetcher × N tariff 매일 1행씩 누적 확인

## Amendment 1 (2026-08-19) — `FetchResult.retiredCategories` (커버 중단 선언)

**Status: Accepted (2026-08-19)** — PLAN 4.26.a 중 Orange BE 사고로 발화.

### 문제 (실측)

`persistFetchResult` 의 단종 처리(ADR-0005 §T5)는 **이번 fetch 가 실제로 본
카테고리** 안에서만 `isActive=false` 를 놓는다. 이 스코프 제한은 "mobile 만
긁는 fetcher 가 manual internet 데이터를 지우는" 사고를 막기 위한 것이었다.

그런데 공급사가 페이지를 개편해 한 카테고리를 **통째로 못 긁게 되면** 부작용이
생긴다: 그 카테고리 요금제는 아무도 관측하지 않으므로 영원히 `isActive=true` 로
남는다. 2026-08-19 Orange BE 가 정확히 이 상태였다 — `internet-chez-vous` 가
JS 렌더로 전환되며 정적 가격이 사라졌고 (`.obe-pricebox` 0개 / `obe-dps-price`
마커 8개), 상품명도 Start·Zen·Giga → Livebox 계열로 개편됐다. 즉 **더 이상
존재하지 않는 상품이 현재가처럼 노출될 수 있는 상태**였다 (P1/P3 위반).

### 결정

`FetchResult` 에 optional 필드 하나를 더한다:

```ts
readonly retiredCategories?: readonly TariffCategory[];
```

fetcher 가 "이 카테고리는 더 이상 내 소관이 아니다" 라고 선언하면 persist 가
해당 (provider, category) 요금제를 전부 비활성화한다. **`data` 에 실제로 담긴
카테고리는 이 선언을 이긴다** — 공급사가 정적 가격을 되돌리면 코드 수정 없이
자동 복구된다.

- optional 이므로 기존 fetcher 3종 중 선언하지 않는 것은 동작 변화 0.
- 첫 사용처: `orange-be` 의 `internet_fixed`.
- 회귀 테스트: `src/inngest/persist.test.ts` 케이스 5 (선언 → 카테고리 전체
  비활성화 / 실측이 선언을 이김) 2건.

### 대안 (기각)

- **일회성 운영자 스크립트** — 지금 한 번은 해결하지만 다음 공급사 개편에서
  같은 사고가 반복된다. 사고 재발 방지가 안 됨.
- **fetcher 실패 시 provider 전체 비활성화** — 일시적 네트워크 장애로 공급사가
  통째로 사라진다. 원래 스코프 제한이 막으려던 사고 그대로.

## 다음 단계

1. **사용자 작업** (수동, 1회):
   - [Inngest 무료 가입](https://app.inngest.com/sign-up) → app `slim-prod`
     생성 → keys 페이지에서 `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` 복사 →
     `.env.local` 에 추가 (production 키는 Vercel env vars에).
   - 로컬 dev: `pnpm add -D inngest-cli` 후 `npx inngest-cli@latest dev`
     실행 (Inngest 공식 dev server, 별도 가입 불필요).

2. **builder 인계** (1.7 코드):
   - `src/fetchers/types.ts` 갱신 (T1~T5 반영)
   - `src/fetchers/index.ts` 신설 (registry + helper)
   - `src/lib/inngest.ts` 신설 (client)
   - `src/inngest/functions.ts` 신설 (cron + persist)
   - `src/app/api/inngest/route.ts` 신설 (serve)
   - `src/fetchers/types.test.ts` 갱신 (proximus-be 예시)
   - `.env.example` 갱신
   - PLAN 1.6 / 1.7 본문 갱신 (DoD에 파일명 + env keys)

3. **1.8 진입 시 의존성**:
   - 본 ADR 채택 → 1.8은 `Fetcher` 객체 구현 + registry 추가만. 인터페이스 변경
     불가.
   - Zod attributes 스키마 (`src/types/tariff-attributes.ts`)는 1.8과 함께 신설
     (ADR-0005 §결정 1).
   - `computeConfidence()` (`src/fetchers/confidence.ts`)는 1.8과 함께 신설
     (T3 휴리스틱).

4. **1.9 진입 시**: 본 ADR §T7 패턴이 격리 자체 — 추가 코드 0. 1.9 DoD는
   "한 fetcher가 throw해도 다른 두 개는 step run 성공" — 1.8 통합 테스트로 검증.

## References

- 헌법: [`CLAUDE.md`](../../CLAUDE.md) — P1 (정보 우선), P3 (투명성), P4 (타입
  안전), P5 (ADR), §5 기술 스택 (Inngest)
- 운영자: [`docs/FOUNDER.md`](../FOUNDER.md) — 솔로 사이드, 무료 티어 우선
- 관련 ADR:
  - [ADR-0001](0001-provider-schema.md) — `provider` 마스터 (FK 조부모)
  - [ADR-0005](0005-tariff-schema-telecom.md) — `tariff` 마스터 (fetcher
    출력 매핑 대상)
  - [ADR-0006](0006-tariff-snapshot-schema.md) — `tariff_snapshot` 시계열
    (fetcher가 직접 insert할 테이블, NOT NULL 컬럼이 인터페이스로 전이)
  - [ADR-0007](0007-comparison-request-result-schema.md) — 비교 요청/결과
    (fetcher 외부 — 본 ADR과 직교)
- Inngest 공식 문서:
  - [Inngest Pricing — Hobby (free) tier](https://www.inngest.com/pricing)
  - [Inngest serve() — Next.js App Router](https://www.inngest.com/docs/sdk/serve)
  - [Inngest Scheduled Functions (cron)](https://www.inngest.com/docs/guides/scheduled-functions)
- 외부 사실:
  - Vercel Edge function timeout — 30s (Hobby) 보수 가정
- Harness:
  - [`scripts/harness/data-fidelity.ts`](../../scripts/harness/data-fidelity.ts)
    Rule 1 — `FetchResult` 반환 검증 (본 ADR 인터페이스가 통과시키는 룰)
