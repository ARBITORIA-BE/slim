# ADR-0032: Vercel team scope — ARBITORIA team 신설 (결정 잠금 + 실행 defer)

## Status

**Accepted (2026-05-15, Decision Locked + Execution Deferred)**.

채택 결정 = **ARBITORIA team 신설** (Pro plan $20/seat/month, slim 프로젝트 personal → ARBITORIA team 이관). 단, **운영자 액션 O1 (Pro plan 구독 결제) 의 실행은 TVA 부가가치세 번호 발급 시점까지 defer**. 결정 트랙은 본 ADR 로 잠금, 실행 트랙은 트리거(§Trigger) 발화 시 운영자 OAuth 1회로 재개.

> 이전 상태 추정 (본 ADR 신설 시점에 운영자 컨텍스트로 명시): "Proposed 직전 (decision in flight)". 본 ADR 작성으로 **Accepted (Decision Locked + Execution Deferred)** 1단계 전이. 옵션 C 의 본질 = "실행 보류" 가 아닌 "**결정 잠금 + 실행 게이트 분리**".

> 작성 메모: 본 ADR 은 *결정 + defer 트리거 + interim 운영 정책* 명세. 코드 변경 0건. 운영자 액션 (Vercel 콘솔 결제) 은 본 ADR 범위 외 (TVA 발급 후).

## Context

### 1. 직접 트리거 — PLAN §D.3.b + ADR-0020 §결정 6

PLAN §D.3.b (현 L95-97, 본 ADR 작성 직전):

> **D.3.b** Vercel team scope 결정 — personal `kimwonmin91-4132s-projects` 유지 vs ARBITORIA team 신설 (별도 ADR-0021 트리거, 비용 영향 검토)

ADR-0020 §결정 6 가 본 ADR 을 *D.3.b GATE-K 직전 결정* 으로 예약했다. ARBITORIA-BE 인벤토리 정렬 후속의 마지막 운영자 트랙 결정.

### 2. 현 상태 (ADR-0019/0020/0024/0031 잠금)

| 식별자 | 현 위치 | 이상적 위치 (옵션 A) |
|---|---|---|
| GitHub repo | `Arbitoria/slim` (org) | 변경 없음 |
| Vercel project | `slim` (`kimwonmin91-4132s-projects` personal team) | `slim` (`arbitoria` team) |
| Neon project | `slim` (ARBITORIA-BE org) | 변경 없음 |
| Inngest workspace | Arbitoria / Production env | 변경 없음 |
| 도메인 | `slim.lu` (Vercel Domains, personal team) | `slim.lu` (Vercel Domains, ARBITORIA team) |

핵심: Vercel 만 personal team scope. ARBITORIA 식별자 4건 중 1건이 운영자 개인 영역에 묶여 있음 = **identity drift**. ADR-0020 §결정 6 가 이를 정렬 follow-up 으로 예약.

### 3. 4.6 베타 운영 컨텍스트

- 4.6 베타 모집 카피 4건 배포 *직전* (4.6.c 운영자 트랙, ADR-0029 Amendment 1 잠금).
- slim.lu 도메인 ✅ live (D.3.d, 2026-05-14).
- Inngest sync ✅ 종결 (D.3.c, 2026-05-14, 신선도 100%).
- Neon Integration (ADR-0024) ✅ 옵션 C 잠금 (2026-05-15).
- 본 ADR 이 **D.3 의 마지막 결정 트랙 미해결 sub-task** (D.3.a 운영자 OAuth 트랙 별개).

### 4. 운영자 비용 현실 (€300 cap)

- ADR-0004 §결정 2 — €300/mo 인프라 cap.
- Vercel Pro = **$20/seat/month USD**. 환율 EUR 환산 약 **€18.50/mo** × 12개월 = **€222/year**.
- 운영자 부가가치세 환급 가치: TVA 발급 후 사업비 처리 시 VAT 21% ≈ **€46.6/year 환급** (€222 × 21%).
- 현 시점 운영자 TVA 번호 **발급 대기 중** — 결제 즉시 진행 시 환급 가치 손실.

