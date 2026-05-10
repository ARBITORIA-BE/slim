# ADR-0020: ARBITORIA 인벤토리 명시 + ADR-0019 진단 사실 정정

## Status

**Accepted (2026-05-10)**

본 ADR 은 ADR-0019 §진단 사실 표의 *Vercel/Neon* 가정을 **운영자 M5 회신 (2026-05-10)** 으로
*정정* 하고, 실제 7 식별자 (3 플랫폼 + 도메인 + 브랜드) 를 영구 명시한다. ADR-0019 본문은
*수정 X* (P5 헌법 정합) — 본 ADR §References 인용으로 진단 사실 정정 + 후속 정렬 트리거 명시.

본 ADR 은 **결정 + 인벤토리 + 후속 작업 명세** 만 담는다. 코드/설정 변경 0. 외부 의존성 0.

## Context

### 본 ADR 이 풀어야 하는 모호함

ADR-0019 §진단 사실 표 (2026-05-10 작성 시점) 는 *Vercel ARBITORIA team* + *Neon ARBITORIA org*
가 모두 정렬되어 있다고 가정. 운영자 마이그레이션 M5 회신 (Neon GitHub Integration 점검) 에서
다음 7개 새 사실 발견:

1. **Vercel team scope** = ARBITORIA team (가정) → 실제 `kimwonmin91-4132s-projects` (personal
   scope, Hobby 플랜).
2. **Vercel App** = ARBITORIA-BE org 직접 설치 (가정) → 실제 personal `Arbitoria` 설치 + redirect
   로 follow.
3. **Vercel env vars** EXPECTED_DB_ENDPOINTS / INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY = 미등록
   (페이즈 진입 시점에 등록 필요).
4. **Neon GitHub Integration** = NEON_API_KEY + NEON_PROJECT_ID GitHub Secrets 자동 주입 활성
   (PR 마다 DB branch 자동 생성 가능).
5. **Vercel Marketplace Neon Storage** = `slim-prod` (1d ago created — ADR-0017 §postmortem 의
   "1개월 보관" 자산과 *동일 자산 또는 새로 생성된 자산* 인지 명확화 필요).
6. **Neon-side Vercel Integration** = NOT added (별개 통합, 추후 도입 옵션).
7. **slim.lu 도메인** = DNS 전파 완료 (216.198.79.1) — Vercel Domains 검증 + SSL 별도 확인 필요.

또한 운영자 명시: **ARBITORIA-BE** (GitHub org, M1 이름 충돌 회피 변형) vs **ARBITORIA** (Neon
org, 깨끗한 이름 — `-BE` 없음) 의 *식별자 fragmentation* 발견. 즉 "ARBITORIA" 통합 브랜드 아래
**7 식별자** 가 플랫폼별로 분기되어 있다.

### 운영자 명시 결정 (2026-05-10 M5 회신)

> "별도 정정 ADR 필요" — ADR-0019 본문 수정 금지 (P5 헌법) + 정정 사실은 신규 ADR 로 명시.

본 ADR 은 위 7 식별자 인벤토리 + 7 결정으로 응답한다.

### 운영자 컨텍스트 ([`docs/FOUNDER.md`](../FOUNDER.md))

- 솔로 사이드, 주 10-20 시간, 월 €300 ALL-IN cap
- 사업자등록 ✅ / TVA 대기 ⏳
- ARBITORIA = 통합 브랜드 (사업체 명의), 플랫폼별 식별자 fragmentation 은 *기술적 우회*
- M5 시점 페이즈 1.5 진행 중, 페이즈 4 베타 진입 시점 (M8~M10) 이전에 *완전 정렬 필수*

## Decision — 7 개 결정

### 결정 1 — 인벤토리 표 명시 (운영자 M5 회신, 단일 출처)

운영자 회신 표를 *그대로* 본 ADR §Decision 1 로 박아둔다. 향후 모든 ADR / PLAN / runbook 의
식별자 추적 단일 출처.

