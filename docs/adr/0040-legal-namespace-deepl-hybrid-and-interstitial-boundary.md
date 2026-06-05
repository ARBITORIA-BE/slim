# ADR-0040: `legal.*` 네임스페이스 — DeepL+legal hybrid + interstitial 페이지 경계 정정

## 상태

Proposed (2026-06-05, architect — PLAN 4.5.j.3 진입 잠금)

## 맥락

PLAN 4.5.j.3 (`legal.*` 네임스페이스 legal 검수) 진입 전 두 가지 결정이
필요했다:

1. **번역 방법** — `legal.*` nl/fr placeholder (terms/privacy/cookie 본문)
   해소를 DeepL Phase B 동형으로 자동화할지, 수동 번역으로만 갈지, 또는
   hybrid 인지. 본문은 GDPR Art.13 / 약관 / 쿠키 동의 — *법적 정확성*
   요구.
2. **D.9 §부수 발견 경계 정정** — 2026-06-05 D.9 종결 시 운영자가 fr-BE
   `/go/<shortId>/<itemId>` interstitial 페이지가 *한국어 본문 그대로*
   노출됨을 실측. D.9 §부수 발견은 이를 "`legal.*` fr/nl placeholder =
   4.5.j.3 잔여" 로 분류했으나 **코드 정찰 결과 interstitial 페이지는
   `legal.*` 키를 0건 소비** — 전체 본문이 `legal.*` 가 아니라 페이지
   자체 하드코딩 한국어 리터럴. 즉 4.5.j.4.B (보조 페이지 비-legal UI
   셸 i18n) 영역으로, **4.5.j.3 트랙으로는 해소되지 않는다**.

### 정찰 결과 (사실)

- **`legal.*` 키 인벤토리 (ko.json 정본)**: 81 키 (affiliateDisclosure 1
  + terms 27 + cookie 6 + privacy 47). `legal.affiliateDisclosure.pageTitle`
  은 *모든 locale 에서 한국어 그대로* (`"제휴 수수료 공개"`) — 4 locale
  일괄 회귀.
- **nl.json / fr.json**: `legal.*` 전 키에 `[nl]` / `[fr]` prefix 잔여
  (4.12.f §미해결 #4). 본문은 *이미 작성된 네덜란드어/프랑스어* (DeepL
  Phase B 결과로 추정) — prefix 제거 + 본문 legal 검수만 남음.
- **en.json**: 약 36/81 키에 `[en]` prefix 잔여 (4.12.f 1차 검수에서
  "ko/en 본문 통과" 진단은 *prefix 제거 후* 통과를 가리킨 것으로 추정 —
  본 진입 시 prefix 정합 재확인 필요). 본문은 영어로 작성됨.
- **nl-BE/fr-BE/nl-NL/fr-LU**: `legal.*` block 자체 부재 = base nl/fr
  100% 상속 (delta 0). 본 라운드 delta 작업 0.
- **ICU 변수**: `legal.*` 전 키 본문 grep — `{var}` 패턴 0건. 단순 텍스트
  번역만 (var-protection.ts 적용 *불요*).
- **interstitial 페이지** (`src/app/[locale]/go/[shortId]/[itemId]/page.tsx`):
  `useTranslations` / `getTranslations` 호출 **0건**. 본문 25+ 라인이
  하드코딩 한국어 ("이동 전 확인 사항" / "받는 회사" / "Slim 기록 목적"
  / "데이터 흐름" / "동의 철회" 등). PLAN 4.5.j.4.B 명시 대상 = "보조
  페이지 비-legal UI 셸 (`go/[shortId]/[itemId]/page.tsx` 포함)" → 본
  페이지의 한국어 노출 = 4.5.j.4.B 트랙.

## 결정

### D1. 번역 = DeepL+legal hybrid (수동 only 거부, DeepL only 거부)

- **DeepL 1차** — `scripts/i18n/translate.mjs --retarget legal` 모드로
  `[nl]`/`[fr]`/`[en]` prefix 키 일괄 재번역 (4.5.j.4.A.1 동형 패턴
  재사용). var-protection.ts 적용 *불요* (ICU 변수 0건 사실 확인).
  추정 분량 = ko legal.* 약 2,200~2,600 chars × 3 locale (en 포함) =
  ~7,800 chars (DeepL Free 잔여 ~987K 충분, 누적 12,612 → ~20,400 chars,
  여전히 2.1%).
- **legal 1차 검수** — DeepL raw 결과를 legal 에이전트가 *본문 자체*
  검토 (Critical/Major 0). 검수 포인트 = (a) GDPR Art.13 §1·§2 12항목
  의미 보존 (ko 정본 ↔ nl/fr/en) (b) 다크패턴 0 (쿠키 동의 거부 동등
  비중 표현, "Tout accepter" / "Refuser" 동등 — 본문에 추가 nudging 0)
  (c) Art.6(1)(b) 동의 간주 표현 nl/fr 정합 (d) 벨기에 감독기관
  명칭 공식 표기 (APD / GBA / AP / CNPD).
