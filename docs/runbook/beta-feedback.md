# Beta Feedback Runbook — 4.7.a 운영자 트랙

> **단일 출처**: PLAN §4.7.a (architect 잠금 dcbbf5c, 2026-05-14).
> 본 런북은 4 채널 setup 절차 + SLA + 4.6.d scope cut E 평가 데이터 흐름을 명세한다.
> 코드 변경 0건 — 운영자가 외부 서비스(PostHog / Gmail / GitHub) 대시보드에서 직접 setup.

---

## 목적

4.6 베타 모집 (Korean Society BE/LU / r/BENL / salair-plus banner / Twitter) 배포 후 **1주차부터** 피드백 신호를 4 채널에서 수집·triage 한다. 1주 baseline 데이터는 4.7.b 리뷰 + 4.6.d scope cut E 평가의 단일 입력.

ADR-0029 §피드백 채널 3종 (이메일 / 그룹 댓글 / GitHub Issues) + PostHog 펀널 1종 = **4 채널 합산**.

---

## Channel 1 — PostHog cookieless 펀널

**목표**: 사용자 흐름의 4-step 펀널 정의. 어디서 가장 많이 이탈하는지 시각화 (4.7.b §3 Top 3 마찰점 입력).

**헌법 §8 #1 일관**: PII 0, cookieless 방문자 수만 집계. UTM 파라미터 0 (ADR-0029 §T5).

**펀널 4-step**:

1. **visit** — `/` 또는 모집 카피의 `https://slim.lu` 직접 방문
2. **compare-enter** — `/compare/[category]` 첫 페이지 도달
3. **step-5-complete** — 5단계 입력 완주 (preview submit 직전)
4. **r-reach** — `/r/[shortId]` 결과 페이지 도달

**선택 5번째 step** (어트리뷰션 신호):

5. **change-click** — `/go/[shortId]/[itemId]` 인터스티셜 진입 (제휴 클릭 직전)

**이벤트 명 정합**: 기존 PostHog 이벤트 명세를 따른다. 운영자가 PostHog 대시보드에서 펀널 작성 시 실제 이벤트명을 확인하고 본 런북을 1줄 갱신 — 본 런북이 단일 출처이므로 mismatch 발생 시 본 파일을 진실원으로 삼는다.

**운영자 setup 절차**:

1. PostHog 대시보드 로그인 → 프로젝트 선택 (slim production)
2. 좌측 메뉴 → **Funnels** → **Create funnel**
3. 위 5 step (또는 핵심 4 step) 을 순서대로 추가
4. **Conversion window**: 24시간 (사용자가 5단계 한 세션에 완주 가정)
5. **Display**: Time conversion (단계별 평균 소요 시간)
6. 저장 → 대시보드 즐겨찾기

**측정 데이터 (4.7.b §1 정량 입력)**:

- 누적 방문자 수 (cookieless)
- step 1→4 전환율 (%)
- 평균 5단계 소요 시간 (ms)
- 단계별 이탈률 (어디서 가장 많이 떨어지는가)

---

## Channel 2 — 이메일 inbox 라벨 (Gmail)

**목표**: `kim.wonmin91@gmail.com` 받은편지함의 베타 관련 메일을 단일 라벨로 격리. 48시간 SLA triage.

**라벨 명**: `slim-beta`

**자동 분류 룰 3건** (Gmail Filter):

| 룰 | 조건 | 동작 |
|---|---|---|
| 1 | `subject:Slim OR subject:슬림` | Apply label `slim-beta` |
| 2 | `from:*@slim.lu OR list:slim.lu` | Apply label `slim-beta` |
| 3 | `("베타 피드백" OR "beta feedback" OR "베네룩스 통신")` 본문 매칭 | Apply label `slim-beta` |

**운영자 setup 절차** (Gmail):

1. Gmail 우측 톱니바퀴 → **모든 설정 보기** → **필터 및 차단된 주소** → **새 필터 만들기**
2. 위 3 룰 각각 별도 필터로 등록
3. "받은편지함 건너뛰기" **체크하지 않음** — 48h SLA 알림 위함
4. "수신 시 이 라벨 적용: slim-beta" 체크
5. 저장