| 플랫폼 | 식별자 | 비고 |
|---|---|---|
| GitHub org | `ARBITORIA-BE` | 변형 (M1 이름 충돌 회피) |
| Neon org | `ARBITORIA` | 깨끗한 이름 (`-BE` 없음) |
| Neon project | `Slim` | |
| Neon DB alias | `slim-prod` | Vercel Marketplace 자동 생성 자산 (1d ago) |
| Vercel team | `kimwonmin91-4132s-projects` | personal scope, Hobby 플랜 |
| Vercel project | `slim` | |
| 공식 도메인 | `slim.lu` | DNS 전파 완료 (216.198.79.1) |
| 공식 브랜드 | `ARBITORIA` | 사업체 명의 통합 단위 |

**근거**: 7 식별자 fragmentation 은 *기술적 제약* (case-insensitive 충돌 + Vercel Hobby 의 team
부재 + Marketplace 자동 자산) 결과. 통합 브랜드 ARBITORIA 는 운영자 *의도된 사업체 명칭* 으로
유지하되, 플랫폼별 식별자는 *현 상태* 그대로 명시 → 사고 시 검토 명확성.

**검증**: 본 §Decision 1 표가 향후 모든 신규 ADR/PLAN 의 식별자 출처. 변경 시 본 ADR
Amendment.

### 결정 2 — ADR-0019 §진단 사실 표 정정 인용 (본문 수정 X)

ADR-0019 본문 *수정 X* (P5 헌법 — Accepted ADR 본문 수정 금지). 정정 사실은 본 ADR 인용 +
ADR-0019 §References 에 본 ADR 추가 (M8 동형 작업). 정정 사실 인라인:

- "Vercel ARBITORIA team" → "kimwonmin91-4132s-projects (personal Hobby)"
- 운영자 직접 결정: **Vercel team 신설 vs personal 유지** 결정은 본 ADR 에서 미디 — 베타 직전
  (GATE-K) 에 페이즈 4 진입 ADR 로 이연.

**근거**: ADR-0019 §결정 1~5 모두 *현 상태* (personal Vercel scope) 에서도 유효 — Vercel team
신설 여부는 사업체 명의 자산 단위 정렬 (TVA 발급 후) 의 종속 결정. 즉시 신설 강제는 운영자
시간 부담 + Hobby → Pro 격상 비용 ($20/user/월) 트리거.

**검증**: ADR-0019 §References 에 본 ADR 인용 추가 (M8 보강 작업). 베타 직전 GATE-K 시점에
별도 ADR (가칭 ADR-0021) 로 Vercel team 신설 결정.

### 결정 3 — Vercel App ARBITORIA-BE org 직접 설치 (follow-up)

현재 Vercel App 은 personal `Arbitoria` 에 설치 + redirect 로 ARBITORIA-BE org repo 를 follow.
이는 **GitHub repo transfer 자동 redirect** 의 정상 동작 (ADR-0019 §외부 사실 — Vercel Community
인용 정합) — 단 직접 설치보다 *권한 경로 1단 우회* 로 미래 사고 시 디버깅 부담.

**결정**: 베타 직전 (GATE-K) 에 ARBITORIA-BE org 에 *직접 GitHub App 설치* 권장. 단발 작업
(~5분), PLAN 4.0 prologue 또는 별도 부채로 등록.

**근거**:
- 현 redirect 동작 정상 — 즉시 작업 강제 X.
- 베타 시점 (사용자 데이터 발생) 에 권한 경로 단순화 = 사고 시 검토 명확성.

**검증**: GATE-K 직전 운영자 5분 작업 + Pieter 임시 PR 검증 (ADR-0019 §검증 3 동형).

### 결정 4 — Vercel env vars 3개 등록 시점 명시

운영자 M5 회신 미등록 환경변수 3개:

| 변수 | 등록 시점 | 사유 |
|---|---|---|
| `EXPECTED_DB_ENDPOINTS` | **PLAN 1.5.5 본문 부채로 추가** | 현재 Vercel runtime 미설정 → 가드 skip 안전 (`scripts/verify-db.ts` 의 `.env.local` 부재 시 skip 패턴), 베타 직전 등록 부채 |
| `INNGEST_EVENT_KEY` | 페이즈 1.6 cron 실 가동 시 (베타 직전 = GATE-K) | cron 무료 티어 보호 (ADR-0008 §T9) |
| `INNGEST_SIGNING_KEY` | 페이즈 1.6 cron 실 가동 시 (GATE-K) | webhook 검증 |

