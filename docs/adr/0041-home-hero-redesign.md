# ADR-0041: Home Hero Redesign — Product Identity Recovery

## 상태

Proposed (2026-06-06, architect — 운영자 자가 진단 신호 + 4.9 organic SEO 런치
1일차 conversion 위험 봉합). PLAN 4.13 트리거. builder 진입 = PR #34 (Sentry
init, 4.5.2.a 코드 트랙) 머지 + main 동기화 후.

---

## 맥락 (Context)

### C1. 운영자 자가 진단 신호 (가장 강함)

운영자(코드 작성자 본인)가 2026-06-06 자기 제품을 보고 한 말:

> "비교 플랫폼인데 뭐랑뭐를 비교하는거야? 나는 봐도 잘 모르겠어 이게 맞는거야?"

= **제품 정체성 위기 신호**. 코드를 직접 작성한 운영자조차 홈 첫 화면에서
"무엇을 비교하는 서비스인지" 판독 불가. 신규 방문자(0 knowledge)는 더 심각.

### C2. 4.9 organic SEO 런치 (2026-06-05 발효) 직후 conversion 위험

- ADR-0034 D5 = organic SEO 단일 마케팅 채널. 베타 모집 (ADR-0029) 폐기.
- 4.6 [x] (2026-06-05) — slim.lu Search Console + sitemap 8 페이지 제출 완료.
- 4.9 [x] (2026-06-05) — 런치 게이트 통과 선언.
- **현 상태 = organic 신규 방문자 유입 시작 → 홈 직진 → 정체성 불명 → bounce ≈ 100%
  진행 가능성**.
- conversion 차단의 *진원지* = 홈 → /compare 진입 깔때기 단일 CTA "지금
  비교하기" 1개 (정체성 불명 상태에서 클릭 의향 0).

### C3. 정찰 결과 — 메인 페이지 현 상태

`src/app/[locale]/page.tsx` (67줄, RSC):

```
H1: "Slim." (4글자, 무엇인지 0)
태그: "비교는 쉽게, 절약은 두툼하게" (무엇을? 0)
CTA: "지금 비교하기" 단일 버튼
```

**Above-the-fold 정보 = 무엇을 비교 / 어느 나라 / 누구를 / 얼마나 절약 /
왜 신뢰 — 0개 노출.**

### C4. 정찰 결과 — /compare 페이지는 잘 설계됨

`src/app/[locale]/compare/page.tsx` (132줄):

- 카테고리 카드 3개 (mobile / internet_fixed / bundle_internet_tv) 동일 시각 무게.
- 다크패턴 0 ("추천" 라벨 / 색상 강조 0 — 본문 코멘트 L4~5 자기 명시).
- `t('savingsPreviewPending')` = "평균 절약액 미리보기는 베타 후 노출 예정"
  → ADR-0011 §T2 항목 5 동형 (0 데이터 정직 표시 토큰).
- 클릭 → `/compare/{category}/postal` 5단계 흐름 (ADR-0016 §T1).

**진단**: `/compare` *에 도달하기만 하면* 명확. **문제는 홈 → /compare 진입
차단** — 정체성 불명 + 단일 CTA = 깔때기 입구 차단.

### C5. 벤치마크 갭 (CLAUDE.md 메모리 `project_benchmarks.md`)

- **Check24(DE)** hero = 카테고리 12개 카드 + 매체 인용 + 검색바.
- **Danawa(KR)** hero = 카테고리 그리드 + 인기 상품 + 가격 위젯.
- **slim.lu** hero = "Slim." + 태그 + 버튼 1개. 끝.

벤치마크 평균 대비 *정보 밀도 1/10*.

### C6. 운영 제약

- 운영자 €300/월 cap + 솔로 사이드 (ADR-0004 §결정 2).
- 5 locale (ko/en/nl-BE/nl-NL/fr-BE/fr-LU) i18n 정합 (ADR-0033 §T2).
- ADR-0034 D2 = **통신 BE 만 깊게** (에너지/모기지/보험/금융 = 범위 밖).
- 헌법 §3 P1 (정보 우선 — 출처/신선도), §3 P2 (5분 5단계 잠금), §3 P3
  (투명성), §8 #3 (다크패턴 0).