**SLA**: 48시간 1차 응답 (단순 자동 회신 또는 manual 1줄). 솔로 + €300 cap 일관.

---

## Channel 3 — Korean Society 그룹 댓글 + r/BENL + Twitter mentions

**목표**: 4 채널 게시글에 달리는 댓글·답글·인용을 일일 모니터링 (5분/일).

**4 채널 게시글 (운영자 본인 게시)**:

| 채널 | 위치 | 모니터링 방법 |
|---|---|---|
| Korean Society BE/LU | Facebook 또는 카카오톡 그룹 | 운영자 그룹 알림 ON + daily check |
| Reddit r/BENL | 게시글 URL bookmark | daily check (Reddit 자체 알림은 약함) |
| salair-plus.com banner | 운영자 사이트 자체 댓글 시스템 없으면 N/A | banner 클릭 → slim.lu 도달은 Channel 1 PostHog |
| Twitter (X) | 운영자 계정 mentions / reply 알림 ON | Twitter native 알림 |

**SLA**: 48시간 1차 응답. 답글이 일정량 누적 시 (>5건/일) Korean Society 모더레이터에게 pinned post 요청.

**triage 흐름**:

1. 댓글 1건 확인 → 즉시 카테고리 라벨 (mental) — bug / UX / 요청 / legal / 기타
2. 48h 안에 1차 응답 (1줄 OK, 조사 필요 시 "확인 중입니다" + 후속 일정 1줄)
3. bug 또는 legal 카테고리 → GitHub Issue 등록 (Channel 4 흐름)
4. 1주차 끝 시점에 카테고리 분포 (4.7.b §1 정량 항목 3 입력) 집계

---

## Channel 4 — GitHub Issues triage 라벨 4종

**목표**: 전문 사용자(개발자/GDPR 민감 사용자) 가 정형화된 형태로 등록한 피드백을 라벨로 분류.

**라벨 4종** (PLAN §4.7.a 잠금):

| 라벨 | 색상 | 설명 |
|---|---|---|
| `beta-feedback` | #0e8a16 (녹색) | 베타 사용자 피드백 (포괄) |
| `bug` | #d73a4a (빨강) | 버그 신고 — 사용자 흐름 영향 |
| `feature-request` | #a2eeef (하늘) | 기능 요청 — 페이즈 4.7+ 평가 |
| `legal` | #fbca04 (노랑) | GDPR / 어트리뷰션 / 약관 — legal sub-agent 트리거 |

**운영자 setup (gh CLI)**:

```
gh label create beta-feedback --color 0e8a16 --description "베타 사용자 피드백 (포괄)"
gh label create bug --color d73a4a --description "버그 신고 — 사용자 흐름 영향"
gh label create feature-request --color a2eeef --description "기능 요청 — 페이즈 4.7+ 평가"
gh label create legal --color fbca04 --description "GDPR / 어트리뷰션 / 약관 — legal sub-agent 트리거"
```

**또는 GitHub UI**: 저장소 → Issues → Labels → New label 4회 반복.

**triage 흐름**:

1. 신규 Issue 등록 알림 (GitHub native) → 운영자 24h 내 라벨 1개 부여 + 1차 응답 1줄
2. `legal` 라벨 → legal sub-agent 호출 (또는 외부 변호사 감사 항목으로 escalate — €800 트리거 평가)
3. `bug` 라벨 → 재현 시도 후 P0/P1/P2 우선순위 메모 (4.7.c P0 fix 트리거 입력)
4. `feature-request` 라벨 → 4.8 PR 매체 컨택 후 페이즈 5 평가 (페이즈 4.7 본질은 신호 수집, premature feature 금지)

---

## 4.6.d scope cut E 평가 데이터

**1주차 베이스라인 평가 입력** (4.7.b §5 결정 1줄):