**근거**:
- `EXPECTED_DB_ENDPOINTS`: 현 stop-gate Gate 5 는 `.env.local` 부재 시 skip → Vercel runtime
  영향 0. 단 베타 직전에 production runtime 가드 활성화 필수 (ADR-0017 사고 패턴 재발 방지).
- `INNGEST_EVENT_KEY/SIGNING_KEY`: cron 실 가동은 페이즈 1.6 진입 시점 (현재 미가동, ADR-0008
  §T6 일 1회 cron). 베타 직전 (GATE-K) 까지 미등록 영향 0.

**검증**: PLAN 1.5.5 본문에 부채 명시 (verifier 책임). 베타 직전 운영자 Vercel Settings →
Environment Variables 에 3 항목 등록 + Pieter 임시 PR 검증.

### 결정 5 — slim-prod 자산 정체 확정

ADR-0017 §postmortem 이 언급한 `slim-prod` Neon 프로젝트 = **Vercel Marketplace Neon Storage
자동 생성 자산** (1d ago created — M4 reconnect 또는 GitHub transfer 직후 Vercel side-effect).

**처리**: ADR-0017 §결정 1 lifecycle (1개월 보관, 2026-06-10 검토 후 삭제) **그대로 유지**. 본
ADR §Appendix B 에 자산 정체 명시화 + ADR-0017 §References 에 본 ADR cross-ref 추가 (M8 보강).

**근거**:
- 자산 정체 명확화 = ADR-0018 §결정 2 (자동 자산 발견 시 즉시 점검) 정합. 즉시 disconnect 는
  ADR-0017 §결정 1 에서 *이미 완료* (Vercel Storage Disconnect, 2026-05-10).
- 1개월 보관은 운영자 학습 가치 (ADR-0017 §대안 2 거부 사유) — 즉시 삭제 거부.
- 회귀 트리거: 본 자산이 Vercel runtime DATABASE_URL 을 *대신 주입* 하는 케이스 발견 시 →
  ADR-0017 회귀 + 즉시 disconnect.

**검증**: 2026-06-10 운영자 검토 시점에 본 §Appendix B 인벤토리 표 cross-ref 확인.

### 결정 6 — Neon-side Vercel Integration 도입 검토 시점

운영자 M5 회신: Neon-side Vercel Integration NOT added (Vercel-side Marketplace integration 만
활성). 도입 시 *Vercel preview deploy 마다 Neon DB branch 자동 생성* — 페이즈 4 베타 진입 시
실 사용자 데이터 격리 필요할 수 있음.

**결정**: 현재 NOT added 그대로 유지. 페이즈 4 베타 진입 시 별도 ADR (가칭 ADR-0022) 트리거.

**근거**:
- 현재 페이즈 1.5 (스텁 fetcher + 베타 미시작) 시점에 preview branch 격리 필요성 0.
- Neon Free tier branch 한도 10/프로젝트 (ADR-0018 §외부 사실) — 자동 생성 PR 마다 branch 시
  한도 도달 위험 高 (10 PR 만 처리 가능).
- 페이즈 4 진입 시 운영자 + Pieter 별도 평가: 자동 branch vs 수동 staging branch 단일.

**검증**: 페이즈 4 베타 진입 시점에 본 결정 재평가 ADR.

### 결정 7 — slim.lu 도메인 Vercel Domains 검증 (별도 단계)

운영자 M5 회신: slim.lu DNS 전파 완료 (216.198.79.1) — 단 Vercel Domains 검증 + SSL 발급은 별도
단계 필요. 본 ADR §Appendix C 에 단계별 명세.

**도입 시점**:
- (a) 페이즈 2 입력 플로우에서 brand-aware copy 도입 시점, 또는
- (b) 페이즈 4 베타 직전 (GATE-K) — 베타 사용자 노출 시점 도메인 정합성 필수.

**근거**:
- 현재 slim-gamma.vercel.app URL 로 충분 (페이즈 1.5 시점, 베타 미시작).
- slim.lu 는 운영자 *공식 브랜드 도메인* — 베타 시작 시점에 사용자 신뢰 + brand-aware copy
  (페이즈 2.x i18n 도입 시) 정합 필수.
