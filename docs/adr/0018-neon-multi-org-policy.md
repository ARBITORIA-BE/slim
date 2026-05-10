# ADR-0018: Neon 멀티 organization 정책 + 자동 자산 점검 룰

## Status

**Accepted (2026-05-10)** — ADR-0017 사건 종결과 동시 채택. 운영자 1주/1개월
모니터링 일정에서 추가 신호 발견 시 Amendment.

본 ADR은 **정책 결정 + 운영 룰** 만 담는다. 코드/설정 변경 0 (verify-db.ts
allowlist는 ADR-0017 §결정 2에서 이미 적용됨).

## Context

### 본 ADR이 풀어야 하는 모호함

ADR-0017 사건이 드러낸 구조적 위험:

1. **Vercel Storage / Neon Vercel Integration이 자동으로 새 Neon 프로젝트를
   생성**할 수 있음 (예: `slim-prod` hidden-recipe — 운영자 의식적으로 만든
   자산이 아님). 이 자동화는 편의성을 주지만 *운영자 인식 밖의 자산*을 만들어
   미래 사고의 씨앗이 된다.
2. **운영자는 personal org + ARBITORIA org 두 곳에 Neon 자산을 보유** —
   한쪽에서 무심코 만든 프로젝트가 *다른 쪽 환경변수* 와 섞이면 ADR-0017
   같은 사고 재발.
3. **EXPECTED_DB_ENDPOINTS allowlist** (verify-db.ts) 는 *현재* 알려진
   endpoint만 통과시킴 → 자동 생성된 미인식 endpoint는 자동으로 차단되지만,
   *왜 차단됐는지* 와 *어떻게 처리할지* 룰이 없으면 운영자가 매번 임시
   대응함.

본 ADR은 위 3개를 *영구 정책* 으로 못박아 ADR-0017 같은 사건 재발을
구조적으로 차단한다.

### 운영자 컨텍스트 ([`docs/FOUNDER.md`](../FOUNDER.md))

- 솔로 사이드, 주 10-20시간 → 자동화 의존 高 / 검토 시간 低
- ARBITORIA org (Slim repo 호스팅) + personal org (개인 토이 프로젝트)
- 월 €300 cap → Neon Free tier 의존, paid tier 격상은 ADR-0004 §결정 2
  트리거 발동 시

### 외부 사실

