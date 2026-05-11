# ADR-0022: DB 환경 분리 정책 — production / preview / development 3 브랜치 + prod URL Console-only SoT

## Status

**Proposed** (운영자 승인 대기 — GATE-O). 본 ADR은 *정책 결정 + builder/운영자 인계 명세* 를 담는다. 코드 변경은 D.4.c (`scripts/verify-db.ts` allowlist 3개 확장 + `.env.local.example` 갱신) 한 건, 나머지는 운영자 Neon/Vercel 콘솔 작업.

> 작성 메모: PLAN §D.3.e + ADR-0020 §결정 6 가 "별도 ADR (가칭 ADR-0022)" 로 *Neon-side Vercel Integration* 을 느슨하게 예약해 뒀으나, 그 항목은 페이즈 4 베타 진입(GATE-K) 시점의 미작성 트리거다. 본 ADR(=실제로 지금 작성됨)이 0022를 소비하고, Neon Vercel Integration ADR 은 다음 번호(ADR-0023+)로 이연한다. PLAN §D.3.e 와 ADR-0020 §결정 6 의 "가칭 ADR-0022" 참조는 "가칭 ADR-0023" 으로 재지정 필요 (scribe 후속 정리).

## Context

ADR-0017 (DB 미스매치 사건) + ADR-0018 (Neon 멀티 org 정책) 이후에도 **DB 환경 경계가 2개(production + preview)에서 멈춰 있고, 로컬 개발이 어디를 가리키는지는 정책으로 못박히지 않았다.**

| 환경 | 현 상태 (ADR-0015 §T3 + ADR-0017 §결정 2 기준) | 빈틈 |
|---|---|---|
| production | Neon main 브랜치 `ep-fancy-fog-alt18340` — 베타/런치 사용자 데이터 | connection string(비번 포함)이 채팅에 2회 노출됨 (ADR-0017). 회전했지만 *영속 저장 위치* 가 정의 안 됨 |
| preview | `ep-autumn-water-all6d93e` — Vercel preview 빌드 전용, 일회성 | 정의됨. 단 로컬 개발이 이걸 겸용하면 Vercel CI 자동 주입과 충돌 |
| development (로컬) | **미정의** — `.env.local`의 `DATABASE_URL`이 사실상 production 을 가리킬 수 있음 | `pnpm dev` / `pnpm test` / 마이그레이션 dry-run 이 production 데이터를 오염시킬 위험. ADR-0017 재발 벡터 |

핵심 문제 3가지:

1. **prod connection string 산재 위험** — `.env.local`, Vercel env, 채팅, 스크린샷 등 여러 곳에 흩어지면 노출 표면이 N배. ADR-0018 §결정 7은 "채팅 공유 금지"만 다루지 어디에 *저장* 하는가는 미정.
2. **로컬 작업의 production 오염 위험** — 로컬 `.env.local`이 production을 가리키면 `db:push`(스키마 변경), 시드 스크립트, 테스트가 production 브랜치에 적용된다. ADR-0017 사건의 본질이 바로 "의도와 다른 브랜치에 db:push".
3. **진실원(SoT) 모호** — production 접속 정보가 "어디를 보면 정답인가"가 없다.

PLAN 매핑: 페이즈 0.5 — **D.4** (신설). ADR-0017/0018 의 직접 후속 (사건 → 멀티 org 정책 → **환경 경계 정책**).

## Decision

### D1 — Neon 브랜치 3개로 분리: production / preview / development

| 브랜치 | endpoint (name) | 용도 | 누가 주입하나 | 데이터 성격 |
|---|---|---|---|---|
| `production` | `ep-fancy-fog-alt18340` | 베타/런치 실사용자 | 운영자가 **인라인 명령으로만** (D4) | 영속 — 절대 오염 금지 |
| `preview` | `ep-autumn-water-all6d93e` | Vercel preview 배포 | Vercel preview env (자동) | 일회성 — 폐기 가능 |
| `development` | (신규 — 운영자가 Neon Console에서 `production`에서 branch 생성, 가칭 `ep-dev-XXXX`) | 로컬 `pnpm dev` / `pnpm test` / 마이그레이션 dry-run | `.env.local`의 `DATABASE_URL` **기본값** | 폐기 가능 — 시드만, 실사용자 0 |