- DNS 전파 완료 → Vercel UI 작업 ~10분 + SSL 자동 발급 ~1h.

**검증**: 페이즈 2 또는 페이즈 4 진입 시점에 §Appendix C 6 단계 운영자 실행 + `https://slim.lu`
접속 → Vercel 페이지 + 유효 SSL 확인.

## Rejected alternatives

### 대안 1 — ADR-0019 §진단 사실 표 본문 *수정* (거부)

- 장점: 단일 ADR 에서 정정 사실 즉시 반영
- 단점: **P5 헌법 위반** — Accepted ADR 본문 수정 금지. 결정의 헌법적 보존 원칙 (CLAUDE.md §3
  P5) 정면 위반.
- **거부 사유**: P5 헌법 + ADR-0019 §T5 정합 (본문 수정 X, References 인용 추가만).

### 대안 2 — 모든 정렬 작업 즉시 수행 (거부)

본 ADR §결정 2/3/4/6/7 모두 *현재 시점* 에 운영자가 즉시 처리.

- 장점: 즉시 완전 정렬
- 단점:
  - 운영자 시간 부담 ~2시간 1회 (Vercel team 신설 + GitHub App 재설치 + env vars 3개 등록 +
    Neon Vercel Integration 추가 + slim.lu 검증 + SSL 대기)
  - 페이즈 1.5 진행 차단 위험 (스텁 fetcher 검증 + harness:price 등 우선순위 흡수)
  - Vercel Pro 격상 비용 ($20/user/월) 즉시 발동 — ADR-0004 §결정 2 €300 cap 마진 잠식
  - Hobby Free → Pro 격상은 사용자 신호 (베타 검증) 없이 진행 = 정보 부족 의사결정
- **거부 사유**: 솔로 사이드 시간 + 비용 cap > 즉시 정렬 가치. 베타 진입 시점에 정합성 확보로
  충분.

### 대안 3 — slim-prod 자산 즉시 삭제 (거부)

- 장점: 자산 정리 즉결
- 단점: ADR-0017 §결정 1 lifecycle (1개월 보관, 2026-06-10 검토) 위반. 운영자 학습 가치 (ADR-0017
  §대안 2 거부 사유) 손실.
- **거부 사유**: ADR-0017 헌장 정합 > 즉시 정리 가치.

## Validation

본 ADR §검증은 결정별 트리거 시점에 verifier 책임:

- ✅ **결정 1 인벤토리 표** = 본 ADR Accepted 즉시 단일 출처 — 향후 신규 ADR/PLAN 식별자 출처
- ⏳ **결정 2** = 베타 직전 (GATE-K) 에 별도 ADR 로 Vercel team 신설 결정
- ⏳ **결정 3** = GATE-K 직전 운영자 5분 작업 + Pieter 검증
- ⏳ **결정 4** = PLAN 1.5.5 본문 부채 추가 (verifier 책임) + 베타 직전 운영자 등록
- ✅ **결정 5** = ADR-0017 §References 본 ADR cross-ref 추가 (M8 보강 작업) + 2026-06-10 운영자
  검토 시점 §Appendix B 확인
- ⏳ **결정 6** = 페이즈 4 베타 진입 시점 별도 ADR 트리거
- ⏳ **결정 7** = 페이즈 2 또는 GATE-K 시점 §Appendix C 6 단계 실행

## 회귀 트리거 (Trigger for revisit)

다음 중 하나가 발견되면 ADR-0020 을 재검토한다:

1. **인벤토리 표 (§결정 1) 의 7 식별자 중 변경 1건 이상** — 본 ADR Amendment + 변경 일자 + 사유
   기록.
2. **Vercel runtime EXPECTED_DB_ENDPOINTS 미설정 상태에서 production deploy 발생** — Gate 5
   skip 의도와 다른 동작 → §결정 4 즉시 등록 발동.
3. **Neon GitHub Integration 의 PR 자동 branch 생성이 Free tier 한도 (10 branches) 도달** —
   §결정 6 즉시 도입 검토.
4. **slim.lu 도메인 DNS 전파 실패 또는 SSL 발급 실패** (§Appendix C 검증 ❌) — Cloudflare /
   다른 DNS 호스팅 분기 검토.