- **Neon Free tier branch 한도** ([Neon Pricing](https://neon.com/pricing)) —
  10 branches/프로젝트 (2026-05 시점). 본 ADR §결정 6 (신규 환경 추가 절차)
  의 한도 입력.
- **Vercel-managed Neon integration** ([Neon docs](https://neon.com/docs/guides/vercel-managed-integration))
  — webhook 주입으로 환경변수 자동 등록, Vercel UI에 *보이지 않음*. 본 ADR
  §결정 2 (자동 자산 발견 시 즉시 점검) 의 핵심 위험.
- **ARBITORIA org / personal org 멀티 멤버십** — 한 GitHub 계정이 여러 org에
  속할 때 Vercel UI는 *기본값으로* 한 org만 표시 → 다른 org 자산이 *눈에
  띄지 않음*.

## Decision — 7개 결정

### 결정 1 — Slim org 명시 정책

Slim 프로젝트의 모든 Neon 자산은 **ARBITORIA org / Slim 프로젝트** 안에만
둔다. personal org (`kimwonmin91-4132's projects`)에는 Slim 자산 0.

**근거**:
- 단일 owner = 단일 책임 추적
- ARBITORIA org는 Slim repo + 사업자등록 일관 — TVA 발급 시 자산 양도 부담 0
- personal org는 운영자 개인 학습/토이 자산 전용 — 사업 자산과 섞이면 세무
  분리 어려움 (FOUNDER.md §2 TVA 대기)

**검증**: 매월 1일 운영자 self-check (§결정 4).

### 결정 2 — 자동 자산 발견 시 즉시 점검

Vercel Storage 또는 Neon Vercel Integration이 *자동* 생성한 프로젝트 (예:
`slim-prod` hidden-recipe) 발견 시 → 즉시 다음 절차:

1. **disconnect** (Vercel Storage UI에서 Disconnect 클릭) — 자동 변수 재생성
   차단
2. **ADR Amendment** — 본 ADR에 발견 일자 + 자산 명 + 처리 결과 기록
3. **라이프사이클 적용** (§결정 5)

**근거**: ADR-0017 §결정 1 의 즉결 처리. 자동 자산은 *왜 만들어졌는지* 추적
어려움 → 보존 비용 ↑ → 즉시 단절 + ADR로 결정 기록.

**검증**: 발견 사례 0건 = 정책 준수. 1건 이상 발견 시 본 ADR Amendment 진입.

### 결정 3 — EXPECTED_DB_ENDPOINTS allowlist 정책

모든 Slim 환경 (production / preview / dev / future) 의 endpoint를
`EXPECTED_DB_ENDPOINTS` env var에 명시. allowlist 외 endpoint는 *기본적으로
위험* 으로 분류:

- `pnpm verify:db` 가 exit 1 (사용자에게 미스매치 안내)
- 운영자가 의도적 endpoint 추가 시 *반드시* allowlist 갱신 + ADR Amendment
- `.env.local` / `.env.example` 두 곳 모두 갱신 (CI 안전)

**근거**: ADR-0017 사건의 핵심 방어선. allowlist는 *명시적 의도* 만 허용 →
실수로 잘못 endpoint에 접근하는 시점에 즉시 차단.

**현 allowlist (2026-05-10)**:
```
EXPECTED_DB_ENDPOINTS="ep-fancy-fog-alt18340,ep-autumn-water-all6d93e"
                      ^production              ^preview
```

**검증**: `scripts/verify-db.ts` 의 endpoint 가드가 항상 allowlist 형식 대비
실제 host endpoint를 비교. ADR-0017 §검증 통과.

### 결정 4 — 점검 주기 = 매월 1일

매월 1일 운영자가 Neon Console 두 org (ARBITORIA + personal) 모두 점검 (5분):

- ARBITORIA org → Slim 프로젝트 (production + preview branch만 존재해야 함)
- personal org → Slim 자산 0 확인
- 발견된 예상 외 자산 → §결정 2 발동

**자동화 후보** (PLAN 1.5.x 부채로 등록 후보):
- Inngest cron: 매월 1일 06:00 UTC `neon-multi-org-audit` 함수
- Neon API 호출 → 두 org의 프로젝트 목록 → ARBITORIA = `slim` 단일 프로젝트
  + personal = 0 검증 → 미달 시 Sentry 알림

**근거**: 솔로 운영자가 *기억에 의존하지 않게* 한다. 5분 self-check는 솔로
시간 (FOUNDER.md §2 주 10-20시간) 안 부담 0. 자동화는 페이즈 6.x 운영
인프라에서 정식 도입.

**검증**: 분기별 운영자 self-check 보고. 누락 시 ADR Amendment.

### 결정 5 — 자산 라이프사이클

hidden-recipe 또는 자동 생성 자산 발견 시:

| 단계 | 기간 | 행동 |
|---|---|---|
| **Disconnect** | 즉시 (발견 당일) | Vercel Storage Disconnect + 자동 변수 정리 |
| **모니터링** | 1주일 | 다른 자산에 의존성 있는지 확인 (Sentry / Vercel build 영향 0 검증) |
| **보관** | 1개월 | Neon 프로젝트는 inactive 상태로 보관 — 운영자 학습 자료 |
| **삭제 결정** | 1개월 후 | 운영자 명시 결정 → Neon Console에서 프로젝트 삭제 |

**근거**: ADR-0017 사건의 cleanup 일정과 동일 패턴. 즉시 삭제는 학습 가치
손실 + 잔여 의존성 발견 시 복구 어려움. 1개월 보관 비용 0 (Neon Free
inactive).

**검증**: ADR-0017 §검증 ⏳ 항목 (2026-06-10 시점) 이 본 라이프사이클의 첫
사례.

### 결정 6 — 신규 환경 추가 절차

production 외 새 환경 (예: staging / qa) 추가 시 다음 4단계:

1. **Neon에 명시 brand 만들기** — Neon Console → Branches → "Create branch"
   → 명시적 이름 (예: `staging`)
2. **EXPECTED_DB_ENDPOINTS 갱신** — `.env.local` + `.env.example` 두 곳 모두
   콤마 구분 추가
3. **Vercel env 동기화** — Vercel Settings → Environment Variables → 새 환경
   분기 추가 (DATABASE_URL + EXPECTED_DB_ENDPOINTS)
4. **ADR Amendment** — 본 ADR에 새 환경 명 + endpoint + 추가 일자 기록

**근거**: ADR-0015 §T3 (production / preview 분리) 패턴을 staging 등으로
일관 확장. 4단계 누락 시 ADR-0017 사건 재발 가능 → 절차 명시로 누락 방지.

**검증**: 새 환경 추가 후 첫 push에서 `pnpm verify:db` 통과 확인. 미통과 시
ADR Amendment.

### 결정 7 — 외부 endpoint 채팅 공유 금지

운영자가 connection string을 채팅 공유 시 비번 노출 위험 (ADR-0017 사건에서
2회 발생, 모두 운영자 회전 완료). 향후 룰:

- **endpoint name만 공유** — 예: "production endpoint = `ep-fancy-fog-alt18340`"
- 비번/host 전체 공유 X
- 검증은 `pnpm verify:db` 출력 (운영자 머신) → host/endpoint 일치 결과만 채팅
  공유

**근거**: 채팅 로그는 Slim 컨텍스트 외부 (Anthropic + 클라이언트 머신)에
저장 → 비번 회전이 *유일한 100% 안전 조치*. 회전 비용 ↑ + 사고 시 즉시 대응
필요. endpoint name만으로도 architect/builder/verifier 모두 충분히 추론 가능
(verify:db 가 host 일치 자체 검증).

**검증**: 향후 채팅 로그에서 비번 패턴 0건 = 정책 준수.

## Rejected alternatives

### 대안 1 — 모니터링 없이 신뢰

- 장점: 운영자 시간 비용 0
- 단점: ADR-0017 사고 재발 위험 高. 자동 자산 생성은 *운영자 인식 밖* 에서
  발생 → 검토 없이 신뢰 = 미래 사고 시한폭탄
- **거부 사유**: 솔로 사이드 + 사고 1회 발생 후 = 모니터링 부재 비용 > 모니터링
  비용

### 대안 2 — Neon Vercel Integration 자동 통합 비활성화

- 장점: hidden-recipe 자산 생성 0
- 단점: 환경변수 수동 등록 부담 (4 변수 × 2 환경 = 8 항목 운영자 직접 등록)
  + DATABASE_URL 회전 시 수동 동기화. 솔로 시간 비용 ↑
- **거부 사유**: 편의성 손실 > 위험 절감. ADR-0015 §T3 (운영자 *명시* 등록)
  + ADR-0018 §결정 2 (자동 자산 발견 시 즉시 점검) 조합으로 *허용된 자동화*
  와 *미허용 자동화* 구분 가능.

### 대안 3 — 모든 Slim 자산을 personal org에 통합

- 장점: 단일 org = 검토 단순
- 단점: 사업자등록 (TVA 발급 후) + 세무 분리 어려움. ARBITORIA org는 운영자
  사업체 명의 → Slim repo + Slim Neon 동일 org가 자연스러움.
- **거부 사유**: 사업 정합성 > 검토 단순성. §결정 1 (ARBITORIA만 사용) 채택.

## Consequences

### ✅ 얻는 것

- ADR-0017 같은 사건 재발 가능성 ↓ — 자동 자산 발견 시 즉시 처리 룰
- 운영자 인식 밖 자산 0 — 매월 self-check + allowlist 가드
- 신규 환경 추가 시 누락 방지 — §결정 6 4단계 절차
- 비번 노출 위험 ↓ — §결정 7 채팅 공유 금지 룰
- 사업 정합성 — Slim 자산이 ARBITORIA org에만 존재 (TVA 발급 후 세무 분리
  부담 0)

### ⚠️ 잃는 것 / 부채

- 매월 self-check 5분 운영자 부담 — PLAN 1.5.x 자동화 부채로 등록 후보
  (페이즈 6 운영 인프라에서 cron 정식화)
- 신규 환경 추가 시 4단계 절차 = 운영자 시간 ~10분 (Neon + Vercel + .env +
  ADR) — 솔로 사이드에서 흡수 가능
- ADR Amendment 추적 부담 — 자동 자산 발견 또는 신규 환경 추가 시 운영자가
  본 ADR을 직접 갱신 (architect 호출 트리거 가능)

## Validation

- ✅ ADR-0017 사건 종결 = 본 ADR §결정 1~7 정합 (현재 ARBITORIA org만
  사용, personal org에 Slim 자산 0)
- ⏳ 매월 1일 운영자 self-check 보고 (slack 또는 이메일에 고정 reminder)
- ⏳ 새 자산 발견 시 §결정 5 라이프사이클 준수 (Disconnect → 1주 → 1개월 →
  삭제)
- ⏳ 1주일 후 (2026-05-17) personal org 모니터링 = 첫 self-check 사례

## 회귀 트리거 (Trigger for revisit)

다음 중 하나가 발견되면 ADR-0018을 재검토한다:

1. **자동 자산 발견 1건 이상** (ADR-0017 외) → 본 ADR Amendment + 자산 명/처리
   결과 기록
2. **운영자 채팅에 비번 노출 1건 이상** (2026-05-10 이후) → §결정 7 강화 룰
   (예: 비번 패턴 자동 차단 hook) Amendment
3. **매월 self-check 누락 2회 연속** → 자동화 cron 즉시 도입 (페이즈 6 대기에서
   페이즈 1.5.x 부채로 격상)
4. **Neon Free tier branch 한도 도달** (10 branches / 프로젝트) — paid tier
   격상 또는 production/preview 외 환경 정리
5. **신규 환경 추가 후 verify:db 미통과 1건** → §결정 6 4단계 절차에 누락
   요소 추가

## 영향

### PLAN.md 갱신

- §1.5.5 본문: ADR-0017 + ADR-0018 인용 추가 (사고 종결 + 정책 룰)
- §1.5.x 부채 후보: 매월 self-check 자동화 cron — 페이즈 6 운영 인프라 진입
  시 신설

### 다른 ADR과의 관계

- **ADR-0011 §검증 4 (Vercel env 점검)**: 본 ADR §결정 4 (매월 self-check)
  와 정합. ADR-0011 §검증 4는 *베타 직전 1회* + ADR-0018 §결정 4는 *매월 정기*
  로 보완.
- **ADR-0015 §Step-3-prime**: 본 ADR §결정 1 + §결정 6 (신규 환경 절차)
  의 *현재 운영* 단계. ADR-0015는 ADR-0018 §결정 6의 첫 사례 (preview 환경
  추가).
- **ADR-0017**: 본 ADR의 *직접 trigger*. ADR-0017 사건이 ADR-0018 정책을
  요구.

### 외부 의존성 추가 — 0건

- `EXPECTED_DB_ENDPOINTS` allowlist 가드는 ADR-0017 §결정 2 에서 이미 적용
- 자동화 cron은 페이즈 6 진입 시 별도 ADR (Inngest 추가 함수 1개)

## References

### 헌법 + 운영자 컨텍스트
- [`CLAUDE.md`](../../CLAUDE.md) — §3 P3 (투명성 운영자의 짐), P5 (결정은
  ADR로), §8 #6 (Bash 보안 룰)
- [`docs/FOUNDER.md`](../FOUNDER.md) — 솔로 사이드, ARBITORIA org +
  personal org

### 관련 ADR
- [ADR-0011](0011-data-sources-page-and-caveats-boundary.md) — §검증 4
  Vercel env 점검 (베타 직전)
- [ADR-0015](0015-vercel-integration-and-d1-closure.md) — §Step-3-prime
  preview 환경 추가 (본 ADR §결정 6 첫 사례)
- [ADR-0017](0017-db-mismatch-incident-postmortem.md) — 본 ADR 직접 trigger

### 외부 사실 (검증된 출처 — 2026-05-10)
- [Neon Pricing — Free tier limits](https://neon.com/pricing) — branch 한도
  10 / 프로젝트
- [Neon Vercel-managed integration](https://neon.com/docs/guides/vercel-managed-integration)
  — webhook 주입 메커니즘 + 자동 변수 등록
- [Vercel Storage — Disconnect](https://vercel.com/docs/storage) — 자동 자산
  단절 절차
