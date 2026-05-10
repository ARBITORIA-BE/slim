# ADR-0019: ARBITORIA 3 플랫폼 (GitHub / Vercel / Neon) 정렬

## Status

**Accepted (2026-05-10)** — GATE-M 운영자 승인 완료. 추가 amendments 2건:

> **Amendment A1 (T1 시점 변경)**: ARBITORIA bot 계정 생성 시점 = M24+ 협업자
> 추가 시 → **베타 직전 (페이즈 4 진입, GATE-K 무렵)**으로 앞당김. 운영자
> 명시 결정 — 베타 사용자 노출 시점에 사업체 명의 일관성 확보.
>
> **Amendment A2 (TVA 부록 신설)**: 현재 TVA 미발급 → M1 GitHub org 소유자는
> *김원민 개인 명의*로 우선 생성. TVA 발급 후 별도 mini-task로 org ownership
> transfer (개인 → 사업체). §Appendix A — TVA Post-Issuance Ownership Transfer
> 참조.

git tag 백업: `pre-arbitoria-migration` (Pieter 생성, 2026-05-10) — M1 시작
직전 HEAD. 마이그레이션 실패 시 rollback 진입점.

본 ADR은 **결정 + 마이그레이션 명세** 만 담는다. 코드/설정 변경 0 (마이그레이션
산출물은 git remote URL + Vercel GitHub App 권한 + 선택적 commit author trailer
뿐). 구체적 단계별 명세는 [`docs/arbitoria-migration-runbook.md`](../arbitoria-migration-runbook.md).

## Context

### 진단 사실 (2026-05-10, Pieter 사전 진단)

| 플랫폼 | 이름 = "ARBITORIA" | 실 상태 | 정렬? |
|---|---|---|---|
| **GitHub** | `Arbitoria` | **personal user** (id 261937864, node_id `U_...`) | ❌ org 부재 |
| **Vercel** | `ARBITORIA` | **team** (slim-gamma.vercel.app) | ✅ org/team |
| **Neon** | `ARBITORIA` | **organization** (Slim 프로젝트 production + preview) | ✅ org |

검증 명령:
- `GET /users/Arbitoria` → 200 OK (id 261937864, 개인 user account)
- `GET /orgs/Arbitoria` → 404 Not Found (org 부재)
- `git remote -v` → `origin https://github.com/Arbitoria/slim.git`
- `git config user.name` → `kimwonmin91-4132` (현재) / 이전 commit author = `HanSap`

운영자가 본 GitHub commit author 값 = `HanSap` (이전 git config 추정 — 현재는
`kimwonmin91-4132` 으로 갱신됨, 운영자 ID 일관성 부채).

### 본 ADR이 풀어야 하는 모호함

**3 플랫폼이 같은 이름 "ARBITORIA"를 쓰지만 GitHub만 *personal user*** 다.
운영자가 TVA 발급 후 **ARBITORIA를 *법인적 자산 단위*** 로 운영하려면
(MONETIZATION.md §개인 사업자 + TVA + ADR-0018 §결정 1 "ARBITORIA org만") 정렬
필수. 정렬되지 않은 상태로 페이즈 4 베타 진입 시 다음 위험:

1. **세무 분리 실패** — TVA 발급 후 GitHub 자산이 *개인 user* 명의면 사업
   비용 처리 / 양도 / 협업자 추가 시 마찰. ARBITORIA 사업체와 GitHub 자산
   소유권 불일치.
2. **운영자 인지 부담** — Vercel/Neon은 ARBITORIA org, GitHub만 personal —
   "어디 자산이 어디 있는지" self-check 시 매번 mental mapping (ADR-0018
   §결정 4 매월 1일 점검의 부담 증가).
3. **ADR-0017/0018 헌장 단일화 실패** — ADR-0018 §결정 1 "ARBITORIA org / Slim
   프로젝트" 표현은 *Vercel + Neon* 만 정확히 가리키고 GitHub는 가리키지 않음
   → ADR 본문 표현이 *현 진단 사실*과 달라 헌법적 단일성 손실.

### 운영자 컨텍스트 ([`docs/FOUNDER.md`](../FOUNDER.md))

- 솔로 사이드, 주 10-20시간, 월 €300 ALL-IN cap
- 개인 사업자 등록 ✅ / TVA 대기 ⏳
- ARBITORIA = 운영자 *의도된 사업체 명칭* (이전 자산 arbitoria.com 일관)
- personal user `Arbitoria` 는 운영자가 **org 신설 전 임시 호스팅** 목적으로
  GitHub username 점유 (TVA 발급 + 사업체 명의 자산 단위 정렬 *전*)

### 운영자 다른 자산 컨텍스트 (ADR-0017 §결정 1 인용)

| 자산 | 조치 | 일정 |
|---|---|---|
| Vercel Storage `slim-prod` (hidden-recipe) | Disconnect 완료 | 2026-05-10 |
| Neon `slim-prod` 프로젝트 | 1개월 보관 후 삭제 결정 | 2026-06-10 결정 |
| personal org (`kimwonmin91-4132's projects`) | 1주일 모니터링 | 2026-05-17 |