5. **slim-prod 자산이 Vercel runtime DATABASE_URL 을 대신 주입하는 케이스 발견** — ADR-0017
   회귀 + 즉시 disconnect.
6. **운영자 협업자 추가 또는 사용자 신호 (CVR/매출) M12~M16 도달** — Vercel Pro 격상 시점에
   §결정 2 ARBITORIA team 신설 재평가 (ADR Amendment 또는 별도 ADR).
7. **Vercel App ARBITORIA-BE org 직접 설치 후 build 실패 1건 이상** (§결정 3 GATE-K 시점) —
   ADR-0015 §Step-3-prime 동형 보강 절차 신설.
8. **Vercel team 이 personal scope 에서 Pro 격상 시점** (M12~M16 실 매출 도달 시) → 본 ADR
   §결정 2 의 ARBITORIA team 신설 재평가 (ADR Amendment).

## 다른 ADR 과의 관계

- **ADR-0017** (DB 미스매치 사건 종결): 본 ADR §결정 5 가 ADR-0017 §결정 1 lifecycle 을
  *유지* + §Appendix B 자산 정체 명시화. ADR-0017 §References 에 본 ADR cross-ref 추가 (M8
  보강).
- **ADR-0018** (Neon 멀티 org 정책): 본 ADR §결정 1 인벤토리 표 가 ADR-0018 §결정 1 "ARBITORIA
  org" 헌장의 *기술적 fragmentation* 명시. ADR-0018 §결정 1 에 *(통합 브랜드, 플랫폼별 식별자
  fragmentation 은 ADR-0020 §Decision 1)* 인라인 cross-ref 추가 (M8).
- **ADR-0019** (3 플랫폼 정렬): 본 ADR §결정 2 가 ADR-0019 §진단 사실 표의 정정. ADR-0019
  §References 에 본 ADR cross-ref 추가 (M8). ADR-0019 §회귀 트리거 #5 (Vercel Pro 격상)
  + #6 (TVA 발급) 와 본 ADR §결정 2 + §회귀 트리거 #8 정합.
- **ADR-0015** (Vercel 통합): 본 ADR §결정 3/4 가 ADR-0015 §T3 (env 분리) + §Step-3-prime
  (env 점검) 의 *연장*. 베타 직전 GATE-K 에서 운영자 작업 단계로 흡수.
- **ADR-0004** (€300 cap): 본 ADR §결정 2 (Vercel team 신설 이연) + §결정 6 (Neon-side
  Integration 이연) 이 ADR-0004 §결정 2 cap 마진 보존.
- **ADR-0008** (Fetcher + cron): 본 ADR §결정 4 의 INNGEST_EVENT_KEY/SIGNING_KEY 등록 시점이
  ADR-0008 §T6 cron 실 가동 시점과 정합 (페이즈 1.6).

## 영향

### PLAN.md 갱신 (verifier 책임)

본 ADR Accepted 후 verifier 책임:

- **§1.5.5** 본문에 부채 명시 1줄 추가:
  ```markdown
  > **부채 (ADR-0020 §결정 4)**: Vercel runtime `EXPECTED_DB_ENDPOINTS` 미등록 — 현재 stop-gate
  > Gate 5 가 `.env.local` 부재 시 skip 패턴으로 Vercel 영향 0. 베타 직전 (GATE-K) 운영자가
  > Vercel Settings → Environment Variables 에 `ep-fancy-fog-alt18340,ep-autumn-water-all6d93e`
  > (production + preview) 등록 부채.
  ```
- **페이즈 4 prologue (가칭 §4.0)** 또는 **§D.3** 신설 후보 (운영자 결정):
  - Vercel team ARBITORIA 신설 결정 (별도 ADR-0021 트리거)
  - Vercel App ARBITORIA-BE org 직접 설치 (§결정 3)
  - Vercel env vars 3개 등록 (§결정 4 — production + preview)
  - slim.lu 도메인 Vercel Domains 검증 (§결정 7 + §Appendix C)
  - Neon-side Vercel Integration 도입 검토 (§결정 6 — 별도 ADR-0022 트리거)

PLAN 갱신은 verifier (Pieter) 책임 — 본 ADR 은 *결정* 만 명시.

### `docs/adr/INDEX.md` 갱신

verifier 책임 — 본 ADR 행 추가:

