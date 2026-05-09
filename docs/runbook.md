# Runbook — Slim 운영 self-rescue 체크리스트

> **목적:** 운영자(Kim Wonmin, 솔로 사이드)가 fetcher / cron / DB가 깨졌을 때
> 외부 도움 없이 진단·복구할 수 있는 단일 체크리스트.
>
> 마지막 갱신: 2026-05-09 (PLAN 1.5.3)
> 호환 페이즈: 1 ~ 5

---

## 0. 응급 진단 — 무엇이 깨졌나?

문제 발견 시 *5분 안에* 어디가 깨졌는지 확인:

```bash
# 1. 환경 self-test
pnpm verify:db                # DB 연결 + 6 tables + provider 행 + endpoint 가드
pnpm typecheck                # 코드 무결성
pnpm test --run               # 단위 테스트

# 2. 서비스 self-test (개발 서버 떠 있을 때)
curl -i http://localhost:3000/data-sources    # 200 + HTML
curl -i http://localhost:3000/api/inngest     # 405 (POST만 허용 — 정상)

# 3. 외부 의존성 self-test
pnpm harness:price            # cron 직접 실행 (dry run 효과)
```

신호별 분기는 §1~§4.

---

## 1. Fetcher가 깨졌을 때 (스텁 / 실 스크래핑 공통)

### 1.1 증상
- `pnpm dev` 후 `/data-sources` 페이지에서 fetcher 메타데이터 표시 안 됨
- Inngest devserver `daily-fetch-all` 실행 시 step 실패
- 단위 테스트 (`src/fetchers/proximus.test.ts` 또는 `telenet.test.ts`) 실패

### 1.2 진단 순서
1. **registry import**: `src/fetchers/index.ts`에서 fetcher가 re-export 되어있는가? `console.log(registry)` 임시 추가해 길이 확인.
2. **metadata.providerSlug**: DB의 `provider.slug`와 일치하는가? (proximus-be / telenet-be)
   - `pnpm verify:db` 가 sample에서 두 slug를 출력해야 함.
3. **fetch() 결과 모양**: `FetchOutcome` discriminated union 준수하는가? (ADR-0008 §T4)
   - `outcome.ok === true ? outcome.result : outcome.error` 분기 필수.
4. **stub fail env var**: `STUB_FAIL_PROXIMUS=1` 또는 `STUB_FAIL_TELENET=1` 가 *실수로* 설정되어 있는가? `unset` 또는 `.env.local`에서 제거.

### 1.3 복구 시나리오

#### A. 스텁 fetcher 자체 깨짐 (페이즈 1 시점)
- 가장 흔한 원인: `src/types/tariff-attributes.ts` 의 Zod 스키마가 갱신됐는데 stub data가 따라가지 않음.
- 복구: 단위 테스트의 expected attribute가 schema와 일치하도록 stub 갱신.

#### B. 실 스크래핑 fetcher 깨짐 (1.5.6 진입 후)
- 셀렉터 변경 가능성 → 페이지 HTML 수동 확인 (`curl https://www.proximus.be/...` 또는 브라우저 DevTools).
- AbortController 25s timeout 만료 가능성 → 일시적 네트워크 이슈일 수 있음. 재시도.
- 봇 차단 (Cloudflare/Akamai) → ADR-0013 §평가 3 발동. 24h 모니터링 게이트.
- 복구 후 `confidence='medium'` 또는 `'low'`로 다운그레이드 — 자동 격상 금지 (ADR-0008 §T3).

#### C. 한 fetcher만 깨짐 (1.9 격리)
- Inngest cron의 `for ... continue` 패턴이 다른 fetcher에 영향 0이어야 함 (ADR-0008 §T7).
- 깨진 fetcher만 격리되고 다른 fetcher는 정상 동작 → confirm via Inngest dashboard.
- 격리 안 됨 = 1.9 회귀 → 즉시 로그 + 실패 fetcher 비활성화 (`registry`에서 제거 or `metadata.method='manual'` 변경).

---

## 2. DB가 깨졌을 때

### 2.1 증상
- `pnpm verify:db` 실패 (host 미스매치 또는 connection refused 또는 0 tables)
- `pnpm db:push` 가 매번 "Changes applied" 출력 (idempotent 깨짐)
- `/data-sources` 페이지가 500 또는 빈 데이터

### 2.2 진단 순서
1. **endpoint 가드**: `pnpm verify:db` 출력에서 `🔒 Endpoint 가드` 섹션 확인.
   - ✅ 일치 → 다른 원인
   - ❌ 미스매치 → `.env.local` 또는 `EXPECTED_DB_ENDPOINT` 갱신 필요
2. **6 tables 존재**: verify-db.ts가 누락 테이블 명시.
   - 누락 → `pnpm db:push` 재실행
3. **provider 행 수**: 1.8 fetcher가 provider lookup하므로 ≥ 2 필수 (proximus-be, telenet-be).
   - 0 → seed SQL 재실행 (ADR-0009 §결정 4 SQL 인용)