### 5. 트리거 — 운영자 결정 "구독은 TVA 나오면 그때하자"

운영자 명시 결정 (2026-05-15) — 본 ADR 작성 직전. 사유 추정:
- VAT 환급/사업자 비용 처리 위해 TVA 발급 후 구독 진행.
- €18.50/mo × 12 = €222/year, VAT 21% ≈ €46.6/year 환급 가치 보존.
- 4.6 베타가 **personal team scope 으로 진입 가능** 하다는 평가 (§4.6 베타 진입 blocker 재평가 참조).

PLAN 매핑: 페이즈 0.5 — **D.3.b** (결정 잠금) + **D.3.a** (실행 defer). ADR-0020 §결정 6 의 *조건부 후속*. ADR-0024 와 정렬 (옵션 C 보수 유지).

## Decision

### 결정 1 — ARBITORIA team 신설 (Decision Locked)

Vercel team scope 을 **`arbitoria` 신설 team 으로 격상**. slim 프로젝트를 `kimwonmin91-4132s-projects` personal team 에서 `arbitoria` team 으로 이관. plan = **Pro** ($20/seat/month USD, 솔로 1 seat).

근거 3문장:
1. ARBITORIA 식별자 4건 중 GitHub/Neon/Inngest 3건이 이미 `Arbitoria*` 으로 정렬됐고, Vercel personal team scope 만 drift — ADR-0019 §정렬 7 + ADR-0020 §결정 6 가 본 정렬을 마지막 운영자 트랙으로 예약.
2. Vercel Hobby 는 *non-commercial only* (ADR-0024 §Cost projection cross-ref) → 베타 모집 시점에서 어트리뷰션 매출 가능성 발생 시 commercial-use TOS 위반 risk → Pro 격상이 ADR-0020 §회귀 트리거 #6 이미 예약된 비용.
3. €18.50/mo × 12 ≈ €222/year + VAT 환급 €46.6/year → 순 비용 €175.4/year ≈ **€14.6/mo** < €300 cap 의 5%. 비용 제약 아님.

### 결정 2 — 실행 defer (Execution Deferred)

**운영자 액션 O1 (Vercel Pro plan 결제) 의 실행은 TVA 번호 발급 시점까지 defer**. 결정 트랙은 본 ADR 로 final, 실행 트랙은 §Trigger 발화 시 운영자 OAuth 1회로 재개.

근거 1문장: TVA 발급 시 사업비 처리 + VAT 21% 환급 가치 (€46.6/year) 보존 + 4.6 베타가 personal team scope 으로 진입 가능 (§4.6 베타 진입 blocker 재평가 참조) 하므로 결정 잠금 + 실행 defer 분리가 정합.

### 결정 잠금 + 실행 defer 분리 원칙 (Meta-decision)

본 ADR 의 핵심 패턴 = "**결정 잠금**" 과 "**실행 게이트**" 의 명시적 분리. ADR-0024 옵션 C (조건부 결정 잠금) 와 동일 패턴 — 옵션 C 가 *재평가 트리거 발화 시 실행 재개* 라면, 본 ADR 은 *TVA 발급 시 실행 재개*. ARBITORIA team 신설 결정은 **final** — 향후 architect 재호출 시 "다른 옵션 검토" 가 아닌 "**실행 게이트 통과 확인**" 만 진행.

## Trigger (실행 게이트)

> **Blocked until TVA number issued. Re-entry trigger = operator reports TVA number to Pieter.**

| # | 게이트 | 측정 방법 | 발화 시점 |
|---|---|---|---|
| **G1** | 운영자 TVA 번호 발급 완료 | 운영자 직접 Pieter 에 신호 (다음 세션 시작 시 보고 또는 메모리 갱신) | 발급 즉시 |
| **G2** | (보조) 4.6 베타 운영 중 commercial-use 명시 위반 신호 (Vercel 자동 경고 메일 등) | 운영자 메일 inbox 또는 Vercel dashboard 알림 | 즉시 (G1 우회) |
| **G3** | (보조) ADR-0024 §재평가 트리거 T1~T4 중 1건 발화 | ADR-0024 §재평가 트리거 참조 | T1~T4 중 1건 즉시 (G1 우회) |