- **외부 변호사 €800 감사** — *분리 운영자 트랙* (베타 직전 또는 수익
  후). 본 ADR 결정 *아니다*. 4.12.f §미해결 #4 그대로 유지.

**근거**: 수동 only 는 솔로 + 학습 중 풀스택 (메모리 founder_profile
+ founder_situation) 환경에서 분량 비현실적 (~7,800 chars 3 locale 전체).
DeepL only 는 법적 정확성 보증 못 함 (P3 정직성 위반 위험). Hybrid 가
4.5.j.4.A.1 패턴(DeepL + var-protection + 사후 보정) 의 legal 확장 —
실측된 패턴 재사용. ko/en 4.12.f 1차 검수 동형 (다크패턴 0 / Art.13 정합)
가 이미 검증된 검수 기법.

### D2. `legal.affiliateDisclosure.pageTitle` 4 locale 회귀 = 본 라운드 포함

ko/en/nl/fr 모두 `"제휴 수수료 공개"` 한국어로 고정됨. ko 정본 외 3
locale 은 *완성 표시되었으나 실은 한국어 미번역*. 본 라운드 DeepL retarget
범위에 *포함* (D1) — legal 검수도 이 키 4 locale 정합 확인.

### D3. interstitial 페이지 = 4.5.j.4.B 트랙 (4.5.j.3 *밖*)

D.9 §부수 발견 진단을 *정정*:

- D.9 §부수 발견 표현: "fr-BE interstitial 한국어 노출 → 4.5.j.3 잔여"
- **정정**: interstitial 페이지는 `legal.*` 키를 0건 소비 = page-level
  하드코딩 한국어 → **4.5.j.4.B 트랙** (보조 페이지 비-legal UI 셸 i18n).
  본 페이지 PLAN 4.5.j.4.B 대상 명시: "`go/[shortId]/[itemId]/page.tsx`
  비-legal UI 셸". `legal.*` 네임스페이스 = 동의 인터스티셜 *본문 자체*
  ≠ 페이지 셸 (헤딩/CTA/카피).
- **경계 잠금** (architect): interstitial 본문에 `legal.cookie.*` /
  `legal.terms.*` / `legal.privacy.*` 키 *직접 호출 0* (별도 페이지
  본문). interstitial 자체 카피 (consent 5항목 / Visual Interference 0
  버튼 / VI.99 랭킹) = 일반 UI 트랙 (`go.*` 네임스페이스 신설 또는
  `compare.*` 확장 — 4.5.j.4.B builder 결정). 본 ADR 는 *경계만* 확정;
  interstitial 코드 변경 0 (4.5.j.4.B 별 라운드).
- **4.5.j.4.B architect 잠금 (2026-06-05, PLAN 라인 1689 후속)**:
  네임스페이스 결정 = **`affiliateInterstitial.*` 신설** (별도 명명, `go.*`
  는 URL 경로 직역 = 의미 부족, `compare.*` 확장은 비교 결과 본문과 혼동
  위험 — affiliate consent UI 셸 의미 명시). 신규 키 ≈ 25 ("이동 전 확인
  사항" / "받는 회사" / "Slim 기록 목적" / "데이터 흐름" / "동의 철회" / Art.13
  본문 3 + freely given 카피 + 동의/거부 버튼 + 비교 결과 복귀). 4.5.j.4.B.4
  DeepL retarget 완료 후 *법적 함의 본문* (EDPB Guidelines 05/2020 5항목 /
  GDPR Art.13 정보 제공 / freely given) = **legal 에이전트 1차 cross-ref
  권고** (별도 게이트 외, `legal.*` 가 아니므로 운영자 판단 trigger).
  Critical/Major 0 권장. 외부 변호사 €800 = 본 라운드 *밖* (운영자 트랙,
  D4 동일).
- **4.6 organic SEO 진입 영향**: D.9 §부수 발견은 "4.6 진입 *전* 해소
  권장" 신호. 본 ADR D3 = "이 신호는 *4.5.j.3 가 아니라 4.5.j.4.B 로*
  해소" 라는 *경로 정정*. 4.6 진입 전 양 트랙 (4.5.j.3 + 4.5.j.4.B) 동시
  완료가 fr 거주 사용자 P3 정직성 갭 해소의 필요조건. 본 ADR 은
  4.5.j.4.B 우선순위에 영향 주지 않음 (별 트랙 — ADR-0033 §A2.8 부모
  결정).

### D4. legal 1차 검수 vs 외부 변호사 감사 분리 (재확인)

- **본 라운드 1차 검수** = legal 에이전트 (Slim 서브에이전트). Critical/
  Major 0 통과 시 4.5.j.3 `[x]` + 4.12.f §미해결 #4 nl/fr placeholder 항목
  도 동시 해소 (검수 통과 = `[~]` → `[x]` 가능성).
- **외부 변호사 감사 €800** = 운영자 트랙. *수익 후 / 베타 직전* trigger
  (4.12.f §미해결 본문 그대로). 본 ADR 가 외부 감사 진입 결정 *하지 않는다*.