- ADR-0029 §T2 = 정직성 잠금 토큰 (DEPRECATED 본 ADR이지만 *카피 정직성
  원칙은 보존* — "최고/유일/혁신" 금지, "광고 0" 명시 가능, 어트리뷰션 100%
  공개 링크).

---

## 결정 (Decision)

홈 메인 페이지를 **5블록 hero 구조**로 재설계한다. Above-the-fold (1차 뷰포트)
안에서 신규 방문자가 *5초 안에* 4개 질문에 답을 얻는다:

1. **Slim이 무엇인가** (제품 정체성)
2. **무엇을 비교하는가** (카테고리)
3. **예시 절약액** (가치 제안 — 0 데이터 정직 표시 가능)
4. **왜 신뢰할 만한가** (광고 0 + 어트리뷰션 공개)

### D1. 5블록 구조 (위→아래)

#### 블록 1 — H1 + 한 줄 서술 (정체성)

- H1 (변경): 현 "Slim." → **"베네룩스 통신 비교, 5분 안에"** (가칭, i18n 키
  `home.headline` 재정의). "Slim" 브랜드명은 메타데이터/`og:title`/footer
  에서 유지 (ADR-0035 LEGAL_ENTITY 정합).
- 한 줄 서술 (신규 키 `home.subheading`): **"벨기에 모바일 · 인터넷 · 번들
  요금을 공식 가격 그대로 비교하세요."** (`mobile / internet_fixed /
  bundle_internet_tv` = ADR-0005 Amendment 1 카테고리 3종 명시).

#### 블록 2 — 카테고리 카드 3개 (CTA 통합)

- `/compare/page.tsx` 카드 구조 *그대로 재사용* — 컴포넌트 추출 신설 (PLAN
  5.5 "재사용 가능 컴포넌트" 트랙 부분 선반영).
- 카드 = 모바일 / 인터넷 / 번들 동일 시각 무게 (다크패턴 0).
- 클릭 → `/compare/{category}/postal` 직진 (홈 → /compare 한 단계 단축 —
  P2 5분/5단계 예산 확보).
- "지금 비교하기" 단일 버튼 **삭제** — 카드 자체가 CTA 역할.

#### 블록 3 — 공급사 로고 3개 (신뢰 시그널 1)

- Proximus / Telenet / Orange BE 로고 가로 배치 (ADR-0034 D4 Amendment 1 —
  Voo 흡수, 3 공급사 final).
- 캡션 (신규 키 `home.providersCaption`): **"벨기에 통신 3대 공급사 (시장
  점유 ≥ 97.5%) 가격을 매일 갱신합니다."** (Mordor Q1 2025 cross-ref —
  ADR-0034 Amendment 1).
- 헌법 P1 = `source: "Mordor Intelligence Q1 2025"` + `fetched_at: <오늘
  날짜>` UI 노출 (작은 글씨 footnote 또는 hover tooltip).

#### 블록 4 — 예시 절약액 placeholder (가치 제안)

- **0 데이터 정직 표시** (ADR-0029 §T2 정직성 토큰 보존).
- 표시안 A (실데이터 부족 시 — *기본*): "예시 절약액 — 베타 데이터 수집 중"
  (`home.savingsExamplePending` 신규 키, `/compare`
  `savingsPreviewPending` 동형 패턴).
- 표시안 B (실데이터 누적 시 — *4.7 SCRAPING 14/14 100% 달성 후 후속 격상
  트리거*): "평균 절약액 €X/월 (지난 30일 비교 N건 기준, source: Slim
  internal aggregation, fetched_at: <ts>)".
- 4.13 builder 1차 = 표시안 A 기본. 표시안 B 격상은 별도 sub-task (4.13
  범위 밖, 데이터 누적 후).

#### 블록 5 — 신뢰 시그널 텍스트 3종

- **"광고 0 / 비교 결과는 100% 알고리즘"** (헌법 §8 #4 직결).
- **"제휴 수수료 공개 → /legal/affiliate-disclosure"** (4.3.d 기완료 cross-ref,
  헌법 P3).
- **"비교에서 제외된 공급사도 공개 → /data-sources"** (1.10/ADR-0011 cross-ref,
  헌법 P3).

신규 키: `home.trustNoAds` / `home.trustAffiliateDisclosure` / `home.trustExcluded`.

### D2. CTA 변경 — 단일 버튼 삭제, 카드 자체가 CTA

- 현 `<Link href="/compare">지금 비교하기</Link>` **삭제**.
- 사용자는 홈에서 *카테고리를 먼저 선택*하고 바로 우편번호 입력 (`/compare/{category}/postal`).
- 한 단계 단축 = P2 5분/5단계 예산 1단계 마진 확보 (ADR-0016 §T1 5단계 골격
  변경 0 — `/compare` 카테고리 선택을 홈으로 흡수, postal 부터 5단계 카운트
  유지).

### D3. 모바일 우선

- 베네룩스 모바일 traffic 비중 ~60%+ 추정 (운영자 메모, 정량 source 부재 →
  *추정* 명시).
- 블록 1→2→3→4→5 세로 스택 (mobile), 블록 2 카드 1열 (`grid-cols-1`),
  블록 3 로고 3열 가로 (작은 사이즈).
- desktop = `md:` breakpoint 에서 블록 2 카드 3열 (`md:grid-cols-3`),
  `/compare` 의 `md:grid-cols-2` 와 차별화 (홈은 3 카드 다 보이도록).
- 첫 fold (viewport height 100vh 가정) 안에 블록 1+2 = 정체성+카테고리
  필수. 블록 3+4+5 = scroll 가능 (mobile), desktop 1280×720 가정 시 모두
  fold 내.

### D4. i18n 키 신설 — 5 locale × 8 신규 키 = 40 string entries

신규 `home.*` 키 (현 4개 — `headline`/`tagline`/`ctaButton`/`metaTitle`/
`metaDescription`):

- `home.headline` **재정의** (현 "Slim." → 정체성 카피)
- `home.subheading` **신설** (블록 1)
- `home.providersCaption` **신설** (블록 3)
- `home.savingsExamplePending` **신설** (블록 4, ADR-0029 §T2 정직성 토큰)
- `home.trustNoAds` **신설** (블록 5)
- `home.trustAffiliateDisclosure` **신설** (블록 5)
- `home.trustExcluded` **신설** (블록 5)
- `home.providersUpdatedAtLabel` **신설** (헌법 P1 fetched_at 라벨)
- `home.tagline` *유지 가능* (블록 1 보조, 또는 삭제 — builder 결정)
- `home.ctaButton` **삭제** (D2)
- `home.metaTitle` / `home.metaDescription` *유지* (재정의 — "베네룩스 통신
  비교" 정체성 반영).

**신설/재정의 합계 ≈ 8 신규 키 + 3 재정의 = 11 entries × 5 locale = 55
string entries** (DeepL Free 추정 ≈ 800 chars × 4 locale = 3,200 chars, ADR-0040
Phase B 누적 대비 < 1% — 영향 0).

ko 1차 작성 → DeepL Free 자동 (nl/fr/en) → legal/i18n 검수 (4.5.j.3 동형
패턴 — ADR-0040 D1/D2 트랙은 `legal.*` 한정이므로 본 `home.*` 은 일반
i18n 트랙).

### D5. 컴포넌트 분리

- `src/components/Hero/HeroHeader.tsx` (블록 1 — RSC)
- `src/components/Hero/CategoryGrid.tsx` (블록 2 — RSC, `/compare`
  카드 구조 재사용 / PLAN 5.5 선반영)
- `src/components/Hero/ProviderLogos.tsx` (블록 3 — RSC + Next/Image)
- `src/components/Hero/SavingsExample.tsx` (블록 4 — RSC, 데이터 부재 시
  pending 라벨)
- `src/components/Hero/TrustSignals.tsx` (블록 5 — RSC)

`src/app/[locale]/page.tsx` = 컴포지션 컨테이너 (라인 ≤ 80).

### D6. 공급사 로고 권리 — legal 사전 검토 필수

- Proximus / Telenet / Orange BE 공식 로고 사용 가능성 = **legal 서브에이전트
  호출 필수** (4.13.b sub-task).
- 후보 1: 공식 press kit (Proximus newsroom / Telenet press / Orange BE
  media)에서 다운로드 + 어트리뷰션 표기.
- 후보 2: SimpleIcons (오픈 소스 SVG 브랜드 로고 컬렉션, MIT-like) — 단,
  최신 리브랜딩 누락 가능성.
- 후보 3: legal 거부 시 **텍스트 로고 폴백** ("Proximus" / "Telenet" /
  "Orange BE" 단순 텍스트, 회사 폰트 모사 없음).
- 결정 보류 → 4.13.b legal 검수 결과로 builder 분기. 최악의 경우 폴백 (3)
  으로 진입 가능.

---

## 대안 (Alternatives Considered)

### 대안 A — 미니멀 유지 (현상 유지)

- 장점: 코드 변경 0. 디자인 일관성 (Apple/Google 스타일).
- 단점: **운영자 자가 진단 신호 무시** (C1). organic SEO 1일차 conversion ≈ 0
  진행. 정체성 위기 방치.
- **거부**: C1 신호 강도 > 미니멀 미학 가치.

### 대안 B — 카테고리 카드 6개 (Check24 풍)

- 장점: 정보 밀도 높음. SEO 키워드 풍부.
- 단점: ADR-0034 D2 (통신 BE 만, 통신 외 = 범위 밖) **위반**. 가짜 카테고리
  (에너지/모기지/보험) 노출 = 헌법 §8 #4 광고 영역과 비교 영역 혼합 + P3 투명성
  위반 (없는 서비스 광고).
- **거부**: D2 정합 절대.

### 대안 C — Hero 전체 단일 검색바 (Google 풍)

- 장점: 단순. 모바일 친화.
- 단점: 카테고리 선택 우선이 BE 통신 비교 UX 자연 흐름 (ADR-0016 §T1 5단계
  첫 단계 = 카테고리). 검색바 → 자유 입력 → 카테고리 추론 = 추론 오류 시
  사용자 좌절. 정체성 답변 0.
- **거부**: ADR-0016 §T1 5단계 골격 보존 필요.

### 대안 D — 동영상 hero (Salair-plus 풍)

- 장점: 강한 시각적 임팩트.
- 단점: LCP > 2.5s 위험 (헌법 P2). 5 locale 동영상 자막 비용 폭증. €300/월
  cap 정합 0.
- **거부**: P2 + €300 cap 정합.

### 대안 E — D1 (채택) + 카드 6개 (3 통신 + 3 placeholder "곧 출시")

- 장점: 정보 밀도 + 미래 확장 신호.
- 단점: ADR-0034 D2 위반 *유사 패턴* — "곧 출시" = 거짓 약속 (운영자 명시
  거부 = 통신 외 범위 밖). 헌법 P3 위반.
- **거부**: D2 정합. 카드 3개로 한정.

---

## 결과 (Consequences)

### 얻는 것

- 신규 방문자 *5초 안에* 4개 질문 (무엇/어디/얼마/왜 신뢰) 답을 얻음 →
  organic SEO conversion 회복 가능성.
- 운영자 자가 진단 신호 (C1) 봉합 — 운영자 본인이 "이게 맞다" 판독 가능.
- 홈 → /compare → /postal → ... → /confirm 5단계 → **홈 → /postal → ... → /confirm
  4단계** 단축 (P2 5분 예산 1단계 마진 확보).
- 헌법 P3 투명성 신뢰 시그널 3종 above-the-fold 노출.

### 잃는 것 (부채)

- 미니멀 디자인 미학 일부 손실 (Apple/Google 스타일 → Check24/Danawa 스타일
  근접).
- i18n 키 신설/재정의 11 entries × 5 locale = 55 string entries 운영 부담
  (DeepL Free 처리 가능, 영향 0).
- 공급사 로고 권리 검토 운영 부담 (legal 1회 호출, 베네룩스 변호사 외부
  감사 €800 트리거 *아님* — 로고 사용은 공식 press kit 인용 범위).
- 컴포넌트 5개 신설 = 코드 부피 증가 (대략 +250 라인 추정). 단, `/compare`
  카드 구조 재사용으로 중복 최소화.

### 위험 (회귀 트리거)

- **위험 R1**: 첫 fold 안에 블록 1+2 (정체성+카테고리) 안 들어감 → mobile
  360×640 가정에서 블록 2 카드가 fold 밖 → 회귀. **완화**: 4.13 builder 실측
  Chrome MCP devtools 360×640 viewport 시뮬레이션.
- **위험 R2**: 공급사 로고 권리 거부 → 텍스트 폴백 → 신뢰 시그널 강도 ↓.
  **완화**: 텍스트 폴백 + "공급사 명칭은 등록 상표입니다" footnote.
- **위험 R3**: 신규 i18n 키 nl/fr/en DeepL 번역 부정확 → 정체성 카피 의미
  손실. **완화**: ko 1차 → DeepL → 운영자 또는 legal 수동 검수 (ADR-0040
  §T3 hybrid 패턴 동형).
- **위험 R4**: 4.13 builder 진입 시점 PR #34 (Sentry init) merge conflict
  가능성. **완화**: 4.13 진입 게이트 = "PR #34 merge + main 동기화 후"
  명시.

---

## 검증 방법 (Verification)

### V1. Above-the-fold 5초 판독 테스트 (운영자 자가)

- 운영자 본인이 Chrome MCP devtools (mobile 360×640 / desktop 1280×720)
  에서 첫 fold 안에 4개 답을 시각 확인.
- 통과 기준: C1 운영자 자가 진단 발언 "뭐랑뭐 비교하는거야?" 가 "통신 3사
  비교구나" 로 자동 전환.

### V2. Lighthouse / Core Web Vitals (헌법 P2)

- LCP ≤ 2.5s / CLS ≤ 0.1 / FID ≤ 100ms.
- 공급사 로고 = Next/Image lazy + `priority={false}` (LCP 회피).
- `pnpm harness:perf` advisory pass (CI 머지 차단 X — ADR-0023).

### V3. i18n 정합 (`pnpm harness:i18n` GREEN)

- 신규 11 키 5 locale 모두 정의 (한글 0 in nl/fr/en).
- `harness:i18n` 4.5.j.5 확장 스캔 (`src/components/Hero/**`) 포함.

### V4. 타입/lint/테스트 게이트 (헌법 P4)

- `pnpm typecheck` 0 / `pnpm lint` 0 / `pnpm test:run` 0 fail.
- `pnpm harness:plan` 93 정합 (4.13 추가 +1).
- 컴포넌트 단위 테스트 5개 (블록 1~5 각 1).

### V5. organic SEO conversion 신호 (간접)

- 4.13 머지 + Vercel 배포 후 7일 누적.
- 어드민 메트릭 (4.5.1.b) — `comparison_request` COUNT 추세 + `/compare`
  진입률 (Search Console).
- 통과 기준 = *없음* (단일 변경의 conversion 격리 측정 불가, observational
  only). 단, 운영자 자가 진단 V1 통과 = primary signal.

---

## Cross-references

- ADR-0011 §T2 항목 5 — 0 데이터 정직 표시 토큰 (블록 4 `savingsExamplePending`).
- ADR-0016 §T1 — 5단계 골격 보존 (홈 흡수 후 postal 부터 5단계 카운트 유지).
- ADR-0029 §T2 — 정직성 잠금 토큰 (DEPRECATED but 카피 원칙 보존).
- ADR-0033 §T2 — 5 locale i18n 정합 (ko/en/nl-BE/nl-NL/fr-BE/fr-LU).
- ADR-0034 D2 — 통신 BE 만 (카테고리 3종 final).
- ADR-0034 D4 Amendment 1 — 3 공급사 (Voo 흡수, Proximus/Telenet/Orange BE).
- ADR-0034 D5 — organic SEO 단일 마케팅 채널 (4.9 [x] 2026-06-05 발효).
- ADR-0035 — LEGAL_ENTITY (Slim 브랜드 footer 유지).
- ADR-0040 §T3 — DeepL Free + 수동 검수 hybrid (본 home.* 은 legal.* 트랙
  아님, 일반 i18n 트랙).
- PLAN 1.10 / ADR-0011 — `/data-sources` 제외 공급사 공개 (블록 5
  `trustExcluded`).
- PLAN 4.3.d — `/legal/affiliate-disclosure` (블록 5 `trustAffiliateDisclosure`).
- PLAN 4.5.1.b — 어드민 메트릭 (V5 conversion 신호).
- PLAN 5.5 — 재사용 가능 컴포넌트 (CategoryGrid 분리 선반영).
- 헌법 §3 P1 / P2 / P3 / §8 #3 / #4.

---

## 운영자 결정 필요 항목 (Trade-offs)

본 ADR Proposed 단계 → Accepted 격상 전 운영자 결정 3종:

### Q1. 블록 1 H1 카피 — "Slim." 브랜드명 vs 정체성 카피

- 옵션 A (채택안): H1 = "베네룩스 통신 비교, 5분 안에" / 브랜드 "Slim" =
  metadata + footer 유지.
- 옵션 B: H1 = "Slim — 베네룩스 통신 비교" (브랜드 + 정체성 결합).
- 옵션 C: H1 유지 "Slim." + 한 줄 서술 강조 (현 구조 보존).
- 운영자 결정 영역. 디폴트 = A.

### Q2. 카드 개수 3 vs 6

- 옵션 A (채택안): 카드 3 (mobile / internet_fixed / bundle_internet_tv) —
  ADR-0034 D2 정합 절대.
- 옵션 B (대안 E): 카드 6 (3 통신 + 3 "곧 출시") — D2 위반 우려.
- 운영자 결정 영역. 디폴트 = A (D2 정합 절대).

### Q3. 공급사 로고 사용 범위

- 옵션 A: 공식 press kit 로고 다운로드 + 어트리뷰션 + legal 검수 PASS.
- 옵션 B: SimpleIcons 오픈소스 SVG (MIT-like, 최신 리브랜딩 누락 가능성).
- 옵션 C: 텍스트 폴백 ("Proximus" / "Telenet" / "Orange BE" 단순 텍스트).
- 운영자 결정 영역. 4.13.b legal 검수 결과로 분기. 디폴트 = A 시도 → 거부
  시 C 폴백.

### Q4. 예시 절약액 표시 방식

- 옵션 A (채택안): 표시안 A — "예시 절약액 — 베타 데이터 수집 중" (정직성
  토큰, ADR-0029 §T2).
- 옵션 B: 표시안 B — "평균 절약액 €X/월" (실데이터 누적 후, 4.7 SCRAPING
  실데이터 기반 — 데이터 누적 ≥ 30일 가정).
- 운영자 결정 영역. 디폴트 = A (4.13 1차). B 격상은 별도 sub-task (데이터
  누적 후, 4.13 범위 밖).

### Q5. tagline 유지 vs 삭제

- 옵션 A: "비교는 쉽게, 절약은 두툼하게" 유지 (블록 1 보조 라인).
- 옵션 B: 삭제 (subheading "벨기에 모바일/인터넷/번들 ..." 으로 흡수).
- builder 결정 위임. 디폴트 = B (subheading 강조).

---

## 일정 추정

- 4.13.a 컴포넌트 명세 + i18n 키 신설 (architect 산출물 본 ADR + PLAN 본문):
  완료 (2026-06-06).
- 4.13.b legal 로고 검수 (legal 에이전트, ≤ 0.5일).
- 4.13.c builder 구현 (5 컴포넌트 + i18n 11 키 5 locale + 테스트, ≈ 1일).
- 4.13.d 게이트 + PR (≈ 0.5일).
- **합계 ≈ 1.5~2일** (운영자 €300/월 cap + 솔로 사이드 정합).

---

## Amendment 1 — /compare 페이지 동기 재설계 (2026-06-06)

### C7. 운영자 추가 신호 (Pieter MCP 실측 정찰 후)

PR #34 머지 직후 slim.lu/en 데스크탑 1280×800 실측 정찰 (Chrome MCP)에서
운영자가 추가 신호 명시:

> "비교 페이지 시각적으로 너무 어려워 조금더 쉽게 볼수있는 디자인 필요해"

= `/compare` (카테고리 선택 페이지) 디자인 시각 난이도 위기. 운영자가 메인
페이지(C1)뿐 아니라 `/compare`도 시각적 어려움을 느낌. 본 Amendment 는 4.13
범위를 *홈 hero + /compare 페이지 동기 재설계* 로 확장한다.

### C8. /compare 실측 진단 (slim.lu/en/compare, 1280×800)

`src/app/[locale]/compare/page.tsx` (132줄) 실측 렌더링 6가지 문제:

1. **너무 추상적 질문** — "Which plan would you like to compare?" — 사용자
   첫 반응은 "어느 회사 (Proximus/Telenet/Orange)?" 인데, 카테고리 선택은
   추상.
2. **가격 범위만 표시** (€15~€35) — 자기 케이스 매핑 어려움. 실 가격은
   5단계 끝까지 가야 알 수 있음.
3. **평균 절약액 placeholder** ("after beta period") = "왜 비교해야 하는지"
   근거 부재 (ADR-0029 §T2 정직성 토큰 정합이지만, 사용자 시선은 "정보 없음").
4. **카드 그리드 `md:grid-cols-2` 어색** — 카드 3개인데 마지막
   (Internet+TV) 이 좌측 가운데 떨어짐. 우측 빈 자리 = 결정 신호 0.
5. **거대한 빈 우측 영역** — 데스크탑 1568px 캡쳐에 `max-w-3xl` (좁은
   컬럼) → 시각 균형 깨짐 (우측 50% 빈 공간).
6. **시각 위계 약함** — 아이콘 작음 + 카테고리명/설명/caveats 무게 비슷 →
   결정 시그널 미발생.

### D7. /compare 페이지 동기 재설계 명세

D1 (홈 hero) 의 5블록 구조와 *시각 언어 정합*. 운영자 €300/월 cap + 솔로
사이드 정합 추가 ≤ 0.5일 사이즈.

#### D7.1. 컨테이너 폭 확장

- `max-w-3xl` → `max-w-5xl` (우측 빈 공간 해소).
- 모바일 단일 컬럼 유지 (`px-4 md:px-6` 정합).

#### D7.2. 카드 그리드 3 컬럼

- `md:auto-rows-fr md:grid-cols-2` → `md:auto-rows-fr md:grid-cols-3`.
- 3 카드 모두 데스크탑에서 한 줄에 가시. 마지막 카드 빈 자리 회피.
- mobile: `grid-cols-1` 유지 (세로 스택).

#### D7.3. 카피 친근화

- H1 (현 `compare.heading` = "Which plan would you like to compare?") →
  **"지금 비교할 요금이 뭔가요?"** 평어 (i18n 키 재정의).
- subheading (현 `compare.supportNote` = "We currently support comparisons
  of telecommunications providers in Belgium (BE)...") → 단축 +
  카테고리별 분기 시그널 ("벨기에 통신 — 모바일 / 인터넷 / 번들 + TV.
  NL/LU 는 추후 지원").

#### D7.4. 카드 정보 강화 (헌법 P1 정합)

각 카드에 *실 예시 가격 1~2개* 추가 (admin SCRAPING 14/14 실 데이터 활용,
헌법 P1 `source` + `fetched_at`):

- Mobile 카드: "예: Proximus Mobilus Light €15.00/월" (1개 예시) +
  `source: Proximus mobile fetcher` + `fetched_at: <ts>` tooltip.
- Internet 카드: "예: Telenet One €54.00/월" (1개 예시).
- Bundle 카드: "예: Proximus Tadaam €60.00/월" (1개 예시).

가격 데이터 = `provider_tariffs` 테이블 cheapest active tariff per category.
ISR `revalidate = 3600` (1h) — admin 메트릭과 동일 신선도.

#### D7.5. 시각 위계 강화

- 아이콘 `h-12 w-12` → `h-14 w-14` (살짝 크게).
- 카테고리명 `font-display` `text-lg` (현재) → `text-xl` (강조).
- 카드 호버 = 현재 `hover:border-primary/40 hover:bg-bg-warm/70` 유지.
- "Step 5 · 5 minutes" 배지 → **"1/4 단계 · 약 4분"** (홈 카테고리 흡수
  반영, D2 정합 단축 표기).

#### D7.6. 데이터 소스 fallback

실 데이터 부재 시 (provider seed 누락 / fetcher 실패) — 가격 표시 placeholder
("가격 데이터 갱신 중" + `confidence='low'` 표기, ADR-0011 §T2 항목 5 동형).

### D8. 컴포넌트 재사용 정합

`src/components/Hero/CategoryGrid.tsx` (D5 컴포넌트) 와 `/compare/page.tsx`
가 *공유 컴포넌트* 사용:

- `<CategoryGrid variant="hero" />` — 홈 (D1 §블록 2) — 가격 예시 1개 / 컴팩트.
- `<CategoryGrid variant="full" />` — `/compare` (D7) — 가격 예시 2개 + caveats
  + 친근화 카피.

또는 단일 컴포넌트 + props 분기 (`showExamples`, `density`). 4.13.c builder
구현 시 결정 (둘 다 가능, 컴포넌트 분리 vs 통합 = 작은 트레이드오프).

### 일정 영향

- D7 명세 (architect 본 Amendment): 완료 (2026-06-06).
- 4.13.c builder 구현 사이즈 ≈ 1일 → **≈ 1.5일** (CategoryGrid 통합 +
  /compare 페이지 재설계 + i18n 키 2~4 추가 재정의).
- 4.13.d 게이트 + PR 사이즈 0.5일 → **0.5~0.75일** (Vercel 실측 추가
  /compare 페이지 5 locale).
- **합계 ≈ 2~2.5일** (운영자 €300/월 cap + 솔로 사이드 여전히 정합).

### 운영자 결정 영역 추가 (Amendment 1)

#### Q6. /compare 카피 친근화 강도

- 옵션 A (채택안): "지금 비교할 요금이 뭔가요?" 평어 + 단축.
- 옵션 B: 현 카피 유지 ("Which plan would you like to compare?") + 카드만
  재설계.
- 옵션 C: 더 강한 친근 ("Proximus 쓰세요? Telenet? 뭘 바꾸고 싶으세요?") —
  공급사 직접 언급, ADR-0034 D2 정합 (BE 통신 3사).
- 운영자 결정 영역. 디폴트 = A.

#### Q7. 카드 가격 예시 표시 방식

- 옵션 A (채택안): 카테고리당 1 예시 (cheapest active tariff, 헌법 P1
  source/fetched_at tooltip).
- 옵션 B: 카테고리당 2~3 예시 (정보 밀도 ↑, 디자인 부담 ↑).
- 옵션 C: 가격 예시 제거 + 가격 범위만 유지 (현 패턴 보존, 정보 갱신 부담 0).
- 운영자 결정 영역. 디폴트 = A.

#### Q8. CategoryGrid 컴포넌트 통합 vs 분리

- 옵션 A (채택안): 단일 컴포넌트 + props 분기 (`variant`/`showExamples`).
- 옵션 B: 컴포넌트 2개 분리 (`HeroCategoryGrid` vs `CompareCategoryGrid`).
- builder 결정 위임. 디폴트 = A (DRY 원칙).

### 검증 추가 (Amendment 1)

- V6. `/compare` 페이지 Vercel 배포 URL 5 locale 1280×800 실측 — D7.1~D7.5
  6가지 문제 봉합 시각 확인.
- V7. 가격 예시 표시 = 실 데이터 (admin SCRAPING 14/14 데이터 동일 경로,
  헌법 P1 source/fetched_at 노출).
- V8. 운영자 자가 V1 통과 — "비교 페이지 시각적으로 너무 어려워" → "이제
  뭘 비교하는지 한눈에 보임".