```markdown
| [ADR-0020](0020-arbitoria-inventory-and-alignment-corrections.md) | ARBITORIA 인벤토리 명시 + ADR-0019 진단 사실 정정 | Accepted | 2026-05-10 |
```

+ §설명 섹션 ADR-0020 항목 신설.

### ADR-0017/0018/0019 cross-ref 추가 (M8 동형 보강)

- **ADR-0017 §References**: 본 ADR cross-ref 추가 (slim-prod 자산 정체 명시화 — §결정 5 +
  §Appendix B).
- **ADR-0018 §결정 1**: 인라인 cross-ref *(통합 브랜드, 플랫폼별 식별자 fragmentation 은 ADR-0020
  §Decision 1)* 추가.
- **ADR-0019 §References**: 본 ADR cross-ref 추가 (§진단 사실 표 정정 — §결정 2).

본문 *수정 X* — References 섹션 또는 인라인 cross-ref 만 추가 (P5 정합).

### 외부 의존성 추가 — 0건

- 새 npm 패키지 0
- 새 SaaS 0 (모두 기존 자산 활용)
- 외부 의존성 0건

### MONETIZATION.md 영향 — 변동 0

- 비용 cap €300/월 영향 0 (§결정 2 Vercel team 신설 이연으로 Pro 격상 비용 미발생)
- TVA 발급 후 사업 계좌 자산 정합성 보강 — 본 ADR §회귀 트리거 #8 (재검토)

## References

### 헌법 + 운영자 컨텍스트

- [`CLAUDE.md`](../../CLAUDE.md) — §3 P3 (투명성 운영자의 짐), §3 P5 (결정은 ADR로), §8 #6
  (Bash 보안 룰)
- [`docs/FOUNDER.md`](../FOUNDER.md) — 운영자 솔로 사이드 + 사업자등록 + TVA 대기
- [`MONETIZATION.md`](../../MONETIZATION.md) — §A 어필리에이트 + slim.lu 도메인, §1 비용 cap
  €300/월

### 관련 ADR

- [ADR-0004](0004-monetization-solo-side-rebalance.md) — §결정 2 €300 cap (§결정 2/6 비용 영향
  0 정합)
- [ADR-0008](0008-fetcher-interface-and-cron.md) — §T6/T9 cron + Inngest 키 (§결정 4 정합)
- [ADR-0015](0015-vercel-integration-and-d1-closure.md) — §T3 env 분리 + §Step-3-prime (§결정
  3/4 동형 패턴)
- [ADR-0017](0017-db-mismatch-incident-postmortem.md) — DB 미스매치 사건 종결 (§결정 5 + §Appendix
  B 자산 정체)
- [ADR-0018](0018-neon-multi-org-policy.md) — Neon 멀티 org 정책 (§결정 1 인벤토리 가 헌장
  fragmentation 명시)
- [ADR-0019](0019-arbitoria-three-platform-alignment.md) — 3 플랫폼 정렬 (§진단 사실 표 정정
  대상 — §결정 2)

### 운영자 회신 출처

- 운영자 M5 회신 (2026-05-10) — Pieter 세션 로그, ARBITORIA-BE org Slim repo 이전 후 7 식별자
  명시

### 외부 사실 (검증된 출처 — 2026-05-10)