- 4.12 부모 `[~]` → `[x]` 격상은 4.12.f 자체 검수 완료 + 외부 변호사 감사
  완료 둘 다 필요한가? 운영자 결정 영역 — 본 ADR 는 *4.5.j.3 트랙* 완결만
  결정. 4.12 격상은 cross-ref 신호만 (운영자 결정).

### D5. var-protection.ts = 본 라운드 적용 *불요*

`legal.*` 본문 ICU 변수 0건 실증 (위 정찰). 4.5.j.4.A.1 의 `{providerName}`
/ `{amount}` 같은 변수 보호 필요 없음. translate.mjs 호출 시 var-protection
파이프 비활성 / 또는 활성 (no-op — pass-through) 둘 다 안전.

## 대안

- **A. 수동 번역 only (DeepL 거부)** — 법적 정확성 보장 최대. 단 분량
  비현실적 (~7,800 chars 3 locale), 솔로 학습 중 환경에서 4.5.j.3 무기한
  지연 → 4.6 진입 차단 + fr 거주 사용자 P3 갭 지속. **거부**.
- **B. DeepL only (legal 검수 생략)** — 자동화 최대. P3 정직성 +
  legal 부채 우선 원칙 위반 (CLAUDE.md §3 P5 / §8 #6 / ADR-0033 §T4).
  **거부**.
- **C. interstitial 을 4.5.j.3 트랙으로 흡수** — D.9 §부수 발견 표현 그대로.
  단 코드 사실은 interstitial 본문이 `legal.*` 키 소비 0 = 4.5.j.4.B
  명시 대상 → 트랙 침범 (i18n 컴포넌트 마이그레이션 vs legal 네임스페이스
  검수는 다른 작업 성격). 4.5.j.4 §A2.8.3 envelope 침범. **거부**.

## 결과

- ✅ `legal.*` 81 키 × 3 locale (nl/fr/en) placeholder 0 + legal 1차 검수
  통과 → 4.5.j.3 `[x]` + 4.12.f §미해결 #4 동시 해소 신호.
- ✅ 4.6 organic SEO 진입 전 P3 정직성 갭의 *legal 트랙* 부분 해소
  (interstitial 트랙은 4.5.j.4.B 동시 진행 권고).
- ✅ DeepL 누적 ~20,400 chars / 1,000,000 (2.1%) — €300 운영 예산 영향 0
  (DeepL Free 유지).
- ⚠️ 외부 변호사 €800 감사 = 운영자 트랙 유지 (수익 후 / 베타 직전) —
  legal 1차 검수만으로 4.12 부모 `[x]` 격상 = 운영자 결정 영역.
- ⚠️ interstitial 한국어 노출 = 4.5.j.4.B 미완료 시 fr 거주 사용자 P3
  갭 지속 — 본 ADR D3 가 *책임 위임만* 명시 (해소는 별 트랙).

## 검증 방법

- (1) DeepL retarget 실행 후 `legal.*` prefix 0 (`grep -P "\\[nl\\]|\\[fr\\]|\\[en\\]" messages/{nl,fr,en}.json` → 0 매치).
- (2) `legal.affiliateDisclosure.pageTitle` 4 locale ≠ `"제휴 수수료 공개"` (한국어 잔존 0).
- (3) legal 에이전트 1차 검수 — 본문 자체 Critical/Major 0:
  - GDPR Art.13 §1·§2 12항목 의미 보존
  - 다크패턴 0 (Accept ↔ Refuse 동등 비중)
  - Art.6(1)(b) 동의 간주 nl/fr 표현 정합
  - 감독기관 4종 (APD/GBA/AP/CNPD) 공식 명칭 정합
- (4) `pnpm typecheck` / `pnpm lint` / `pnpm test:run` 0 + `harness:i18n`
  GREEN 유지 + `harness:plan` 92 불변 + `harness:data` 정합.
- (5) ko 정본 ↔ nl/fr/en 키 셋 정합 (누락 0).
- (6) ICU 변수 ko ↔ nl/fr/en 정합 = vacuous (legal.* 본문 변수 0건).
- (7) interstitial 페이지 한국어 = 본 ADR 검증 *대상 아님* (4.5.j.4.B).

## 부수 — D.9 §부수 발견 정정 기록

D.9 §부수 발견 (2026-06-05) 의 "4.5.j.3 우선순위 격상 신호" 표현은 본
ADR D3 로 *경로 정정*:

- 신호 그대로: fr-BE interstitial 한국어 노출 = fr 거주 사용자 P3 정직성 갭.
- 정정: 해소 트랙 = 4.5.j.3 (`legal.*` 검수) + 4.5.j.4.B (interstitial 페이지
  i18n) **양 트랙 동시**. D.9 표현은 후자를 전자로 흡수 분류한 것 = 사실
  오류. 4.6 진입 전 P3 갭 해소 = 두 트랙 *모두* 완료 = 필요조건.

본 정정은 D.9 (이미 `[x]`) 자체에는 영향 0 (별도 트랙 발견 표현만 정정).
