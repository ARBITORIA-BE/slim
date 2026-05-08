# Slim — Windows 셋업 가이드

이 가이드는 **WSL 없이 native Windows + Git Bash + Claude Code**로 Slim 워크플로우를 처음부터 끝까지 돌리는 법입니다.

> 사용자 환경 가정: Windows 10/11, Node 22+ / pnpm 9+ 이미 설치됨

---

## ✅ 이미 설치된 것

PowerShell 또는 cmd에서 확인:

```cmd
node -v    # v22 이상이어야 함
npm -v
pnpm -v    # v9 이상
```

세 개 모두 버전이 나오면 → 다음 Step.

---

## Step 1 — Git for Windows 설치 (Git Bash 포함)

이게 핵심입니다. Git Bash 없이는 `.sh` 스크립트가 안 돕니다.

**다운로드**: https://git-scm.com/download/win

**설치 시 옵션** (기본값에서 다음만 확인):

| 옵션 | 선택 |
|---|---|
| 우클릭 메뉴 | "Git Bash Here" ✅ + "Git GUI Here" ✅ |
| 줄바꿈 처리 | **"Checkout as-is, commit Unix-style line endings"** (중요!) |
| 터미널 에뮬레이터 | MinTTY |
| Pull 동작 | "Default (fast-forward or merge)" |

**설치 확인**: 임의의 폴더에서 우클릭 → **"Git Bash Here"** 메뉴가 보이면 OK.

---

## Step 2 — Python 3 설치

`bootstrap.sh`의 PLAN.md 자동 갱신에 사용됩니다. Microsoft Store가 가장 쉬워요.

**옵션 A (권장)**: Microsoft Store
1. Win 키 → "Microsoft Store" 검색
2. "Python 3.12" 검색 → 설치 (무료)

**옵션 B**: https://www.python.org/downloads/
- ⚠️ 설치 시 **"Add python.exe to PATH"** 체크 필수

**확인** (Git Bash에서):

```bash
python --version    # 3.11 이상
# 또는
python3 --version
```

---

## Step 3 — Claude Code CLI 설치

PowerShell 또는 cmd (관리자 권한 불필요):

```cmd
npm install -g @anthropic-ai/claude-code
```

**확인**:

```cmd
claude --version
```

> 첫 실행 시 브라우저로 Anthropic 로그인 → Max 5x 자동 인식.

---

## Step 4 — VS Code 설치 (선택, 권장)

**다운로드**: https://code.visualstudio.com/

**설치 시 체크**:
- ✅ "PATH에 추가"
- ✅ 우클릭 컨텍스트 메뉴 "Code(으)로 열기"

**확장 설치** (VS Code 안에서 `Ctrl+Shift+X`):

| 확장 | 용도 |
|---|---|
| **Claude Code** | 사이드 패널에서 Pieter와 대화 |
| **ESLint** | 실시간 lint |
| **Prettier** | 저장 시 자동 포맷 |
| **Tailwind CSS IntelliSense** | Tailwind 자동완성 |

---

## Step 5 — 프로젝트 압축 해제

다운로드한 `slim-claude-code.zip`을 풀고 폴더 위치 확인:

```
C:\Users\kimwo\slim\        ← 이 위치 권장
├── CLAUDE.md
├── PLAN.md
├── MONETIZATION.md
├── README.md
├── SETUP_WINDOWS.md         ← 이 파일
├── .claude/
├── scripts/
├── src/
└── ...
```

---

## Step 6 — 첫 부트스트랩

`C:\Users\kimwo\slim\` 폴더에서 **빈 공간 우클릭 → "Git Bash Here"**

```bash
# 1) 환경 점검 (어느 도구가 부족한지 알려줌)
bash scripts/preflight.sh

# 통과하면 ↓
# 2) Phase 0.1 ~ 0.7 자동
pnpm bootstrap
```

**성공 시 마지막 메시지**:

```
==========================================
✅ Phase 0 부트스트랩 완료
==========================================

다음 단계:
  1) pnpm dev      — 로컬 확인 (http://localhost:3000)
  2) claude        — Claude Code 시작 → Phase 1.1부터
```

---

## Step 7 — 로컬 서버 확인 (선택)

```bash
pnpm dev
```

브라우저에서 http://localhost:3000 → **"Slim. 비교는 쉽게, 절약은 두툼하게"** 헤드라인이 보이면 OK.

`Ctrl+C`로 서버 종료.

---

## Step 8 — Claude Code 시작

```bash
claude
```

**첫 메시지로 받게 되는 것**:

```
👋 Pieter 세션 시작

📊 PLAN: 7✅ / 0🔄 / 0🚫 / 54⏳ (총 61)