- [Vercel Marketplace — Neon Storage](https://vercel.com/marketplace/neon) — Vercel-side
  자동 자산 생성 메커니즘 (§결정 5)
- [Neon Docs — GitHub Integration](https://neon.com/docs/guides/neon-github-integration) —
  PR 마다 DB branch 자동 생성 + NEON_API_KEY/PROJECT_ID Secrets 주입 (§결정 6)
- [Vercel Docs — Add a Domain](https://vercel.com/docs/projects/domains/add-a-domain) — slim.lu
  검증 + SSL 절차 (§Appendix C)
- [Let's Encrypt — Vercel SSL](https://vercel.com/docs/projects/domains/working-with-ssl) —
  자동 발급 (§Appendix C)

---

## Appendix A — 7 식별자 인벤토리 (§Decision 1 의 단일 출처)

운영자 M5 회신 표 (2026-05-10) — 본 ADR Accepted 시점 단일 출처. 변경 시 본 ADR Amendment.

| 플랫폼 | 식별자 | 비고 |
|---|---|---|
| GitHub org | `ARBITORIA-BE` | 변형 (M1 이름 충돌 회피) |
| Neon org | `ARBITORIA` | 깨끗한 이름 (`-BE` 없음) |
| Neon project | `Slim` | |
| Neon DB alias | `slim-prod` | Vercel Marketplace 자동 생성 자산 (1d ago) |
| Vercel team | `kimwonmin91-4132s-projects` | personal scope, Hobby 플랜 |
| Vercel project | `slim` | |
| 공식 도메인 | `slim.lu` | DNS 전파 완료 (216.198.79.1) |
| 공식 브랜드 | `ARBITORIA` | 사업체 명의 통합 단위 |

---

## Appendix B — slim-prod 자산 정체 (ADR-0017 cross-ref 보강)

ADR-0017 §결정 1 의 `slim-prod` Neon 프로젝트 정체:

- **위치**: Vercel Marketplace Neon Storage 자동 생성 (Vercel-side integration)
- **생성 시점**: M4 reconnect 또는 GitHub transfer 직후 (1d ago, 2026-05-09 또는 2026-05-10
  추정)
- **현 상태**: Vercel Storage Disconnect 완료 (ADR-0017 §결정 1, 2026-05-10) — 자동 변수 14개
  정리 완료
- **처리**: ADR-0017 §결정 1 lifecycle 그대로 — **1개월 보관 (~2026-06-10) 후 운영자 검토 +
  삭제**
- **회귀 트리거**: 본 자산이 Vercel runtime DATABASE_URL 을 *대신 주입* 하는 케이스 발견 시 →
  ADR-0017 회귀 + 즉시 disconnect (본 ADR §회귀 트리거 #5)

본 자산 정체 명시화는 ADR-0018 §결정 2 (자동 자산 발견 시 즉시 점검) 정합 — 즉시 disconnect 는
ADR-0017 §결정 1 에서 *이미 완료*, 본 Appendix B 는 *학습 자료 정합*.

---

## Appendix C — slim.lu 도메인 Vercel Domains 검증 (Pending)

운영자가 페이즈 2 또는 페이즈 4 진입 (GATE-K) 시 진행:

### 단계 (~15분 + SSL 발급 대기 ~1h)

1. **Vercel UI 접속**: https://vercel.com/kimwonmin91-4132s-projects/slim/settings/domains
2. **Add Domain** 버튼 → `slim.lu` 입력 → Add 클릭
3. **검증 토큰 발급**: Vercel 이 TXT 또는 CNAME 검증 토큰 제공 (도메인 소유권 검증)
4. **DNS 등록**: 운영자 DNS 호스팅 콘솔에서 검증 토큰 등록 (TXT `_vercel` 또는 CNAME)
5. **DNS 전파 대기**: 10분~1h (현재 216.198.79.1 IP 전파 완료 → 검증 토큰만 추가)
6. **Vercel Domains 자동 검증**: Vercel 이 DNS 조회 → 검증 ✅ 표시
7. **SSL 자동 발급**: Let's Encrypt 자동 발급 (Vercel 자동 처리) — ~5분~1h
8. **검증**: `https://slim.lu` 브라우저 접속 → Vercel 페이지 + 유효 SSL (자물쇠 아이콘) +
   인증서 발급자 = Let's Encrypt 확인

### 검증

- ✅ Vercel Domains 검증 ✅ 표시
- ✅ `https://slim.lu` 200 응답 + 유효 SSL
- ✅ `http://slim.lu` → `https://slim.lu` 자동 redirect (Vercel 기본 동작)

### 롤백

- Vercel Settings → Domains → `slim.lu` Remove → 즉시 도메인 분리
- DNS 검증 토큰은 운영자 DNS 호스팅 콘솔에서 별도 삭제 (선택)
- 영향: slim-gamma.vercel.app 그대로 동작 (Vercel project URL)

### 회귀 트리거

- DNS 전파 실패 또는 SSL 발급 실패 → 본 ADR §회귀 트리거 #4 발동
- 도메인 만료 또는 갱신 누락 → 운영자 분기 결정 (Vercel Domains 자동 갱신 vs 외부 호스팅)