- 로컬 개발의 *디폴트* 는 항상 `development` 브랜치. `pnpm dev`를 평소대로 돌렸을 때 production을 만질 가능성이 **구조적으로 0** 이 되게 한다.
- `preview`를 로컬에서 겸용하지 않는다 — Vercel CI가 preview env를 자동 관리/덮어쓰므로 로컬과 충돌 + "일회성" 성격이 깨진다.
- `development` 브랜치는 Neon Free tier 안에서 `production`의 가벼운 복제 — provider 시드 2행 + 테스트용 tariff_snapshot 정도만. 무거워지면 회귀 트리거 #3.

### D2 — production connection string은 **Neon Console 만 SoT**, 어디에도 영속 저장 안 함

- production 의 *전체 connection string* (`postgres://user:PASSWORD@ep-fancy-fog-alt18340-pooler...`) 은 `.env.local`, repo, ADR 본문, 채팅, 스크린샷, 메모 — **어디에도 적지 않는다**.
- 운영자가 production 작업이 필요할 때만 그때그때 **Neon Console → Slim 프로젝트 → Branches → `production` → Connection details** 에서 복사해 *그 명령 한 줄* 에만 쓴다 (D4). 명령이 끝나면 그 문자열은 셸 히스토리 외에는 어디에도 안 남는다 (셸 히스토리는 운영자가 알아서 — `Clear-History` 또는 `HISTCONTROL=ignorespace`).
- ADR-0018 §결정 7 ("외부 endpoint 채팅 공유 금지") 의 강화·구체화:
  - endpoint **name** 만 (`ep-fancy-fog-alt18340`) — allowlist 가드에 필요하므로 ADR/PLAN/`.env.local` 에 적어도 됨. 이건 비번이 아니라 식별자.
  - **전체 connection string** (비번 포함) — 절대 영속화 안 함. 채팅 공유는 ADR-0018 §결정 7 그대로 금지.

### D3 — `EXPECTED_DB_ENDPOINTS` allowlist 가드를 3 endpoint 로 확장

`scripts/verify-db.ts` 는 이미 `EXPECTED_DB_ENDPOINTS` 콤마 구분 allowlist 를 지원한다 (ADR-0017 §결정 2, 2026-05-10). 본 ADR은 그 allowlist 의 *내용* 을 3개로 늘린다.

- **로컬 `.env.local`** (`.env.local.example` 에 주석으로 반영):
  ```
  DATABASE_URL="postgres://...development 브랜치..."
  EXPECTED_DB_ENDPOINTS="ep-fancy-fog-alt18340,ep-autumn-water-all6d93e,ep-dev-XXXX"
  ```
  로컬에서 `DATABASE_URL` 이 어느 브랜치든 *3개 중 하나* 라야 `pnpm verify:db` 통과. 인라인으로 production을 잠깐 가리켜도(D4) production endpoint 가 allowlist 에 있으니 통과 — 의도된 동작.
- **Vercel production env**: `EXPECTED_DB_ENDPOINTS = ep-fancy-fog-alt18340` (단일). production 배포가 다른 endpoint 를 받으면 즉시 실패.
- **Vercel preview env**: `EXPECTED_DB_ENDPOINTS = ep-autumn-water-all6d93e` (단일).
- `scripts/hooks/stop-gate.sh` Gate 5 는 `.env.local` 부재 시 skip — CI 안전, 기존 그대로.

### D4 — production 접근은 **인라인 `DATABASE_URL=...` 명령으로만**

production 에 대한 `db:push` / 시드 / 임시 쿼리는 `.env.local` 을 *건드리지 않고* 한 줄 인라인으로:

- **PowerShell** (운영자 기본 셸):
  ```powershell
  $env:DATABASE_URL = "postgres://...prod connection string from Neon Console..."
  pnpm db:push          # 또는 pnpm exec tsx scripts/seed-stub-tariffs.ts 등
  Remove-Item Env:\DATABASE_URL   # 명령 끝나면 즉시 정리
  ```
- **bash** (Bash 도구 / CI):
  ```bash
  DATABASE_URL="postgres://...prod..." pnpm db:push
  ```

근거 — 이렇게 하면:
1. prod URL 이 디스크(`.env.local`)에 **안 남는다** (D2 강제).
2. 명령이 끝나면 환경변수에서 **사라진다** — 다음 `pnpm dev` 는 자동으로 `development` 브랜치 (`.env.local` 기본값).
3. production 을 만지는 건 항상 *명시적이고 의도적인* 한 줄 — ADR-0017 사건("무심코 db:push") 의 구조적 재발 방지.