G1 = 정상 트리거 (운영자 결정 기반). G2/G3 = 비상 트리거 (외부 압력 기반). 어떤 트리거 발화시 §Operator Steps 진입.

## Operator Steps (TVA 발급 후, ~15분)

운영자 작업 (Claude 진행 불가):

- **O1** Vercel dashboard → Settings → Plan → Upgrade to Pro ($20/seat/month USD). 결제 카드 등록 + TVA 번호 인보이스 입력 (사업자 비용 처리).
- **O2** Vercel dashboard → Account Settings → Teams → Create Team `arbitoria` (Pro plan, 1 seat).
- **O3** slim 프로젝트 → Settings → Transfer → personal team `kimwonmin91-4132s-projects` → `arbitoria` team. 이관 중 도메인/env vars/integration 상태 확인.
- **O4** GitHub repo `Arbitoria/slim` 의 Vercel App 권한 재인증 (org 직접 권한, redirect follow 격상 — D.3.a 와 동시 완료).
- **O5** Pieter 에 신호 (다음 세션 시작 시 보고). PLAN §D.3.a/b ✅ 마킹 + D.3 부모 [x] + GATE-K 닫힘.

> O4 = D.3.a 와 동시 완료 — 본 ADR 채택 후 ARBITORIA team scope 에서 Vercel App 권한 재인증이 자연스러움. 두 작업 분리 비효율.

## Consequences

### 즉시 영향 (본 ADR Accepted 직후, 4.6 베타 진입 직전)

- **결정 트랙 GATE-K 닫힘** — D.3 의 5 sub-task 중 결정 트랙 (D.3.b + D.3.e) 모두 잠금 완료.
- **실행 트랙 GATE-K 열림 (defer)** — D.3.a (Vercel App 설치) + D.3.b 의 O1~O5 (team 신설/이관) 가 TVA 발급 트리거 대기.
- 4.6 베타 진입 카피 배포(4.6.c) **blocker 아님** — §4.6 베타 진입 blocker 재평가 참조.

### Defer 기간 interim 정책 (TVA 발급 전)

- **I1.** slim 프로젝트는 `kimwonmin91-4132s-projects` personal team 유지. Vercel dashboard 상 표시 = personal team scope.
- **I2.** 4.6 베타 (현 PLAN 다음 미완료) 는 interim 정책 하에서 **진입 가능** — §4.6 베타 진입 blocker 재평가 결론 0건.
- **I3.** Inngest sync / slim.lu 도메인 / Neon production — personal team scope 에서 정상 운영 (D.3.c·d ✅ 이미 검증됨 2026-05-14).
- **I4.** ADR-0024 옵션 C (Neon Integration 보수 유지) 와 정렬 — 옵션 A 채택 시 ARBITORIA team grant 필요했으나 defer 결정이 옵션 B/C 유지 결정과 충돌 없음. 두 ADR 이 서로 *강화* 관계 (보수적 운영 + 결정 잠금 분리).
- **I5.** Vercel Hobby commercial-use 회색지대 risk — 베타 모집 카피 자체가 어트리뷰션 매출 *직접* 발생시키지 않음 (4.1.a~f 어트리뷰션 인프라 ✅, 단 *실제 클릭 발생* 시점에서 risk 활성). 4.6 베타 1주차 (4.7 진입) 시 architect 재호출하여 매출 발생 여부 재평가 → G2 트리거 가능.
- **I6.** PLAN.md 추적 표시 — D.3.a + D.3.b 의 라벨 = `⏸ Defer — TVA 발급 트리거 (Trigger gate)`.

### 4.6 베타 진입 blocker 재평가 결론

**Blocker 0건 — personal team scope interim 운영으로 4.6 베타 진입 가능.**