4. **Neon 무료 티어 한도**: 0.5 GB 초과 시 read-only 모드.
   - Neon Console → Storage 사용량 확인.
   - 필요 시 90일 리텐션 cron (`pnpm harness:price`) 수동 실행.

### 2.3 복구 시나리오

#### A. 외부 endpoint로 db:push 사고 재발 (silent-darkness 패턴)
- **Gate 5 (PLAN 1.5.5)** 가 차단해야 정상.
- 차단 안 됨 → `EXPECTED_DB_ENDPOINT` 환경변수가 빈 문자열인 경우. `.env.local` 직접 확인.

#### B. 마이그레이션 drift (idempotent 깨짐)
- `comparison_result_item.caveats` text[] default가 매 push마다 미검출 — Drizzle 알려진 이슈, 무시 OK.
- 그 외 drift는 `pnpm db:push --verbose`로 어떤 SQL이 실행되는지 확인.

#### C. Neon free tier 5분 idle sleep
- 첫 요청 후 250ms~1s 콜드 스타트 — 정상 동작.
- 사용자 노출 페이지(`/data-sources`)는 RSC + ISR 1h라 영향 작음.

---

## 3. Inngest cron이 깨졌을 때

### 3.1 증상
- `daily-fetch-all` 함수가 dashboard에 안 보임
- Step 실패 누적
- `tariff_snapshot` 행이 누적 안 됨 (스텁 fetcher라도 매 cron 1행씩 추가 기대)

### 3.2 진단 순서
1. **dev server 떠있나**: `npx inngest-cli@latest dev` → `http://127.0.0.1:8288`
2. **API endpoint 응답**: `curl http://localhost:3000/api/inngest` → 405 Method Not Allowed (정상)
3. **env vars**: `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` (production만 필수)
4. **무료 티어 한도**: 50k step runs/월. 현재는 일 1회 × 4 step = 120/월. 555배 마진 (ADR-0008 §T6).

### 3.3 복구 시나리오

#### A. 함수 dashboard 안 보임
- `src/app/api/inngest/route.ts` 의 `serve({ client, functions })` 에서 functions 배열에 등록됐는지 확인.
- 새 함수 추가 후 `pnpm dev` 재시작 필요할 수 있음.

#### B. Step 1 (network) 실패
- 스텁 fetcher라 외부 호출 0 — 거의 발생 X. 발생 시 `STUB_FAIL_*` env var 체크.
- 실 스크래핑 (1.5.6 진입 후)이면 §1.3.B 시나리오.

#### C. Step 2 (DB) 실패
- §2 (DB 깨짐) 분기로 진입.

---

## 4. 5단 게이트 (stop-gate) 깨졌을 때

### 4.1 증상
- 커밋 시도하는데 hook이 차단
- "Stop 게이트 실패" 메시지

### 4.2 진단 순서
- 어느 게이트가 실패했는지 메시지 확인:
  - Gate 1 typecheck → §1 진단 (코드 에러)
  - Gate 2 lint → ESLint 출력 직접 확인
  - Gate 3 tests → 어떤 테스트인지 확인
  - Gate 4a plan / 4b data → harness 출력 직접 확인
  - **Gate 5 db-endpoint** → §2.3.A (1.5.5 가드)

### 4.3 복구
- 일시적 우회는 `--no-verify` 가능하지만 *권장하지 않음* (CLAUDE.md §게이트 우회 금지).
- 근본 원인을 찾아 수정 후 재커밋.

---

## 5. 백업 + 회복

### 5.1 코드 백업
- GitHub `Arbitoria/slim` repo가 단일 출처. `git push` 누락 없도록.
- 로컬 PC 손실 시 `git clone` 후 `.env.local` 만 새로 만들면 복구.

### 5.2 DB 백업 (Neon)
- Neon Console → Branches → production → "Restore" 메뉴 (PITR, 7일 무료 티어).
- 사고 발생 시점 직전으로 시점 복구.

### 5.3 .env.local 복구
- `.env.example`에 키 목록만 있음 (값 X).
- 실 값:
  - `DATABASE_URL`: Neon Console → Slim/production/connection details
  - `EXPECTED_DB_ENDPOINT`: `ep-fancy-fog-alt18340` (현재 production)
  - `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`: app.inngest.com → Settings → Keys
  - 기타 (`UPSTASH_*`, `SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`): 페이즈 진입 시점에 발급

---

## 6. 외부 도움이 필요한 시점 (자체 복구 불가)

다음 중 *2개 이상* 해당하면 외부 변호사 / 시니어 엔지니어 / Anthropic Claude Pro 자문 권장:

- 30분 이상 막힘 (GATE-D)
- 5단 게이트 중 2개 이상 동시 실패
- DB가 production 데이터 유실 (Neon PITR 7일 외)
- 법적 통지 수신 (TOS 위반 cease & desist 등)
- GDPR 데이터 침해 의심 (개인정보 노출)

---

## 7. 변경 이력

| 날짜 | 변경 | 이유 |
|---|---|---|
| 2026-05-09 | 신설 | PLAN 1.5.3 — 페이즈 1 운영 부채 트랙 |

> 향후 변경은 *왜* 변경했는지 기록 (CLAUDE.md §10 헌법 정합).