dotenv 상호작용 명시: `verify-db.ts` / 시드 스크립트는 `config({ path: '.env.local' })` 를 호출하지만 `dotenv` 는 기본적으로 **이미 존재하는 환경변수를 덮지 않는다** (`override: false`). 따라서 인라인 `$env:DATABASE_URL` 이 `.env.local` 의 `DATABASE_URL` 보다 **우선** 한다 — 의도대로 동작. 이 동작이 dotenv 버전업으로 바뀌면 회귀 트리거 #5.

## Alternatives considered

### 대안 1 — production 단일 브랜치 + 로컬도 production 사용 (현 암묵 상태) — 거부

- 장점: 브랜치 1개, 운영자 추가 작업 0.
- 단점: ADR-0017 사건의 재발 벡터를 그대로 둠. 로컬 `db:push`/시드/테스트가 실사용자 데이터를 오염. 베타 진입 시 치명적.
- **거부 사유**: ADR-0017 가 이미 발생한 사건. "다시 안 일어난다" 는 보장이 없으면 정책이 아니다.

### 대안 2 — preview 를 로컬 개발에도 겸용 (2 브랜치 유지) — 거부

- 장점: 새 브랜치 0.
- 단점: Vercel preview env 가 preview 브랜치를 자동 주입/관리한다. 로컬이 같은 브랜치를 쓰면 (a) Vercel CI 와 스키마 상태가 엇갈리고 (b) "preview = 일회성" 성격이 깨진다 (로컬 작업 데이터가 preview 배포에 보임).
- **거부 사유**: 환경 격리의 목적(=서로 영향 0)에 정면 위배.

### 대안 3 — prod URL 을 `.env.production.local` 에 저장 + `.gitignore` — 거부