▶️ 다음 작업: 1.1 provider 테이블 (공급사 마스터)

🕒 마지막 커밋: chore(phase-0): bootstrap — Next.js 15 + Tailwind 4 + ...
```

이 메시지가 그대로 나오면 **모든 hook이 정상 작동 중**입니다.

다음 메시지로:

```
PLAN 1.1부터 진행해줘
```

→ Pieter가 architect → builder → verifier → scribe 흐름으로 자동 진행.

---

## VS Code에서 같이 보고 싶다면

Git Bash에서:

```bash
code .
```

VS Code가 열리고:
- 왼쪽: 파일 트리
- 오른쪽 사이드: Claude Code 확장 패널 (Ctrl+Shift+P → "Claude")
- 아래: 터미널 (`Ctrl+` `)

---

## 🔧 자주 마주칠 문제

### Q1. Git Bash에서 `bash: pnpm: command not found`

PowerShell의 npm 글로벌 경로가 Git Bash에서 안 보일 때:

```bash
echo 'export PATH="$PATH:$APPDATA/npm"' >> ~/.bashrc
source ~/.bashrc
```

### Q2. `python3: command not found`

bootstrap v0.4부터 자동으로 `python` → `py` 순으로 fallback. 그래도 안 되면:

```bash
# Git Bash의 ~/.bashrc에 추가
alias python3=python
```

### Q3. Husky pre-commit이 안 돔

```bash
git config core.hooksPath .husky
```

### Q4. 한글이 깨짐 (Git Bash)

Git Bash 우상단 ☰ 아이콘 → **Options** → **Text** → 
- Locale: `ko_KR`
- Character set: `UTF-8`

### Q5. 줄바꿈 경고 (`LF will be replaced by CRLF`)

```bash
git config --global core.autocrlf input
```

### Q6. `claude` 명령어가 PowerShell에서만 되고 Git Bash에서 안 됨

```bash
# Git Bash 안에서
echo 'alias claude="winpty claude"' >> ~/.bashrc
source ~/.bashrc
```

또는 그냥 `cmd /c claude` 도 가능.

### Q7. `pnpm bootstrap` Step 6 검증에서 typecheck 실패

처음 한 번은 의존성이 캐시 안 돼서 느릴 수 있음. 수동으로:

```bash
pnpm typecheck
# 에러 메시지 보고 그 파일 수정 후 다시
pnpm bootstrap
```

---

## 📋 명령어 치트시트

| 명령 | 어디서 | 용도 |
|---|---|---|
| `bash scripts/preflight.sh` | Git Bash | 환경 점검 |
| `pnpm bootstrap` | Git Bash | Phase 0 자동 |
| `pnpm dev` | Git Bash | 로컬 서버 |
| `pnpm typecheck` | Git Bash | 타입 점검 |
| `pnpm test` | Git Bash | 단위 테스트 |
| `pnpm harness:plan` | Git Bash | PLAN 정합성 |
| `pnpm harness:data` | Git Bash | 데이터 출처 강제 (P1) |
| `claude` | Git Bash | Pieter 세션 시작 |
| `/verify-plan` | Claude 안 | 진행 보고 |
| `/checkpoint 1.1 "메시지"` | Claude 안 | 작업 마감 (게이트 + 커밋 + PLAN 갱신) |
| `/ship` | Claude 안 | 배포 전 종합 점검 |

---

## 🎯 다음 단계 — 실제 코드를 짜기 시작

부트스트랩이 끝나면 PLAN의 **Phase 1.1 (provider 테이블)**부터 시작합니다.

Pieter에게:

```
1.1 시작해줘
```

또는 더 구체적으로:

```
PLAN 1.1 진행. Drizzle로 provider 테이블 만들고 단위 테스트도 같이.
```

architect가 ADR 초안 → 사용자 확인 → builder가 구현 → verifier 게이트 → scribe 문서화 순으로 자동 진행됩니다.

**막히면 그 단계의 에러 메시지 그대로 알려주세요.** 그게 디버깅의 첫 단계입니다.

---

## 🛟 비상 연락

- README.md: 프로젝트 전체 설명
- CLAUDE.md: Pieter 페르소나 + 헌법
- PLAN.md: 61개 작업 체크리스트
- MONETIZATION.md: 수익화 + 윤리 KPI
- 이 파일: Windows 셋업 트러블슈팅

워크플로우 자체에 버그가 있으면 (또 발생할 수 있음 — bash 스크립트는 환경 의존이 큼):

1. 정확한 에러 메시지 복사
2. 어느 Step에서 발생했는지
3. `bash scripts/preflight.sh` 결과

이 셋이면 빠르게 진단 가능.
