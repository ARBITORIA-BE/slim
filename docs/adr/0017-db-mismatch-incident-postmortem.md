# ADR-0017: DB 미스매치 사건 종결 보고 (silent-darkness + slim-prod hidden-recipe)

## Status

**Accepted (2026-05-10)** — 사건 종결. 후속 cleanup 일정만 잔존 (1주일 +
1개월 모니터링).

본 ADR은 **사건 종결 보고 + 방어 조치 적용 결과 + 재발 방지 트리거** 만 담는다.
실 코드/설정 변경은 PLAN 1.5.5 (verify-db.ts allowlist 가드) + ADR-0011
§검증 4 (Vercel env 점검) + ADR-0015 §Step-3-prime 에 이미 반영됨. 본 ADR은
*사건 자체*를 ADR로 기록해 인덱스에서 추적 가능하게 한다 (P5 정합).

## Context — 사건 타임라인

### 2026-05-09 초 — 첫 connection string 채팅 공유

운영자가 Slim DB connection string을 채팅에 공유. host =
`ep-silent-darkness-alpbpetq-pooler.c-3.eu-central-1.aws.neon.tech`. 이 host
가 *어느 Neon 프로젝트* 에 속하는지 운영자도 architect도 인식 못함 — Neon
Console에서 Slim 프로젝트 production 브랜치 endpoint를 *교차 검증하지 않은
상태*. 채팅으로 비번 노출 (1차).

### 2026-05-09 — db:push 4회 실행

`silent-darkness` host로 마이그레이션 0000~0003 적용 (provider / tariff /
tariff_snapshot / comparison_request / comparison_result / comparison_result_item
6 tables). PLAN 1.1~1.5 [x] 마킹. 실제로는 *운영자 의도와 다른 Neon 프로젝트*
에 적용되었으나 시점에는 인식 못함.

### 2026-05-09 후반 — 운영자가 Slim production 브랜치 0 tables 보고

운영자가 Neon Console에서 Slim production 브랜치 (당시 가정한 endpoint)를 직접
열람 → 0 tables 발견. 미스매치 인지. silent-darkness 외부 endpoint 확정.

### 2026-05-09 — verify-db.ts 강화

PLAN 1.5.5 부채로 등록 + `scripts/verify-db.ts` 신설:

- 접속 host + endpoint 노출 (운영자 육안 비교 가능)
- `EXPECTED_DB_ENDPOINT` env var 단일 가드 (불일치 시 exit 1)
- `pnpm verify:db` 등록 + `scripts/hooks/stop-gate.sh`에 Gate 5 통합

이 시점에는 endpoint 1개 단일 가드 — preview 환경 미고려.

### 2026-05-10 — production 브랜치 connection string 재공유

운영자가 Slim production 브랜치의 *정확한* connection string 채팅 공유. host
= `ep-fancy-fog-alt18340-pooler...`. 비번 노출 (2차). 운영자가 즉시 비번 회전.

### 2026-05-10 — db:push 재실행 + 시드 통과

새 endpoint(`ep-fancy-fog-alt18340`)로 db:push 적용 → Slim production에 6
tables 정상 생성. provider 시드 (proximus-be, telenet-be) 통과. PLAN 1.1~1.5
[x] 마킹의 *형식 근거* 가 Slim production 브랜치로 이전됨 (silent-darkness
브랜치는 빈 schema만 잔존).

### 2026-05-10 GATE-I — hidden-recipe 발견 + cleanup

운영자가 Vercel Storage 점검 중 `slim-prod` hidden-recipe 발견 (Neon Vercel
Integration이 *자동* 등록). 자동 등록 변수 14개 정리 + Vercel Storage
`slim-prod` Disconnect. 운영자 + architect 합의:

- Neon `slim-prod` 프로젝트 → 1개월 보관 후 검토 후 삭제 (2026-06-10 결정 시점)
- personal organization (`kimwonmin91-4132's projects`) → 1주일 모니터링
  (2026-05-17까지)