근거 3문장 (헌장 §3 P1·P3 + §8 [4] 점검):

1. **P1 (정보 우선) 위반 0** — 사용자에게 노출되는 모든 숫자/주장은 `source` + `fetched_at` 으로 personal vs team scope 와 무관. 데이터 fidelity 는 Inngest sync (D.3.c ✅) + 어드민 헬스 카드 100% 신선도로 보장됨.
2. **P3 (투명성은 운영자의 짐) 위반 0** — 사용자에게는 URL = `slim.lu` (커스텀 도메인) 만 노출. personal team vs ARBITORIA team 구분은 운영자 dashboard 내부 사실 — 사용자에게 *말할 필요 없는 운영자 영역*. 결제·청구서·TVA 처리는 운영자 사적 영역, 사용자 영향 0. Privacy policy / Affiliate disclosure / Terms 는 `slim.lu` 도메인 기준 작성 (4.1.a~f + ADR-0026 §검토 2 통과) → team scope 변경 시 문서 변경 0건.
3. **§8 [4] (광고/비교 분리) 위반 0** — 비교 결과 페이지는 100% 알고리즘 결과 (ADR-0021 §T4). team scope 은 인프라 영역으로 비교 결과 알고리즘에 영향 0.

ADR-0029 §T2 정직성 잠금 조건 (신선한 가격 비교) — D.3.c Inngest sync 완료 (2026-05-14) 로 이미 해제. 본 defer 결정과 무관.

→ **4.6 베타 진입 차단 0 — 4.6.c 카피 배포 가능**.

### 중기 영향 (TVA 발급 후 ~ 4.7 ~ 4.8)

- O1~O5 일괄 실행 → D.3 GATE-K 완전 닫힘.
- ARBITORIA team scope 으로 이관 후 Neon Integration (ADR-0024) 옵션 A 격상 재평가 가능 (ADR-0024 §재평가 트리거 T4 정합).
- VAT 환급 €46.6/year 처리 — 운영자 회계 트랙 (Pieter 무관).

### 운영 부담

- Defer 기간 — 운영자 부담 0. Pieter 부담 0 (본 ADR 작성 1회 + PLAN 라벨 갱신).
- TVA 발급 후 — 운영자 O1~O5 (~15분, 1회). verifier 호출 시 ARBITORIA team scope 변경 검증 (V1~V3 게이트 — Verification 절 참조).
- Defer 기간 길수록 (TVA 발급 지연 길수록) — ADR-0024 §재평가 트리거 추적 + Vercel Hobby commercial-use 회색지대 risk 누적. 4.7~4.8 사이 architect 재호출 권고 (운영자 메모리 트리거).

### 보안 / 정합성 (ADR cross-ref)

- ADR-0019 §정렬 7 — 본 ADR 이 §정렬 7 의 deferred 분해 + 실행 게이트 명시.
- ADR-0020 §결정 6 + §회귀 트리거 #6 — 본 ADR 이 §결정 6 의 정렬 follow-up 마무리. §회귀 트리거 #6 (Vercel Pro 격상) 의 *결정* 잠금 — 실행은 TVA 발급 트리거.
- ADR-0024 §최종 결정 (옵션 C) — 본 ADR 의 defer 와 정합. 두 ADR 이 *결정 잠금 + 실행 보류* 패턴으로 정렬.
- ADR-0029 §T2 — Inngest sync 완료로 정직성 잠금 해제됨 (본 ADR 무관).
- ADR-0031 — fresh-start 정체성 통합 완료 (`Arbitoria` author 통합). 본 ADR 채택으로 Vercel team scope 까지 통합 = identity drift 완전 해소 (TVA 발급 후).
- 헌법 §3 P3 + §8 #1 — 본 ADR 의 사용자 영향 0 보장.

## Risks