**본 ADR은 위 자산 정리 *진행 중* 상태에서 GitHub 측을 ADR-0017/0018 패턴으로
확장**. 즉 ARBITORIA 통합 단위에 GitHub org 신설 + Slim repo 이전을 추가해
3 플랫폼 정렬 완성.

### 외부 사실 (검증된 출처 — 2026-05-10)

#### GitHub Free organization

- **비용**: $0/month ([GitHub Pricing](https://github.com/pricing)) — unlimited
  public/private repos + 2,000 CI/CD minutes/month + Dependabot + Issues +
  Projects 포함. Team ($4/user/month) 의 추가 기능 (Codespaces, Repository
  rules, multiple PR reviewers, Pages/Wikis, 3,000 CI/CD min) 은 솔로 사이드
  +1인 (운영자 단일) 시점에 *불필요*.
- **솔로 운영자 적격성**: ✅ Free org가 *유료 협업자 0명* 으로 무한 사용 가능.
  미래 협업자 추가 (시드 모금 후 — ADR-0004 §결정 6 M24+) 시점에 Team 격상
  검토.

#### GitHub repo transfer (personal → org)

[GitHub Docs — Transferring a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository):

- **자동 redirect**: ✅ 자동. `git clone/fetch/push` 도 새 URL 로 redirect.
- **자동 이전 항목**: Issues / Pull requests / Wiki / Stars / Watchers /
  Webhooks / Secrets / Deploy keys / Forks (link 유지). 즉 본 Slim repo의
  GitHub Actions secrets / webhooks 모두 이전 후에도 동작.
- **권한 요구**: 이전자가 *destination org 에서 repo 생성 권한* 필요. 운영자가
  ARBITORIA org owner 면 충족.
- **소요 시간**: UI 1 클릭 + 확인 typing → 약 30초.

#### Vercel GitHub App + repo 이전 후 재연결

[Vercel — Deploying GitHub Projects](https://vercel.com/docs/git/vercel-for-github)
+ [Vercel Community — Repo converted to Organization issue](https://community.vercel.com/t/i-converted-my-repo-to-organization-unable-to-connect-to-it/7240):

- **Vercel GitHub App 권한 부여 필요**: ARBITORIA *org* 에 별도 설치. 현재 App
  은 `Arbitoria` *personal user* 에만 설치됨 → repo 이전 후 Vercel 이 새
  owner 의 repo 를 *못 봄* 상태 가능.
- **재연결 절차**: Vercel project Settings → Git → "Connected Git Repository"
  → Disconnect → "Adjust GitHub App Permissions" → ARBITORIA org 선택 →
  GitHub App 설치 → repo 재선택 → Reconnect.
- **deployments 보존**: 기존 build history / 환경변수 / preview URL 모두 보존.
- **org 권한**: 운영자가 *ARBITORIA org owner* 인 경우 OK. Member 일 때는
  추가 access role 필요.

#### Neon GitHub Integration + repo 이전 영향

[Neon Docs — GitHub Integration](https://neon.com/docs/guides/neon-github-integration)
+ [Neon Docs — Transfer projects](https://neon.com/docs/manage/orgs-project-transfer):

- **현재 Slim 의 Neon 통합 상태**: ADR-0015 §T3 + ADR-0017 §결정 2 — Vercel
  주도 통합 (DATABASE_URL webhook injection). Neon 측 GitHub Integration *별도
  설치 여부 미확인* (운영자 Step-3'b 점검에서 미확인 항목).
- **Neon 측 영향**: Neon 프로젝트는 *Vercel 의 환경변수* 로 주입됨. GitHub
  repo URL 자체와 직접 연결 X. **즉 GitHub repo 이전 시 Neon 측 갱신 행동 없음**
  (Neon GitHub Integration 별도 설치하지 않은 가정).
- **만약 Neon GitHub Integration 별도 설치된 경우**: "프로젝트 with GitHub
  통합은 org 이전 미지원" — Slim 의 Neon *프로젝트* 는 ARBITORIA org 그대로
  유지 (Neon org 이전 안 함). GitHub repo URL 만 갱신 → Neon Console에서 GitHub
  연결 갱신 (있다면).

#### BE 사업자 + TVA 발급 후 GitHub repo 소유권 의미

운영자 사업자등록 ✅ + TVA 대기 ⏳ ([`docs/FOUNDER.md`](../FOUNDER.md) §2):

- **세무적 의미**: 일반적으로 GitHub Free org 자체는 *무료 자산*이라 BE 세무
  당국 (FOD Financien) 시각에서 *자본 자산* 또는 *영업비용* 처리 X. 단 다음
  미래 비용 트리거 발생 시 영업비용 처리 정합성 발생:
  - GitHub Team ($4/user/month × 미래 협업자) 격상 시
  - GitHub Copilot / Advanced Security / 기타 paid feature 추가 시
  - 도메인 (slim.eu/.be/.lu) 또는 paid SaaS 구독 시 *동일 사업체 명의 자산*
    묶음
- **현 시점 결론**: 본 ADR 시점 (2026-05-10) GitHub 자체는 무료 → 세무
  분리 우선순위는 *낮음*. 단 ADR-0018 §결정 1 "ARBITORIA org만" 헌장 정합성 +
  미래 paid feature 진입 시 무마찰 환경 보장이 우선.

## Decision

본 ADR은 **5 개 결정 (옵션 A + T1~T5)** 을 채택한다.

### 옵션 A — GitHub ARBITORIA org 신설 + Slim repo 이전 (채택)

GitHub.com 에 새 org `ARBITORIA` (Free plan) 신설 → `Arbitoria/slim` repo →
`ARBITORIA/slim` org 이전 → Vercel GitHub App 권한 갱신 → 로컬 git remote
URL 갱신.

#### 마이그레이션 단계 (운영자 + Pieter, ~30분)

상세 단계는 [`docs/arbitoria-migration-runbook.md`](../arbitoria-migration-runbook.md)
참조. 요약:

| # | 행위자 | 단계 | 추정 시간 |
|---|---|---|---|
| M1 | 운영자 | GitHub.com → 새 org `ARBITORIA` Free plan 생성 | 5분 |
| M2 | 운영자 | `Arbitoria/slim` repo Settings → Transfer → ARBITORIA org 선택 → 확인 | 2분 |
| M3 | Pieter | 로컬 `git remote set-url origin https://github.com/ARBITORIA/slim.git` + `git fetch` 검증 | 1분 |
| M4 | 운영자 | Vercel project Settings → Git → ARBITORIA org GitHub App 설치 + repo 재연결 | 5분 |
| M5 | 운영자 | Neon Console → ARBITORIA org Slim 프로젝트 → GitHub Integration 갱신 (있을 시) | 3분 |
| M6 | 운영자 + Pieter | git config user.name/email 결정 (T1) | 2분 |
| M7 | Pieter | 임시 PR 1회 (docs 변경) → Vercel preview build + GitHub Actions CI 양쪽 ✅ 검증 | 5분 |
| M8 | Pieter | ADR-0017/0018 §References 본 ADR 인용 추가 (본문 수정 X) | 3분 |

**총 ~30분** (운영자 ~17분 + Pieter ~12분 + 양측 협업 ~1분).

#### 채택 근거

1. **3 플랫폼 일관**: ARBITORIA = GitHub org + Vercel team + Neon org → ADR-0018
   §결정 1 헌장과 *진단 사실* 정합. self-check 부담 0.
2. **TVA 발급 후 무마찰**: 사업체 명의 자산 단위가 GitHub 까지 일관 → 미래
   GitHub paid feature / 협업자 추가 / B2B 영업 (Slim Insights M24+) 시 사업
   계좌 결제 + 영업비용 처리 자연스러움.
3. **미래 협업자 깔끔**: org permissions 모델은 personal user 보다 owner /
   member / outside collaborator 분리 명확. 시드 모금 후 (ADR-0004 §결정 6
   M24+) 풀타임 전환 + 1-2명 채용 시 무마찰.
4. **마이그레이션 비용 0**: GitHub Free org $0 + redirect 자동 + Vercel/Neon
   재연결 ~10분. 운영자 시간 30분 1회로 영구 정렬.
5. **ADR-0017/0018 보강**: 이전 ADR 의 ARBITORIA 가정을 *진단 사실*로 변환
   → 사고 재발 시 *어떤 owner / 어떤 repo* 를 검토할지 모호함 0.

### 거부된 옵션

#### 옵션 B — 모두 personal 로 통일 (역방향, 거부)

Vercel ARBITORIA team → personal 강등 + Neon ARBITORIA org → personal 강등 +
GitHub `Arbitoria/slim` 그대로.

- 장점: GitHub 변경 0
- 단점:
  - **Neon data 이전 위험** — production DB 마이그레이션은 ADR-0017
    silent-darkness 사고 패턴 *재발 위험 高*. production 6 tables 보존 +
    seed data 보존 부담.
  - Vercel team → personal 강등은 Hobby Free 격하 가능하나 환경변수 4×2 재
    등록 + slim-gamma.vercel.app URL 변경 가능 → ADR-0015 Step-3-prime 점검
    재실행.
  - **법인 분리 가치 손실** — TVA 발급 후 ARBITORIA 사업체 명의 자산이 *모두*
    personal 강등됨 → MONETIZATION.md §개인 사업자 정합 손실.
- **거부 사유**: production DB 손상 위험 + 법인 분리 가치 손실 > GitHub
  변경 절감.

#### 옵션 C — ARBITORIA = GitHub user 유지 + 다른 곳 *renaming* (거부)

Vercel team / Neon org 이름을 ARBITORIA → 다른 이름으로 rename.

- 장점: 거의 의미 없음
- 단점: ARBITORIA 는 운영자 *의도된 사업체 명칭* (이전 자산 arbitoria.com
  일관). rename 시 사업 정체성 손실 + Neon org rename 은 storage URL 변경 가능
  (data 손상 0 보장 안 됨).
- **거부 사유**: 사업 정체성 손실 > 정렬 절감.

#### 옵션 D — 다른 GitHub username 사용 (예: ARBITORIA-OFFICIAL org / slim-be repo)

우회 — 근본 정렬 안 됨.

- 단점: ARBITORIA 의 일관성을 깨뜨려 ADR-0018 §결정 1 헌장 본문이 *2 가지
  이름* 을 동시에 가리켜야 함 (ARBITORIA + ARBITORIA-OFFICIAL).
- **거부 사유**: 헌장 명확성 손실 > GitHub username 자유도 절감.

### T1 — git commit author 정책 = 운영자 개인 (옵션 A 채택)

git config user.name = 운영자 본인, user.email = `kim.wonmin91@gmail.com`
유지.

| 옵션 | 설명 | 장점 | 단점 |
|---|---|---|---|
| **A (채택)** | 운영자 개인 (`kim.wonmin91@gmail.com`) — 현 상태 | 단순 + 솔로 사이드 일관 | 사업체 명의 commit 부재 |
| B | ARBITORIA bot 계정 (별도 GitHub bot 생성, PAT 발급) | 사업체 명의 commit 일관 | 솔로에서 bot 운영 부담 + 토큰 회전 비용 |
| C | A + co-author trailer (`Co-authored-by: ARBITORIA <noreply@arbitoria.be>`) | 사업체 명의 메타 + 운영자 일관 | trailer 누락 시 신뢰 손실 / bot 이메일 운영 부담 |

**채택 근거**: 솔로 사이드 (운영자 단일 commit author). bot 계정은 협업자
추가 시점 (M24+) 까지 무가치. co-author trailer 는 매 commit 운영자 의도
표현 부담 高 + 자동화 hook 추가 시 PLAN 1.5.7 부채 동형 (Bash 보안 hook 후속).

**~~미래 회귀 트리거~~** (Amendment A1, 2026-05-10): ~~M24+~~ → **베타 직전
(GATE-K 무렵, 페이즈 4 진입 시점)** 으로 앞당김. 운영자 명시 결정 — 베타 사용자
노출 시점에 사업체 명의 commit 일관성 확보. ARBITORIA bot 계정 생성 + 옵션 B
또는 C 재평가는 페이즈 4 진입 ADR (별도 신설) 트리거.

### T2 — 마이그레이션 시점 = TVA 발급 *전* + 페이즈 2 진입 *전* (즉시 실행 채택)

운영자 GATE-M 통과 즉시 실행. 페이즈 2 (사용자 입력 플로우) 진입 *전* 완료.

| 옵션 | 설명 | 장점 | 단점 |
|---|---|---|---|
| **A (채택)** | 즉시 (GATE-M 통과 시점) | ADR-0017/0018 정합 + 페이즈 2 진입 무마찰 | 운영자 30분 부담 1회 |
| B | 페이즈 2 진입 후 | 페이즈 2 작업 우선 | ADR-0018 §결정 1 가정과 진단 사실 불일치 *지속* |
| C | TVA 발급 후 | 사업체 명의 자산 단위 동시 완성 | TVA 발급 시점 미정 (FOD 처리 기간 의존) |

**채택 근거**:
- ARBITORIA 자산 정렬은 페이즈 2 작업 (사용자 입력 플로우) 에 *직접 영향
  없음*. 단 **GATE-K** (페이즈 4 베타 진입 전 완전 정렬 게이트, ADR-0018
  §결정 1 헌장 단일화) 에서 베타 진입 *전* 완전 정렬 필수 — 미루면 페이즈 4
  진입 직전 운영자 압박 시점에 마이그레이션.
- 즉시 실행 시 운영자 30분 1회 + Pieter 검증 1회 → ADR-0017/0018 §References
  보강 후 *영구 정렬*.
- TVA 발급 시점 무관 (GitHub Free org 는 사업자등록 입증 미요구 — 운영자
  개인 GitHub 계정으로 owner 자격).

### T3 — 옛 personal user `Arbitoria` 처리 = 그대로 남김 (옵션 A 채택)

새 org ARBITORIA 생성 후 personal username `Arbitoria` 는 *변경 X*.

| 옵션 | 설명 | 장점 | 단점 |
|---|---|---|---|
| **A (채택)** | 그대로 남김 (운영자 개인 자산 별개) | 충돌 없음 + 옛 자산 (arbitoria.com 토이) 보존 | 운영자 인지 부담 (org vs user 동일 이름) |
| B | personal username rename (예: `kimwonmin` 또는 `hansap`) | username 충돌 0 + 운영자 ID 일관 | rename 후 옛 PR/Issue link 영향 (자동 redirect 있으나 운영자 학습 부담) |

**채택 근거**: GitHub username 과 org name 은 *namespace 분리* (URL `/Arbitoria`
는 user, `/ARBITORIA` 는 org — 단 GitHub 는 case-insensitive 비교). **즉
GitHub 정책상 동일 case-insensitive 이름의 user + org 동시 점유 불가** →
**채택 시 재검증 필수** (ADR-0019 §검증 1).

**대안 분기**: GitHub 가 동일 이름 거부 시 (가능성 高):
- 분기 A: org 이름을 `ARBITORIA-BE` 또는 `Arbitoria-Org` 로 (옵션 D 회귀).
- 분기 B: personal username 을 `kimwonmin` 으로 rename + 새 org `Arbitoria`
  생성 (옵션 T3.B).

**현 권장**: GATE-M 시점 운영자가 GitHub UI 에서 *org name `ARBITORIA` 가
허용되는지 직접 확인* (M1 단계의 첫 5분). 거부 시 분기 B (personal rename
+ org `Arbitoria`) 채택.

### T4 — 비용 영향 = 0 (현재) + 미래 트리거 명시

본 ADR 시점 추가 비용 0:
- GitHub Free org: $0/month
- Vercel Team Free: $0 (현재 ARBITORIA team Hobby) — 단 미래 협업자 추가 시
  Pro $20/user/month
- Neon Free: $0 — 단 branch 한도 ~10 (ADR-0018 §회귀 트리거 #4)

**미래 비용 트리거**:
1. **Vercel collaborator 추가** (M24+) — Pro $20/user/month → ADR-0004 §결정
   2 격상 트리거 동형 평가
2. **Neon Pro 격상** (M10~M14 도달 시점, MONETIZATION.md §1 인프라 한계) —
   Launch $19/month
3. **GitHub Team** (협업자 추가 시) — $4/user/month + Codespaces / Repository
   rules 가치 평가

본 ADR 자체 추가 비용 0 → ADR-0004 §결정 2 €300 cap 내 잔여 마진 100% 보존.

### T5 — ADR-0017/0018 정정 인용 정책 (수정 X, 인용 추가만)

본 ADR Accepted 후 다음 위치에 *인용* 추가 (본문 수정 X — 기록의 헌법적
보존 P5 정합):

#### ADR-0017 §References (본 ADR 추가)

```markdown
- [ADR-0019](0019-arbitoria-three-platform-alignment.md) — 본 사건의 후속 정렬
  (GitHub org 신설 + Slim repo 이전). ADR-0017 §결정 1 "ARBITORIA org" 표현은
  *현 진단 시점* (2026-05-10 GitHub user 상태) → ADR-0019 GATE-M 통과 후
  GitHub org 신설로 정합화.
```

#### ADR-0018 §References (본 ADR 추가)

```markdown
- [ADR-0019](0019-arbitoria-three-platform-alignment.md) — 본 ADR §결정 1
  "ARBITORIA org / Slim 프로젝트" 헌장의 GitHub 적용 (org 신설 + Slim repo
  이전). ADR-0019 가 본 ADR §결정 1을 *완성*하는 헌장.
```

#### ADR-0018 §결정 6 (신규 환경 추가 절차) — 인용 1줄 추가

본문 변경 X. References 섹션 또는 §결정 6 끝에 인용 1줄:

```markdown
> 본 ADR §결정 6 (4단계 절차) 의 *동형 패턴* — GitHub org 추가 + repo 이전
> 절차는 ADR-0019 §Migration Plan 참조.
```

**근거**: ADR 본문 *수정 금지* 헌법 (P5 — 결정은 ADR로). ADR-0017 sentinel
("ARBITORIA org") 은 *작성 시점 (2026-05-10) 가정* — 본 ADR 이 *현 진단*
+ *후속 정렬* 을 명시해 헌장 단일성 보존.

## Validation

본 ADR §검증은 PLAN GATE-M (운영자 승인) + 마이그레이션 단계 8 개의 1:1
매핑.

### 검증 1 — GitHub org `ARBITORIA` 신설 가능성 사전 확인

**현재 상태**: ⏳ 미검증 (T3 분기 결정 입력).

**검증 단계**:
1. 운영자가 GitHub.com → Settings → Organizations → New organization
2. 이름 `ARBITORIA` 입력 → 가용성 표시 확인
   - ✅ 가용 → §Migration Plan M1 진행 (옵션 A)
   - ❌ 충돌 (case-insensitive 매칭으로 personal user `Arbitoria` 와 충돌) →
     T3 §대안 분기 B 또는 분기 A 채택 후 ADR Amendment

**Pass 조건**: 운영자가 사용 가능한 org 이름 확정 (가능성 高: `ARBITORIA-BE`
또는 personal rename 후 `Arbitoria`).

### 검증 2 — Slim repo 이전 + redirect 동작

**검증 단계**:
1. 운영자 M2 완료 (GitHub UI Transfer)
2. Pieter `git fetch origin` → 0 에러 (redirect 자동 동작)
3. Pieter 임시 commit + push → 새 org repo 에 반영 확인
4. 옛 URL `https://github.com/Arbitoria/slim` 브라우저 접속 → 새 URL 자동
   redirect 확인

**Pass 조건**: git operations + 브라우저 접근 모두 redirect 정상.

### 검증 3 — Vercel + GitHub App 재연결

**검증 단계**:
1. 운영자 M4 완료 (Vercel project Settings → Git → 재연결)
2. Pieter M7 임시 PR 생성 → push
3. Vercel preview build 자동 트리거 + ✅ 결과 확인
4. PR comment 에 Vercel bot preview URL + GitHub Actions Checks ✅ 동시 노출
5. 환경변수 4 × 2 (ADR-0015 §T3) 보존 확인 (Vercel Settings → Environment
   Variables → 8 항목 그대로)

**Pass 조건**: Vercel preview URL 200 응답 + 환경변수 8 항목 보존.

### 검증 4 — GitHub Actions CI 보존

**검증 단계**:
1. Pieter M7 PR push 시 GitHub Actions ci.yml 자동 트리거 확인
2. 4단 게이트 (typecheck → test → harness:plan → harness:data) ✅ 결과
3. main 브랜치 보호 규칙 (D.1.c) 활성 상태 보존 확인 — 운영자 GitHub UI
   Settings → Branches → main 점검
4. secrets / webhooks 자동 이전 검증 (GitHub docs §What Transfers Automatically)

**Pass 조건**: ci.yml ✅ + main 보호 규칙 활성 보존.

### 검증 5 — Neon 측 영향 0 (또는 경미한 갱신)

**검증 단계**:
1. 운영자 M5 — Neon Console → ARBITORIA org Slim 프로젝트 → Settings → GitHub
   Integration 점검
   - Integration 미설치 → 추가 행동 0 (Neon org / 프로젝트 그대로)
   - Integration 설치됨 → repo URL 갱신 (`Arbitoria/slim` → `ARBITORIA/slim`)
2. `pnpm verify:db` 통과 확인 (production + preview endpoint allowlist 그대로
   — ADR-0018 §결정 3)
3. Vercel build 환경변수 webhook (DATABASE_URL injection) 지속 동작 확인

**Pass 조건**: `pnpm verify:db` 통과 + Vercel build DATABASE_URL 정상 주입.

### 검증 6 — git remote URL 갱신 + commit author 보존 (T1)

**검증 단계**:
1. Pieter M3 — `git remote set-url origin https://github.com/<신org>/slim.git`
2. `git remote -v` → 새 URL 확인
3. M7 임시 commit author = `kim.wonmin91-4132` <`kim.wonmin91@gmail.com`> 보존
   확인 (T1 옵션 A)

**Pass 조건**: git remote 새 URL + commit author 운영자 개인 보존.

### 검증 7 — ADR-0017/0018 References 보강 (T5)

**검증 단계**:
1. M8 — Pieter 가 ADR-0017 + ADR-0018 §References 에 본 ADR 인용 추가 (본문
   수정 X)
2. ADR-0019 §References 에 ADR-0017/0018 양방향 링크 확인
3. `docs/adr/INDEX.md` 본 ADR 행 추가 + 요약 갱신

**Pass 조건**: 양방향 링크 + INDEX.md 갱신.

### 검증 8 — GATE-M 운영자 승인

운영자 (Kim Wonmin) 가 본 ADR 을 검토하여 다음 5 결정 모두 승인:
- 옵션 A 채택 (GitHub ARBITORIA org 신설 + repo 이전)
- T1 commit author = 운영자 개인
- T2 마이그레이션 시점 = 즉시 (GATE-M 통과 시)
- T3 personal user `Arbitoria` 처리 = 그대로 (또는 분기 결정)
- T4 비용 영향 = 0 (미래 트리거 인지)
- T5 ADR-0017/0018 정정 인용 정책

**GATE-M 통과** = 본 ADR Status `Proposed` → `Accepted` 격상 + Migration M1~M8
진행.

## 회귀 트리거 (Trigger for revisit)

다음 중 하나가 발견되면 ADR-0019 를 재검토한다:

1. **GitHub org `ARBITORIA` 이름 충돌** (검증 1 ❌) — T3 분기 A 또는 분기 B
   채택 + ADR Amendment.
2. **Vercel 재연결 후 build 실패 1건 이상** (검증 3 ❌) — Vercel GitHub App
   권한 재점검 + ADR-0015 §Step-3-prime 동형 보강 절차 신설.
3. **Neon GitHub Integration 별도 설치 발견** (검증 5 분기 1) — ADR-0018
   §결정 6 신규 환경 추가 절차에 *Integration 갱신* 단계 추가 검토.
4. **운영자 협업자 추가** (M24+ 시드 모금 후) — T1 commit author 정책 재평가
   (옵션 B bot 계정 또는 옵션 C trailer) + GitHub Team 격상 비용 트리거 (T4).
5. **Vercel bandwidth 80GB/월 도달** (MONETIZATION.md §1 도달 시점 M12~M16)
   — Vercel Pro 격상 시점에 ARBITORIA team 명의 결제 정합성 확인.
6. **TVA 발급 후 사업 계좌 개설 1주 내 정합성 점검** — 모든 ARBITORIA 자산
   (GitHub + Vercel + Neon + 도메인) 결제 수단 / 청구지 사업 계좌 일관 점검.
7. **personal user `Arbitoria` 가 옛 commit author `HanSap` 식별자로 검색
   가능성** — 운영자 이력 prirvacy 자가 점검 (FOUNDER.md §1 — `HanSap` 은
   운영자 옛 git config 추정값, 현재 `kimwonmin91-4132` 갱신).

## 다른 ADR 과의 관계

- **ADR-0017** (DB 미스매치 사건 종결): 본 ADR §References 인용 (T5). ADR-0017
  §결정 1 "ARBITORIA org" 표현의 *현 진단* + *후속 정렬* 명시.
- **ADR-0018** (Neon 멀티 org 정책): 본 ADR §References 양방향 인용 (T5).
  ADR-0018 §결정 1 "ARBITORIA org / Slim 프로젝트" 헌장의 GitHub 적용 *완성*.
- **ADR-0015** (Vercel 통합): 본 ADR §검증 3 + Migration M4 가 ADR-0015
  §Step-3-prime 의 *후속 점검* (GitHub App 재연결 시 환경변수 보존 검증).
- **ADR-0004** (€300 cap): 본 ADR §T4 비용 영향 0 → ADR-0004 §결정 2 cap
  내 잔여 마진 100% 보존.
- **ADR-0011** (`/data-sources` RSC + ISR): 본 ADR 검증 3 통과 시 production
  endpoint 노출 결정 시점 영향 0 (Vercel project URL 그대로 — slim-gamma
  유지).

## 영향

### PLAN.md 갱신

본 ADR Accepted 후 verifier 책임:

- **§1.5.5** 본문에 인용 1 줄 추가:
  ```markdown
  > 사고 종결 = ADR-0017 + 정책 = ADR-0018 + 3 플랫폼 정렬 = ADR-0019.
  ```
- **§D.1 + §1.5.x 트랙**: 변경 0 (본 ADR 은 운영 안전 부채 트랙 *외부*, 인프라
  정렬 단발 작업).
- **작업 추적 메타 표**: 변동 0 (본 ADR 은 PLAN 항목 신설 X — 운영자 + Pieter
  단발 마이그레이션 30분).

**대안 — PLAN §1.5.x 신설 검토**:

| 옵션 | 설명 | 권장? |
|---|---|---|
| **A** | PLAN 변동 0 (본 ADR 단발 마이그레이션) | ✅ 권장 — 본 ADR 자체가 추적 단위 |
| B | §1.5.8 신설 — "ARBITORIA 3 플랫폼 정렬 마이그레이션" | △ — runbook + ADR 이중 추적 부담 |
| C | §D 트랙 (페이즈 0.5 운영 부채) 에 D.3 신설 | △ — 페이즈 0.5 마감된 후 트랙 재오픈 부담 |

**채택**: 옵션 A — PLAN 변동 0. 본 ADR + runbook 양 문서가 단발 작업의
충분한 추적 단위. M1~M8 완료 후 본 ADR Status → Accepted 마킹으로 작업 종결.

### `docs/adr/INDEX.md` 갱신

verifier 책임 — 본 ADR 행 추가:

```markdown
| [ADR-0019](0019-arbitoria-three-platform-alignment.md) | ARBITORIA 3 플랫폼 (GitHub / Vercel / Neon) 정렬 | Proposed | 2026-05-10 |
```

+ §설명 섹션 ADR-0019 항목 신설.

### `docs/arbitoria-migration-runbook.md` 신설

본 ADR Migration M1~M8 의 단계별 명세 + 검증 명령 + 롤백 시나리오.
[`docs/arbitoria-migration-runbook.md`](../arbitoria-migration-runbook.md)
참조.

### MONETIZATION.md 영향 — 변동 0

- 비용 cap €300/월 영향 0 (T4)
- TVA 발급 후 사업 계좌 자산 정합성 보강 — 본 ADR 회귀 트리거 #6 (재검토)

### 외부 의존성 추가 — 0건

- 새 npm 패키지 0
- GATE-C (ADR-0011) 통과
- 외부 SaaS 추가 0 (GitHub Free + 기존 Vercel + 기존 Neon)

### GATE 정의 — 본 ADR + GATE-K 직렬 vs 병렬

본 ADR 마이그레이션은 **GATE-J (페이즈 2 진입) 와 *병렬***. 페이즈 2 작업
(사용자 입력 플로우) 에 직접 영향 없음.

단 **GATE-K (페이즈 4 베타 진입 전 완전 정렬) 와 *직렬***. 페이즈 4 진입 *전*
완전 정렬 필수 — 베타 사용자 신호 + 어트리뷰션 데이터 수집 시점에 ARBITORIA
사업체 명의 자산 단위 정렬 *필수* (TVA 발급 후 사업 계좌 정합성).

| GATE | 본 ADR 관계 | 직렬 / 병렬 |
|---|---|---|
| GATE-J (페이즈 2 진입) | 영향 0 | 병렬 |
| GATE-K (페이즈 4 베타 진입) | 정렬 필수 (ADR-0018 §결정 1 헌장) | **직렬** |
| GATE-L (M16 평가 게이트) | 정렬 필수 (TVA 발급 정합성) | **직렬** |
| GATE-M (본 ADR 운영자 승인) | 본 ADR 자체 | 본 ADR 진입 게이트 |

## References

### 헌법 + 운영자 컨텍스트

- [`CLAUDE.md`](../../CLAUDE.md) — §3 P5 (결정은 ADR로), §8 #6 (Bash 보안 룰)
- [`docs/FOUNDER.md`](../FOUNDER.md) — §1 운영자 (ARBITORIA = 의도된 사업체
  명칭), §2 사업 단계 (TVA 대기)
- [`MONETIZATION.md`](../../MONETIZATION.md) — §개인 사업자 + TVA, §1 비용
  cap €300/월

### 관련 ADR

- [ADR-0004](0004-monetization-solo-side-rebalance.md) — §결정 2 €300 cap (T4
  비용 영향 0)
- [ADR-0015](0015-vercel-integration-and-d1-closure.md) — §Step-3-prime
  (Vercel GitHub App 재연결의 동형 패턴)
- [ADR-0017](0017-db-mismatch-incident-postmortem.md) — DB 미스매치 사건 종결
  (본 ADR T5 References 보강 대상)
- [ADR-0018](0018-neon-multi-org-policy.md) — Neon 멀티 org 정책 (본 ADR §결정
  1 헌장의 GitHub 확장)

### 사건 산출물

- [`docs/arbitoria-migration-runbook.md`](../arbitoria-migration-runbook.md)
  — 본 ADR Migration M1~M8 단계별 명세

### 외부 사실 (검증된 출처 — 2026-05-10)

- [GitHub Pricing — Free organization $0/month](https://github.com/pricing) —
  unlimited public/private repos + 2,000 CI/CD min/month
- [GitHub Docs — Transferring a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository)
  — 자동 redirect + Issues/PR/Stars/Webhooks 자동 이전
- [GitHub Docs — Creating a new organization from scratch](https://docs.github.com/articles/creating-a-new-organization-from-scratch)
  — 운영자 단계별 가이드
- [GitHub Community — Repo conversion to organization](https://github.com/orgs/community/discussions/192588)
  — personal → org 이전 후 third-party 통합 (Vercel/Netlify) 재연결 필요
- [Vercel Docs — Deploying GitHub Projects](https://vercel.com/docs/git/vercel-for-github)
  — GitHub App 권한 (Org Members + Repository Administration/Contents/Webhooks)
- [Vercel Community — Repo converted to Organization](https://community.vercel.com/t/i-converted-my-repo-to-organization-unable-to-connect-to-it/7240)
  — repo 이전 후 Vercel project Settings → Git 재연결 절차
- [Neon Docs — GitHub Integration](https://neon.com/docs/guides/neon-github-integration)
  — Vercel-managed integration vs Neon-managed integration 분기
- [Neon Docs — Transfer projects](https://neon.com/docs/manage/orgs-project-transfer)
  — 통합 설치된 프로젝트는 org 이전 미지원 (본 ADR 은 Neon 프로젝트 *그대로*
  유지 — GitHub repo URL 만 갱신)

---

## Appendix A — TVA Post-Issuance Ownership Transfer (mini-task, Amendment A2)

### 컨텍스트

본 ADR §M1 시점 (2026-05-10): TVA 미발급. 따라서 GitHub org `ARBITORIA`
소유자는 *김원민 개인 명의*로 우선 생성. 사업체 명의 자산 분리는 TVA 발급
시점에 후속 mini-task로 처리.

### 발동 조건

- TVA 발급 완료 (FOD 처리 기간 의존, 운영자 GATE 신호)
- 비즈니스 은행 계좌 개설 완료 (`docs/FOUNDER.md` §사업 단계 §M1 다음 단계)
- 운영자 명시 결정: "ARBITORIA org를 사업체 명의로 격상"

### Mini-task 단계 (~15분)

**MA1**. GitHub org Settings → Billing → Owners 섹션에서 *사업체 명의 user/email
추가* (운영자가 사업자 등록 후 발급된 사업용 이메일을 GitHub 신규 계정으로
가입 + organization Owner 권한 부여)

**MA2**. 기존 owner (김원민 개인) 권한 *Member로 강등* (소유권 단일화)

**MA3**. GitHub org Settings → General → "Display name" 갱신 (예: "Arbitoria
SRL" or "ARBITORIA NV/SA" — TVA 형태에 맞춤)

**MA4**. Vercel Settings → Members → ARBITORIA team owner 갱신 (사업체 명의
계정으로)

**MA5**. Neon Settings → Organization → Owner transfer (사업체 명의 계정으로)

**MA6**. 회계 등록부 갱신: 본 ADR Appendix A에 *MA1~MA5 완료 시점 + 사업체
명의 계정 ID* 명시 (Pieter가 갱신, 사업자 등록 번호 + TVA 번호는 별도 보안
저장소 — 채팅 노출 X, ADR-0018 §결정 7 정합).

### 검증

- GitHub: Settings → People → owner 1명 (사업체 명의)
- Vercel: Settings → Members → role: Owner (사업체 명의)
- Neon: Settings → Organization → owner: 사업체 명의

### 회귀 트리거

- TVA 번호 채팅 노출 발견 시 → ADR-0018 §결정 7 위반 → scribe 운영 노트 +
  보안 회전
- 사업체 명의 계정의 비번/2FA 설정 누락 → 보안 사고 가능 (Vercel + Neon owner
  동시 제어 권한)

### Status

본 Appendix A는 **Pending** (TVA 발급 시점까지) — Pieter 또는 운영자가 발급
완료 신호 시점에 *Accepted*로 격상 + MA1~MA6 단계 실행.