- ARBITORIA org Slim production + preview 양쪽 환경 검증 완료:
  - production: `ep-fancy-fog-alt18340` (Vercel build 44s OK, DB 정상)
  - preview: `ep-autumn-water-all6d93e` (Vercel build 41s OK, DB 정상)
- `EXPECTED_DB_ENDPOINTS` allowlist 가드 적용 — 2 endpoint (콤마 구분) 통과
  검증됨

## Decision — 사건 결과 + 후속 룰

### 1. silent-darkness endpoint 정체 확인 + cleanup 일정

운영자 발견: `silent-darkness`는 Vercel Storage 자동 생성 hidden-recipe
(`slim-prod` Neon 프로젝트). ARBITORIA org Vercel 통합이 자동으로 만들었으나
운영자가 의식적으로 만든 자산이 아님 → "갈 곳 없는 endpoint"였음.

| 자산 | 조치 | 일정 |
|---|---|---|
| Vercel Storage `slim-prod` | Disconnect 완료 | 2026-05-10 |
| 자동 등록 환경변수 14개 | 정리 완료 | 2026-05-10 |
| Neon 프로젝트 `slim-prod` | 1개월 보관 후 운영자 검토 후 삭제 | 2026-06-10 결정 |
| personal org (`kimwonmin91-4132's projects`) | 1주일 모니터링 | 2026-05-17 |

### 2. 방어 조치 적용 완료 (코드/설정 차원)

- **PLAN 1.5.5** (DB 인스턴스 가드) → `scripts/hooks/stop-gate.sh` Gate 5로
  통합. `.env.local` 부재 시 스킵해 CI 안전.
- **`EXPECTED_DB_ENDPOINTS` allowlist** (2026-05-10 신설) — production +
  preview 두 endpoint 명시. 콤마 구분. 둘 중 하나 매칭 시 통과.
  - production: `ep-fancy-fog-alt18340`
  - preview: `ep-autumn-water-all6d93e`
- **ADR-0011 §검증 4** + **ADR-0015 §Step-3-prime** — Vercel env 점검 단계가
  ADR 본문에 들어가 회귀 트리거 발동 시 검토 의무화.

### 3. 재발 방지 트리거 (운영 룰)

- **새 endpoint 발견 시** → ADR-0018 (Neon 멀티 org 정책) §결정 1~3 따름
- **hidden-recipe 자동 등록 변수 발견 시** → 즉시 disconnect + ADR-0018 §결정
  2 (자동 자산 점검 룰) 발동 + scribe 운영 노트
- **운영자가 connection string 채팅 공유 시** → ADR-0018 §결정 7 (외부
  endpoint 채팅 공유 금지) 룰 따름. 향후엔 endpoint name만 공유 + verify:db
  로 host/endpoint 일치 검증

### 4. 사건 영향 평가

| 차원 | 평가 |
|---|---|
| 코드 변경 | **0** — silent-darkness DB는 빈 schema만, PII 0, 데이터 손실 0 |
| 보안 노출 | **비번 2회 채팅 노출** (운영자 회전 완료) — 즉각 위협 0 |
| 일정 영향 | **~12시간** (2026-05-09~10) — 페이즈 1.5에서 흡수, 페이즈 1 [x] 마킹 형식 근거 이전됨 |
| 사용자 영향 | **0** — 베타 미시작 + production 브랜치는 운영자 자신만 접근 |
| GDPR 영향 | **0** — PII 0 (스키마만, 시드는 provider 마스터 2 행만) |

## Validation

- ✅ `pnpm verify:db` allowlist 통과 = 사건 종결 신호 (production + preview 두
  endpoint 모두 통과)
- ✅ Vercel preview build 41s + production build 44s = 양쪽 환경 정상 연결
- ✅ 자동 등록 변수 14개 정리 완료 = 옛 hidden-recipe 자산 격리 완료
- ⏳ 1주일 후 (2026-05-17) personal org 모니터링 결과 운영자 self-check
- ⏳ 1개월 후 (2026-06-10) Neon `slim-prod` 프로젝트 삭제 결정