| # | 위험 | 발생 가능성 | 영향 | 대응 |
|---|---|---|---|---|
| R1 | TVA 발급 지연 (행정 6개월+) | **중간** (베네룩스 TVA 통상 3~6개월) | Defer 기간 길어짐 → Vercel Hobby commercial-use 회색지대 누적 | 4.7~4.8 사이 architect 재호출 (운영자 메모리 트리거) + G2/G3 비상 트리거 모니터링 |
| R2 | Vercel Hobby commercial-use TOS 위반 | **중간** (베타 모집 직후 어트리뷰션 매출 발생 시) | 프로젝트 정지 risk | G2 비상 트리거 → 즉시 O1 실행 (TVA 발급 전이라도) — 환급 손실 < 정지 손실 |
| R3 | ARBITORIA team 이관 시 도메인/env vars 손실 | 낮음 (Vercel transfer 매뉴얼 검증된 워크플로) | slim.lu 일시 다운 또는 Inngest sync 깨짐 | O3 단계에서 단계별 검증 + verifier V1~V3 게이트 |
| R4 | TVA 발급 후 운영자가 O1~O5 실행 시점 잊음 | 낮음 (운영자 메모리 시스템 + Pieter 매 세션 PLAN 확인) | Defer 무기한 연장 | 본 ADR §Trigger G1 + PLAN §D.3.a/b 라벨 `⏸ Defer` 가 매 세션 visible |
| R5 | $20/seat → 다중 seat 격상 (협업자 추가 시) | 낮음 (솔로) | 비용 2배 | ADR-0024 §재평가 트리거 T2 (협업자 추가) 와 동시 발화 → architect 재호출 |
| R6 | 본 ADR §Trigger 자동 추적 부재 → 운영자 메모리 단일 의존 | 중간 | TVA 발급 후 실행 지연 | §자동 추적 옵션 (a/b/c) 권고 — 옵션 a (harness:plan 확장) 채택 권고 |

## 자동 추적 권고 (§Trigger 발화 추적)

본 ADR §Trigger G1 (운영자 TVA 발급) 의 자동 추적 옵션 3건 검토.

### 옵션 a — `pnpm harness:plan` 확장 (Defer 트리거 정규식 grep) — **권고**

- **방법**: PLAN.md 안의 `⏸ Defer — <트리거명>` 마커 정규식 grep. `scripts/harness/plan.ts` 에 warning 출력 ("Defer 트리거 N건 추적 중: D.3.a, D.3.b — TVA 발급 트리거"). 매 `/checkpoint` 또는 stop hook 시 visible.
- **장점**: 추가 sub-task 0건 (1개 정규식 + warning 출력만). 운영자 메모리 외 자동 reminder 채널. 비용 0.
- **단점**: 트리거 *발화 감지* 는 못 함 (운영자 직접 보고 필요). 정직한 "발화 추적" 이 아닌 "**defer 상태 시각화**".
- **사유**: 솔로 컨텍스트에서 트리거 *자동 감지* 는 과잉. defer 상태가 매 세션 visible 만 해도 운영자 잊을 risk R4 해소. 옵션 b 의 별도 sub-task 비용보다 ROI 정합.

### 옵션 b — 별도 sub-task 분해 (4.7 후반에 trigger watch)

- **방법**: PLAN 페이즈 4.7 또는 4.8 에 sub-task `[ ] D.3.a/b trigger watch — TVA 발급 여부 운영자 확인 (월 1회)` 추가.
- **장점**: 명시적 monitoring 항목. 운영자 트랙 일관.
- **단점**: PLAN 합계 +1 (정합 부담). sub-task 자체가 *반복 작업* — 1회 항목 모델과 안 맞음. 4.7~4.8 sub-task 이미 a~d 분해 완료 (2026-05-14) — 추가 분해 노이즈.

### 옵션 c — MEMORY.md 단일 의존 (자동화 X)

- **방법**: 운영자 메모리 시스템에 "TVA 발급 시 ADR-0032 §Operator Steps O1~O5 실행" 기록.
- **장점**: 비용 0.
- **단점**: 메모리 단일 의존 = R4 risk 활성. PLAN 외부 채널 = Pieter 매 세션 visible 보장 못 함.