- 장점: 매번 Console 에서 복사 안 해도 됨.
- 단점: 디스크에 영속 = 노출 표면 (백업, IDE 인덱싱, 실수로 commit, 화면 공유). ADR-0017 의 교훈은 "connection string 은 가능한 한 휘발성으로".
- **거부 사유**: Console-only SoT (D2) 가 엄격하게 더 안전. 매번 복사하는 마찰은 production 작업이 *드물어야 정상* 이므로 수용 가능 (자주 한다면 그 자체가 신호 — 회귀 트리거 #6).

### 대안 4 — Neon Vercel Integration 으로 PR 마다 자동 branch (PLAN §D.3.e) — 이연

- 장점: PR 별 완전 격리, 운영자 수동 작업 0.
- 단점: Neon Free branch 한도, 자동 생성 자산 추적 부담 (ADR-0017 `slim-prod` hidden-recipe 사건의 그 메커니즘), 페이즈 4 베타 진입 전엔 과잉.
- **이연 사유**: GATE-K (페이즈 4) 시점 별도 ADR(가칭 ADR-0023). 본 ADR 은 *그 전 단계* 의 최소·즉시 적용 가능한 3-브랜치 분리.

## Validation

- ✅ `pnpm verify:db` 로컬 실행 → endpoint = `ep-dev-XXXX`, allowlist 3개 중 매칭 → 통과
- ✅ `pnpm dev` 며칠 사용 후 production `provider` 행 수 불변 (운영자 Neon Console 육안 — 베타 전엔 항상 2)
- ✅ production 작업(예: `db:push`) 후 셸에 `DATABASE_URL` 환경변수 없음 (`Get-ChildItem Env:DATABASE_URL` → 없음), `.env.local` 에 prod host 문자열 0건 (`Select-String "fancy-fog" .env.local` → 0)
- ✅ Vercel production deploy: `EXPECTED_DB_ENDPOINTS = ep-fancy-fog-alt18340` 단일, build OK + verify(있다면) 통과
- ✅ Vercel preview deploy: `EXPECTED_DB_ENDPOINTS = ep-autumn-water-all6d93e` 단일, build OK

## 회귀 트리거 (Trigger for revisit)

다음 중 하나가 발견되면 ADR-0022 를 재검토한다:

1. **`.env.local` 또는 repo 에 production host/connection string 발견 1건** → 즉시 비번 회전 (ADR-0018 §결정 7) + 본 ADR Amendment (D2 강제 실패 원인 분석).
2. **production `provider` (또는 다른 테이블) 행이 로컬 작업으로 변경된 흔적** → development 브랜치 분리 실패. D4 인라인 명령 강제를 hook 차원으로 격상 검토 (예: `db:push` 호출 시 endpoint 가 production 이면 명시적 확인 요구).
3. **`development` 브랜치가 Neon Free tier 한도(0.5 GB / branch 수) 압박** → ADR-0004 §결정 2 인프라 격상 트리거 + 본 ADR 의 development 데이터 정책 재조정.
4. **PLAN §D.3.e (Neon Vercel Integration) ADR 작성 시점** → 본 ADR 의 preview 브랜치 정책과 통합·정합 재검토.
5. **`dotenv` 버전업으로 인라인 환경변수 우선 동작(`override: false`)이 바뀜** → D4 의 전제가 깨짐. `verify-db.ts` 및 시드 스크립트에 명시적 인라인-우선 로직 추가.
6. **운영자가 production 작업을 *자주* 하게 됨** (월 수 회 이상 인라인 명령) → 그 자체가 신호. 자동화(마이그레이션 CI job 등) 또는 대안 4 (Neon Vercel Integration) 조기 도입 검토.

## PLAN 매핑 — D.4 (신설)

페이즈 0.5 에 **D.4** 추가:

- **D.4** DB 환경 분리 정책 적용 (ADR-0022)
  - **D.4.a** [본 항목] ADR-0022 작성 — *완료* (본 문서)
  - **D.4.b** 운영자: Neon Console 에서 `production` → branch → `development` 생성, endpoint name 을 Pieter 에 공유 (비번/전체 string 공유 X — name 만). ~5분
  - **D.4.c** Pieter: `scripts/verify-db.ts` allowlist 검토 (현재 콤마 구분 지원하므로 코드 변경 불필요 가능성 큼) + `.env.local.example` 신설/갱신 (3 endpoint 주석 + DATABASE_URL=development 기본값)
  - **D.4.d** 운영자: 로컬 `.env.local` 의 `DATABASE_URL` 을 `development` 브랜치로 전환 + `EXPECTED_DB_ENDPOINTS` 3개 등록
  - **D.4.e** 운영자: Vercel production env / preview env 의 `EXPECTED_DB_ENDPOINTS` 를 각 환경 단일 endpoint 로 설정 (GATE-K D.3.c 와 함께 처리 가능)
  - DoD: (1) ADR 작성 ✅ (2) `development` 브랜치 존재 + `pnpm verify:db` 가 로컬에서 development endpoint 로 통과 (3) `.env.local` grep 에 production host 0건 (4) `pnpm dev` 가 development 브랜치만 만짐
  - 검증: 본 ADR §Validation

## References

### 헌법 + 운영자 컨텍스트
- [`CLAUDE.md`](../../CLAUDE.md) — §3 P5 (결정은 ADR로), §8 #1 (사용자 데이터 외부 반출 금지), §8 #6 (Bash 보안 룰)
- [`docs/FOUNDER.md`](../FOUNDER.md) — 솔로 사이드, 운영자 1인이 모든 환경을 손으로 다룸 → 환경 경계가 *명시적 명령* 으로 강제돼야 함

### 관련 ADR
- [ADR-0017](0017-db-mismatch-incident-postmortem.md) — DB 미스매치 사건. 본 ADR 은 그 사건의 *구조적 재발 방지 정책* 단계
- [ADR-0018](0018-neon-multi-org-policy.md) — Neon 멀티 org 정책. §결정 3 (`EXPECTED_DB_ENDPOINTS` allowlist) + §결정 7 (채팅 공유 금지) 을 본 ADR D2/D3 가 환경 경계 차원으로 확장
- [ADR-0015](0015-vercel-integration-and-d1-closure.md) — §T3 (환경변수 production/preview 분리) — 본 ADR 이 거기에 development 를 추가
- [ADR-0020](0020-arbitoria-inventory-and-alignment-corrections.md) — §결정 6 (Neon Vercel Integration = 가칭 ADR-0022) → 본 ADR 이 0022 를 소비, 그 트리거는 ADR-0023+ 로 재지정

### 산출물 / 영향 파일
- [`scripts/verify-db.ts`](../../scripts/verify-db.ts) — `EXPECTED_DB_ENDPOINTS` allowlist (이미 콤마 구분 지원, ADR-0017 §결정 2)
- `.env.local.example` (신설 또는 갱신 — D.4.c)
- [`PLAN.md`](../../PLAN.md) — §0.5 D.4 (신설), §D.3.e + INDEX.md + ADR-0020 의 "가칭 ADR-0022" → "가칭 ADR-0023" 재지정