## 회귀 트리거 (Trigger for revisit)

다음 중 하나가 발견되면 ADR-0017을 재검토한다:

1. **silent-darkness host로의 접근 시도 1건 이상** — verify:db allowlist 가드
   bypass 또는 새 환경 추가 시점 누락. ADR-0018 §결정 6 (신규 환경 추가 절차)
   재검토.
2. **2026-05-17 personal org 모니터링에서 예상 외 자산 발견** — ADR-0018
   §결정 1 (personal org에 Slim 자산 0) 위반.
3. **2026-06-10 시점에 운영자가 `slim-prod` 삭제 *못함*** (잔여 의존성 발견 등)
   — 본 ADR Amendment + 추가 보존 결정.

## Alternatives considered

### 대안 1 — ADR 작성 없이 PLAN 1.5.5 본문에만 1줄 인용 (거부)

- 장점: 문서 부담 0
- 단점: 사건 자체가 *외부 자동화 * (Vercel-Neon 통합) + *비번 노출 2회* + *3개
  Neon 프로젝트 발견* 으로 P5 (결정은 ADR로) 임계값 초과. PLAN 본문 1줄로는
  타임라인/영향 평가/cleanup 일정 추적 불가.
- **거부 사유**: 사건 규모 + 미래 방어 룰 명시 필요성으로 ADR 신설.

### 대안 2 — silent-darkness 즉시 삭제 (거부)

- 장점: 자산 정리 즉결
- 단점: 운영자가 *왜 그 endpoint가 거기 있었는지* 학습 못함 → 재발 가능성.
  `slim-prod` Neon 프로젝트는 1개월 보관해 운영자가 *Vercel-Neon 통합 자동
  생성 메커니즘* 을 직접 확인할 시간 부여.
- **거부 사유**: 운영자 학습 가치 (FOUNDER.md §5) + 1개월 보관 비용 0 (Neon
  Free tier inactive 프로젝트는 storage만 차지).

## References

### 헌법 + 운영자 컨텍스트
- [`CLAUDE.md`](../../CLAUDE.md) — §3 P5 (결정은 ADR로), §8 #6 (Bash 보안 룰
  2026-05-10 신설)
- [`docs/FOUNDER.md`](../FOUNDER.md) — 솔로 사이드, 운영자 학습 가치 우선

### 관련 ADR
- [ADR-0011](0011-data-sources-page-and-caveats-boundary.md) — §검증 4 Vercel
  env 점검 (방어 조치 #2)
- [ADR-0013](0013-fetcher-real-scraping-risk-assessment.md) — §평가 1 (외부
  fetcher 차단 위험) — 본 사건과 *무관* (외부 fetcher 차단 ≠ 내부 endpoint
  미스매치). 본 ADR은 ADR-0013 잔여 위험 *외*의 새로운 위험 카테고리.
- [ADR-0015](0015-vercel-integration-and-d1-closure.md) — §Amendment 1
  §Step-3-prime (Vercel env 점검) — 방어 조치 #2의 운영 단계
- [ADR-0018](0018-neon-multi-org-policy.md) — 본 사건의 후속 정책 (자동 자산
  점검 룰 + 멀티 org 라이프사이클)

### 사건 산출물
- [`scripts/verify-db.ts`](../../scripts/verify-db.ts) — `EXPECTED_DB_ENDPOINTS`
  allowlist 가드 (2026-05-10 적용)
- [`PLAN.md`](../../PLAN.md) — §1.5.5 (DB 인스턴스 가드, [x] 완료) + §1.5.7
  (Bash 보안 부채, [ ] 미완료)

### 사건 타임라인 출처
- 운영자 채팅 컨텍스트 (2026-05-09 ~ 2026-05-10) — Pieter 세션 로그
- GATE-I 운영자 보고 (2026-05-10) — Vercel build 44s/41s 검증 + hidden-recipe
  발견