| 입력 | 임계 | 결정 |
|---|---|---|
| Channel 1 누적 cookieless 방문자 | ≤50명 | scope cut E 발동 — 50명 마감 + 4.7 진입 |
| Channel 2/3/4 피드백 0 + Channel 1 방문자 0 | 동시 충족 | **4 채널 배포 실패 신호** — architect 재호출 (ADR-0032 가칭) |
| Channel 1 방문자 >100명 | — | scope cut E 미발동, 원안 100명 모집 진행 |

ADR-0029 §T6 scope cut 옵션 E + §피드백 채널 3종 일관.

---

## SLA 요약 (운영자 5분/일)

| Channel | daily 작업 | 1차 응답 SLA |
|---|---|---|
| 1 PostHog | 펀널 그래프 1회 확인 (1분) | N/A (사용자와 직접 대화 없음) |
| 2 Gmail | `slim-beta` 라벨 확인 + 48h SLA 응답 (1~2분) | 48시간 |
| 3 그룹/Reddit/Twitter | 4 채널 댓글 확인 + 답글 (2~3분) | 48시간 |
| 4 GitHub Issues | 신규 Issue 라벨링 + 응답 (1분) | 24시간 |

**총 시간**: 5~7분/일. €300 cap + 솔로 일관.

---

## 헌법 정합

- **P1 (정보 우선)** — PostHog 펀널은 *source = PostHog dashboard URL* + *fetched_at = 운영자 캡처 시각* 으로 4.7.b 리뷰에 명시. 추측 0.
- **P3 (투명성은 운영자의 짐)** — 4 채널 SLA 운영자가 부담. 사용자에게는 "48시간 안에 응답합니다" 약속.
- **§8 #1 (사용자 데이터 외부 0)** — PostHog cookieless + Gmail 라벨 + GitHub Issues 표준 — 별도 PII 수집 채널 0.
- **§8 #3 (다크 패턴 금지)** — 피드백 채널 노출은 모집 카피 4 footer 단일 위치 — fake urgency / pre-checked / scarcity 0.

---

## 참조

- **PLAN §4.7.a** — 본 런북 cross-ref 단일 출처
- **PLAN §4.7.b** — 1주 베이스라인 리뷰 (본 런북의 4 채널 데이터 = 리뷰 §1 정량 + §2 정성 입력)
- **PLAN §4.6.d** — scope cut E 평가 (본 런북의 §scope cut E 데이터 흐름 단일 출처)
- **ADR-0029 §피드백 채널** + §T5 (추적 0) + §T6 (scope cut 옵션 E)
- **ADR-0026 §T7** — `?ref=` 어트리뷰션 패턴은 *제휴 클릭* 단계 전용 — 본 런북의 모집 채널 도달은 *비-어트리뷰션* 컨텍스트
- **헌법 §8 #1·#3** — 추적 0 + 다크패턴 0 정신

---

## 4.7.a DoD 충족 흐름

PLAN §4.7.a DoD 3건:

1. **4 채널 모두 setup 완료** — 운영자가 본 런북의 Channel 1~4 setup 절차를 따라 외부 서비스 대시보드에서 직접 작성. 완료 시점에 PLAN §4.7.a `[x]` 마킹 가능.
2. **1주차 첫 피드백 수신 또는 (피드백 0 시) PostHog 0 방문자 확인** — 4.7.b §1 정량 데이터로 검증.
3. **ADR-0029 §Verification §운영 추적 cross-ref** — 본 런북의 §4.6.d scope cut E 평가 데이터 흐름이 ADR-0029 §운영 추적의 4 채널 배포 + PostHog 모니터링 + 1주차 피드백 + 3주차 scope cut 평가와 정합.

**Claude 측 산출물 (본 런북)** = setup spec + SLA + 데이터 흐름 단일 출처. **운영자 측 산출물** = 실제 PostHog 펀널 / Gmail 필터 / GitHub 라벨 / 댓글 모니터링 setup. 양쪽 모두 완료 시 4.7.a `[x]`.
