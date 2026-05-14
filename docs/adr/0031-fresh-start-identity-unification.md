# ADR-0031: Fresh-start 완성 — 정체성 통합 audit + branch protection 보류 + history 인프라 정보 노출 인지

## Status

**Proposed** (2026-05-14, Pieter 세션 작성 — 운영자 review 대기). Phase 4 (도구 설치 ✅) + Phase 5 (mailmap + 본 ADR draft) 산출물. Phase 7 (실 rewrite) + Phase 9 (force push) 완료 + 운영자 confirm 시 **Accepted** 전이.

> ADR 번호 메모: `docs/adr/` 현황 = 0001~0011, 0013, 0015~0023, 0025~0030 사용. **0012·0014 = 갭(끼워넣기 금지)**. **0024 = "가칭" 예약** (Neon-side Vercel Integration, GATE-K 트리거, 파일 미작성). 따라서 본 ADR 은 다음 빈 번호 **0031**. (작성 시점 `docs/adr/` 파일 목록 재확인.)

## Context

### 발견 경위 (2026-05-14)

**도화선**: D.1.c (main 브랜치 보호 룰 활성) 검증을 위한 음성 PR #1 (`test/build-gate-negative → main`, 의도적 typecheck 깨짐) 진행 중, **Vercel access control 이 git commit author 의 권한을 근거로 preview deployment 를 차단**. 이를 추적하다 운영자(GitHub username: `Arbitoria`)가 과거 다른 정체성과의 단절 의도로 ARBITORIA-BE organization 을 새로 만들고 `ARBITORIA-BE/slim` repo 로 fresh start 를 시도했음에도, 코드 이전 과정에서 **git history 가 함께 따라와 본래 의도가 침해된 상태로 4일 이상 진행**되어 왔음이 드러남. 동시에 (a) GitHub Free org plan 의 ruleset enforcement 제약, (b) git author 의 옛 이메일 `kim.wonmin91@gmail.com` 평문 노출 등 인접 사안 2건이 같은 음성 PR 검증 흐름에서 추가 확인됨.

본 ADR 은 한 음성 PR 검증에서 *동시에* 드러난 세 사안을 **단일 통합 audit** 으로 정리한다 (Option α — 분리 ADR-0031/0032/0033 + 모자 ADR β 는 §Alternatives §A1 에서 거부).

### 진단 cross-check (Phase 0, 본 세션 직접 측정)

```text
$ git log --all --format='%an <%ae>' | sort | uniq -c | sort -rn
    100 kimwonmin91-4132 <kim.wonmin91@gmail.com>                              # 본인 옛 git config (gmail 평문)
     27 HanSap <277682104+HanSap-shovel@users.noreply.github.com>              # 외부 정체성, fresh-start 침해 원인
      1 bootstrap <bootstrap@slim.eu>                                          # 시스템 자동 생성 (Drizzle 등)
```

- 전체 reachable commit count: **128** (`git rev-list --all --count`).
- `--all` 분포 = main HEAD 단독 분포 = 동일 → **다른 ref(태그/리모트 추적/dangling)에 다른 정체성 commit 0건** → mailmap 단순화 가능.
- `origin/main..main` ahead = **74 commits** (push 안 된 로컬 작업: ADR-0023~0030 + 페이즈 3.5~4.9 분해 + D.5/D.6 + harness:perf + BetaEstimatedBanner 등).
- 로컬 main HEAD: `e2c6266` (`docs(adr-0030): D.6 compare-flow ChunkLoadError 회고`).
- `origin/main` HEAD: `737b8e6`.
- 사전 안전망 태그: `refs/tags/pre-arbitoria-migration` → `7e03449` (운영자가 ARBITORIA-BE 마이그레이션 *전*에 찍어둔 태그 — filter-repo 시 함께 rewrite 대상).

### 운영자 GitHub 보안 설정 (Phase 0 기준)

- ✅ "Keep my email addresses private" → **ON**.
- ✅ "Block command line pushes that expose my email" → **ON** (향후 평문 gmail 박힘 차단).
- ⚠️ Backup verified email 미등록 — Phase 13 권장 (계정 복구 안전망).

### 이미 완료된 정책 문서