### 권고 = **옵션 a**

근거: (1) 솔로 컨텍스트에서 발화 *자동 감지* 는 과잉 — defer 상태 *시각화* 만으로 R4 충분히 해소 (2) PLAN.md 합계 변동 0 (3) `pnpm harness:plan` 확장 비용 = 1 정규식 + warning 출력 (~5 line code) (4) 매 `/checkpoint` 시 자동 reminder.

구현 sub-task 별도 분해 — 본 ADR 범위 외, builder 후속. 본 ADR §History 에 옵션 a 채택 메모만 기록.

## Verification (TVA 발급 후 O1~O5 실행 시 게이트)

본 §Verification 은 **TVA 발급 후 운영자 O1~O5 실행 시** 적용. defer 기간 중에는 §Verification 스킵.

| # | 게이트 | 검증 방법 | 책임 |
|---|---|---|---|
| V1 | Vercel Pro plan 구독 활성 + 인보이스에 TVA 번호 표기 | Vercel dashboard → Settings → Billing → 인보이스 PDF | 운영자 |
| V2 | `arbitoria` team 생성 + slim 프로젝트 이관 완료 | Vercel dashboard URL 이 `vercel.com/arbitoria/slim` 으로 변경 | 운영자 + verifier (read-only HTTP check) |
| V3 | 이관 후 slim.lu HTTPS 200 + Inngest sync 정상 + Neon production 연결 정상 | `curl https://slim.lu` 200 + `https://slim.lu/admin` 신선도 100% + `pnpm verify:db` all-green | verifier |

V1~V3 통과 시 본 ADR §History Amendment + PLAN §D.3.a/b ✅ 마킹 + D.3 부모 [x] + GATE-K 완전 닫힘.

## References

- [ADR-0019](0019-arbitoria-three-platform-alignment.md) §정렬 7 — Vercel team scope 정렬 후속 (본 ADR 의 부모)
- [ADR-0020](0020-arbitoria-inventory-and-alignment-corrections.md) §결정 6 + §회귀 트리거 #6 — Vercel Pro 격상 시점 결정 잠금
- [ADR-0024](0024-neon-vercel-integration.md) §최종 결정 — 옵션 C 조건부 잠금, 본 ADR 과 *결정 잠금 + 실행 보류* 패턴 정렬
- [ADR-0029](0029-beta-recruitment.md) §T2 — 신선도 정직성 잠금 (이미 해제, 본 ADR 무관)
- [ADR-0031](0031-fresh-start-identity-unification.md) — fresh-start 정체성 통합 (본 ADR 채택 후 Vercel team scope 까지 통합)
- 헌법 §3 P1·P3 + §4 (월 €300 cap) + §8 #1 — 본 ADR 의 사용자 영향 0 보장
- PLAN §D.3.a (L93-94) + §D.3.b (L95-97) — 본 ADR 의 직접 트리거
- **External (fetched 2026-05-15, ADR-0024 §Cost projection 인용)**:
  - [Vercel Pricing](https://vercel.com/pricing) — Pro $20/seat/month
  - [Vercel Hobby Plan](https://vercel.com/docs/plans/hobby) — commercial-use 금지

## History

- **2026-05-15 (Accepted, Decision Locked + Execution Deferred)** — Pieter 세션, architect 호출로 작성. ARBITORIA team 신설 결정 잠금 + O1 Pro plan 결제 실행을 TVA 번호 발급 트리거까지 defer. §Trigger G1~G3 + §Operator Steps O1~O5 + §Defer 기간 interim 정책 I1~I6 + §4.6 베타 진입 blocker 재평가 결론 (blocker 0건) + §자동 추적 권고 (옵션 a, `pnpm harness:plan` 확장) 명시. ADR-0024 옵션 C 와 정렬 — *결정 잠금 + 실행 보류* 패턴 동형. PLAN §D.3.a/b 라벨 = `⏸ Defer — TVA 발급 트리거` 갱신.