- ✅ `ARBITORIA-BE/slim` repo 의 ruleset `protect-main` 저장 완료. Free org plan 제약으로 *enforce 안 됨* (현 시점 D.1.c 미충족 사유와 동일). Team plan ($4/user/month) 업그레이드 시 자동 작동하는 **정책 문서로 보존**. TVA 발급 → Team 전환 트리거 (founder_situation 메모 §GitHub 플랜 — 2026-05-14 결정).

### Phase 1~4 산출물 (본 ADR 작성 시점까지 완료)

| Phase | 산출 | 검증 |
|---|---|---|
| 1 | local `git config user.name=Arbitoria` / `user.email=261937864+Arbitoria@users.noreply.github.com` | `git config --get` 2 줄 일치 |
| 2 | untracked 잔재 2 파일 (`h` less help / `-files \| Select-String "env"` git log dump) trivial 검증 후 삭제 | working tree clean, untracked=0 |
| 3 | `C:\Users\kimwo\slim-backup\` 에 bundle (1,174,537 bytes, sha256 `350e9f392f7f95f8871c1f9ddc9555e406317fd805df87fd71990c561aa32c7b`) + mirror clone (`slim-mirror-2026-05-14.git`, fsck dangling 7건 *정상*, commit count 128 일치) | `git bundle verify` is okay / mirror `rev-list --all --count` = 128 |
| 4 | `git-filter-repo 2.47.0` pip 설치 (`python -m git_filter_repo` 형식 호출, PATH 미추가 환경 우회) + `.git/mailmap.txt` 작성 (운영자 명세 그대로, bootstrap 보존) | `python -m git_filter_repo --version` = `a40bce548d2c` |

## Decision

**3개 결정 (T1~T3) — 단일 통합 ADR (α).**

### T1. 정체성 통합 audit — HanSap + kimwonmin91-4132 일소 (127 commit author 통합, bootstrap 1 보존)

- 도구: **`git-filter-repo` 2.47.0** (pip 설치, `python -m git_filter_repo` 호출 — Windows PATH 우회).
- mailmap: `.git/mailmap.txt` (일회용, .git/ 내부라 git index 진입 안 됨).
- 매핑:
  ```
  Arbitoria <261937864+Arbitoria@users.noreply.github.com> <277682104+HanSap-shovel@users.noreply.github.com>
  Arbitoria <261937864+Arbitoria@users.noreply.github.com> <kim.wonmin91@gmail.com>
  # bootstrap <bootstrap@slim.eu> — 그대로 둠 (Drizzle/도구 흔적 보존 — 시스템 자동 생성은 정체성 단절의 *외부* 아님)
  ```
- 실행: `python -m git_filter_repo --mailmap .git/mailmap.txt --force` (working tree 비어 있고 백업 2중 완료라 `--force` 안전).
- 영향:
  - 모든 128 commit 의 hash 재발급 (author/committer rewrite → tree/parent hash chain 회귀).
  - 태그 `pre-arbitoria-migration` (`7e03449`) 도 함께 rewrite. 새 hash 는 Phase 8 검증 후 본 ADR §Verification 에 기록.
  - 로컬 main 만 영향 → Phase 9 (force push) 로 origin/main 동기화.
- **거부**: `git filter-branch` — git 공식 deprecated. 느림 + edge case (Windows 줄바꿈, signed commit, replace refs). §Alternatives §A2.
- **거부**: bootstrap 도 통합 — Drizzle initial migration 같은 *시스템 자동 생성* commit 은 본인 정체성 아님. 도구 흔적 보존이 정직성에 더 부합 (P3).

### T2. Branch protection enforcement 보류 — Free org plan 제약 인지 + Team $4 전환 트리거 보존

- `ARBITORIA-BE/slim` ruleset `protect-main` 의 enforcement 는 Free org plan 에서 *작동하지 않음* (확인됨). ruleset 정의는 보존 → Team plan 전환 시 자동 작동.
- PLAN §D.1.c 는 본 ADR 시점에 [ ] 유지 + 차단 사유 1줄 기록 (Free 플랜 제약 → TVA 후 Team 전환 트리거).
- founder_situation 메모(2026-05-14)에 GitHub Team 전환 트리거 = PLAN §D.1.c 매핑.
- 음성 PR #1 은 close + 브랜치 삭제 완료 (origin/main rewrite 후 동일한 음성 검증은 Team 전환 후 재실행 — Phase 12 옵션).
- **거부**: Free 플랜 우회를 위한 Personal repo 로 이전 — fresh-start 의 정 반대 방향. Personal namespace 는 운영자 정체성과 결합도 높음.
- **거부**: 다른 ruleset/required check 도구 (Husky / pre-receive 서버 hook) 로 대체 — main 보호의 *권위 있는 신호* 는 GitHub UI 의 merge 차단. 우회 도구로 대체 시 정직성 약화 (P3).

### T3. Git history 인프라 정보 노출 인지 + 신규 commit 규칙

- 옛 author `kim.wonmin91@gmail.com` 평문 노출은 Phase 7 rewrite 로 *history 에서 제거*. 단 **bundle/mirror 백업 2 부와 외부 클론(예: Vercel build cache, GitHub repo fork) 에는 그대로 잔존** — 완전 제거는 불가능.
- 잔존 위험 수용:
  - 백업 2 부는 운영자 로컬 디스크 한정 → 외부 노출 0 (Phase 13 backup verified email 등록 후 백업 자체도 정리 가능).
  - GitHub 외부 fork 0 확인 (`ARBITORIA-BE/slim` 비공개 + 협업자 0).
  - Vercel build cache 는 다음 deployment 시 새 history 로 overwrite — Phase 9 force push 후 자동 정정.
- 신규 commit 규칙 (헌장 보강):
  - 모든 commit author 는 noreply 형식 (`NNNNNNNNN+username@users.noreply.github.com`) 사용.
  - 평문 gmail/work email 박힘 차단 = GitHub "Block command line pushes that expose my email" ON 으로 강제 (Phase 0 확인).
  - 본 repo `git config user.email` 은 영구적으로 `261937864+Arbitoria@users.noreply.github.com` 고정 (Phase 1 set, `--global` 안 붙임 → 다른 repo 영향 0).
- **거부**: BFG Repo-Cleaner 추가 적용 — filter-repo 가 이미 mailmap 처리 완료 + BFG 는 큰 blob 제거가 주 기능 (정체성 매핑은 부속). 도구 중첩의 cost > 이득.

## Verification (게이트)

Phase 6 (--dry-run) → 7 (실 rewrite) → 8 (검증) → 9 (force push) 순. 각 게이트 통과 신호 명세:

| 게이트 | 명령/액션 | 통과 조건 | 실측 (TBD) |
|---|---|---|---|
| V1 | `python -m git_filter_repo --mailmap .git/mailmap.txt --dry-run --force` (`--force` 사유: fresh-clone 안전 검사 우회 — 백업 2중 완료라 검사 의도 별도 충족) | exit 0 + "Parsed 128 commits in 0.09s" + author/committer 변경 라인 수 **508** (예상 127 × 2 × 2) + bootstrap 변경 **0** + ref 실 변경 **0** (main HEAD `e2c6266` 보존) | ✅ **통과 (2026-05-14)**. fast-export.original 260,853 B / .filtered 256,848 B / diff 896 라인 (508 author·committer + 388 `original-oid` 메타 — commit object 영향 0). |
| V2 | `python -m git_filter_repo --mailmap .git/mailmap.txt --force` (실 rewrite) | exit 0 + working tree clean + HEAD 새 hash + origin remote 자동 삭제 (filter-repo 기본 — Phase 9 에서 재추가) | ✅ **통과 (2026-05-14)**. "Parsed 128 commits" + "New history written in 0.13 seconds" + "Repack/cleanup 0.51s" + "HEAD is now at 4277aee" + working tree clean (ADR-0031 untracked만). |
| V3 | `git log --all --format='%an <%ae>' \| sort \| uniq -c \| sort -rn` | `127 Arbitoria <261937864+...>` + `1 bootstrap <bootstrap@slim.eu>` 만 노출 (HanSap 0 / kimwonmin91-4132 0) | ✅ **통과 (2026-05-14)**. 실측 = `127 Arbitoria <261937864+Arbitoria@users.noreply.github.com>` + `1 bootstrap <bootstrap@slim.eu>` 정확 일치. HanSap 0 / kimwonmin91-4132 0 ✓. |
| V4 | `git rev-list --all --count` | **128** (변화 없음) | ✅ **통과 (2026-05-14)**. 실측 128 일치. |
| V5 | 새 main HEAD = ? / 새 `pre-arbitoria-migration` 태그 hash = ? | 둘 다 기록 + 백업 hash 와 비교해 변경 확인 | ✅ **통과 (2026-05-14)**. 새 main HEAD = `4277aee06e794c4ca5f9543dce2d021a37fd1e0a` (원본 `e2c626654138757af47d1177c02783cf0fe7dbea` ↔ 다름). 새 `pre-arbitoria-migration` 태그 = `ba863cdbc70d2bc2779aa8ff81262dff42acfa1b` (annotated, target commit `07af4d6f78b605b49d107d84afb19dcb92ec5670`) ↔ 원본 `7e03449af78253b9644ecd4a9a1cc28cb2030c55` 다름. `.git/filter-repo/commit-map` 에 옛↔새 hash 매핑 보존 (10,541 bytes — 감사 추적 가능). |
| V6 | `git push --force-with-lease origin main` + tag force push | GitHub `Arbitoria` 모든 commit author + Vercel preview rebuild 정상 | Phase 9 결과 기록 |
| V7 | GitHub UI 에서 `ARBITORIA-BE/slim` commit 목록 확인 | 모든 author 가 `Arbitoria` (HanSap / kimwonmin91-4132 0건) | Phase 9 후 운영자 screenshot |

`--force-with-lease` 사용 사유: `--force` 가 무조건 overwrite 인 반면, lease 는 origin 의 마지막 알려진 상태 ≠ 실제 ref 시 차단 → 협업자(현 0명) 의 push 충돌 방지 안전망. 본 repo 협업자 0이라 차이는 미미하지만, 정석 사용으로 향후 협업 시 자연스러운 패턴.

## Alternatives Considered

### A1. β 분리 — ADR-0031/0032/0033 + 모자 ADR

- 옵션: ADR-0031 정체성 통합 / ADR-0032 branch protection 보류 / ADR-0033 history 노출 인지 + 모자 ADR(개요).
- 장점: 각각 독립적 재인용 가능 (예: 향후 Team 전환 시 ADR-0032 만 deprecate).
- 거부 사유: 본 3건은 **단일 음성 PR 검증의 동일 흐름에서 동시에 발견**됨. 분리 시 4 문서 cross-ref 필요 (INDEX.md + 3 ADR + 모자 ADR) + 읽는 사람이 맥락을 한 번에 파악 어려움. ADR-0030 (D.6) 도 단일 ADR 에 T1/T2/T3 통합 패턴을 따랐고 그게 자연스러움 (Pieter 페르소나 ADR-driven 정합).
- **운영자 DP2 (2026-05-14) 결정 α**.

### A2. `git filter-branch`

- 옵션: git 내장 도구로 rewrite.
- 거부 사유: git 공식 deprecated (man page 경고). 느림 (128 commit 에 ≥30초 vs filter-repo ≤5초). Windows 줄바꿈 / signed commit / replace refs edge case. `--env-filter` 만으로는 mailmap 처리 불완전 (custom shell logic 필요 → 보안 룰 §8 #6 회피 어려움).
- **운영자 DP0 (2026-05-14) 결정 pip install git-filter-repo**.

### A3. 백업 없이 진행

- 거부 사유: rewrite + force push 는 둘 다 *불가역*. 백업 0 시 실수 복구 수단 0. Pieter 페르소나 "destructive 작업 전 반드시 백업" 헌장 위반.
- **본 ADR §Context Phase 3 산출 — bundle + mirror 둘 다 작성**.

### A4. mailmap 을 루트 `.mailmap` 으로 (추적 가능)

- 옵션: `.mailmap` 을 git index 에 commit + filter-repo `--use-mailmap`.
- 거부 사유: rewrite 완료 후 mailmap 은 *무용지물* (모든 author 가 이미 통합됨). 추적된 `.mailmap` 은 향후 commit 의 `git log --use-mailmap` 결과에 영향 — 단순 정체성이 통합된 상태에서는 정보 가치 0. **`.git/mailmap.txt`** (untracked, 일회용) 가 깔끔.
- 본 ADR Phase 6 (--dry-run) 후 mailmap.txt 는 *유지* (재실행 가능성 + 본 ADR §Verification 의 reproduce trail). Phase 11 회고 단계에 운영자 선택으로 삭제.

### A5. BFG Repo-Cleaner 추가 적용

- 거부 사유: §T3 — filter-repo 가 mailmap 처리 완료. BFG 의 주 기능은 큰 blob/secret 제거이지 정체성 매핑이 아님. 도구 중첩 cost > 이득.

### A6. fresh-start 포기 — 기존 history 그대로 유지

- 거부 사유: 운영자의 ARBITORIA-BE org 신설 본래 의도 침해. 향후 4.6 베타 모집/외부 노출 시점에 옛 정체성이 *공개적으로* 보일 위험.

## Impact

### 코드 변경

**0 건** (소스 파일 / 설정 파일 / 워크플로 / 테스트 무변동). 본 작업은 **git history 만 다시 쓰기**.

### Git 변경 (불가역)

- 128 commit 모두 새 hash. `origin/main` force push. 태그 `pre-arbitoria-migration` 새 hash + force push.
- 본 ADR 자체는 Phase 10 (PLAN.md 갱신) 과 함께 새 commit 으로 추가 — 그 commit author 는 `Arbitoria` (Phase 1 config 정정 효과).

### 외부 영향

- **Vercel**: 다음 deployment 시 새 history 로 자동 정정. 옛 build cache 는 무용지물화 (자동 invalidate).
- **GitHub UI**: commit author 모두 `Arbitoria` 노출. Free org plan 의 contributor view 도 정정.
- **외부 클론**: 현재 0 (private + 협업자 0). Phase 9 후 외부 fork 가능성 *전에* 마쳐 둠.

### 메모리 영향

- `founder_situation` 메모 §GitHub 플랜 = TVA 후 Team $4 트리거 → §D.1.c → §T2 cross-ref.
- 별도 메모 신설: `project_identity_unification.md` — 본 ADR 요약 + Phase 9 후 force push 시점 + 새 main HEAD hash 기록 (Phase 11 회고 단계).

### PLAN.md 영향 (Phase 10)

- §D.1.c 본문에 차단 사유 1줄 추가 (Free 플랜 → Team $4 전환 트리거).
- 페이즈 0.5 에 **D.7** 항목 신설 — "fresh-start 완성 — ADR-0031" (Phase 1~9 산출 [x] / Phase 10~14 후속 [ ]).
- 작업 추적 메타 표 합계 +1.

### CHANGELOG / INDEX

- `CHANGELOG.md` 에 한 줄: "chore(history): identity unification — Arbitoria 127 commits (mailmap) + tag pre-arbitoria-migration rewritten. ADR-0031."
- `docs/adr/INDEX.md` 에 ADR-0031 한 줄 추가.

## References

- [PLAN.md](../../PLAN.md) §0.5 D.1.c — branch protection 보류 cross-ref.
- [ADR-0020](0020-arbitoria-inventory-and-alignment-corrections.md) — ARBITORIA-BE org 정합성 (본 ADR 의 mailmap 매핑 대상자 `Arbitoria` 가 정의된 ADR).
- [ADR-0025](0025-verifier-read-only-commit-boundary.md) — verifier read-only. 본 ADR 은 *운영자 직접 결정 + Pieter 단일 세션 실행* → verifier 미호출 (운영자 confirm 으로 게이트 대체).
- [ADR-0030](0030-d6-compare-flow-chunkloaderror-retrospective.md) — 본 ADR 직전 ADR + 양식 참고.
- `founder_situation.md` 메모 §GitHub 플랜 — TVA 후 Team $4 전환 트리거.

---

**다음 phase**: Phase 6 (filter-repo --dry-run) → §Verification V1 결과 본 ADR 에 채움 → 운영자 confirm 후 Phase 7 (실 rewrite) → V2~V5 채움 → 운영자 confirm 후 Phase 9 (force push) → V6/V7 채움 → 본 ADR §Status `Accepted` 전이.
