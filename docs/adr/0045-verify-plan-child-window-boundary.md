# ADR-0045: verify-plan 부모 expectedFiles 추출 — 자식 윈도우 경계 정정

## 상태

**Accepted** (2026-06-09, architect — PLAN 4.12/4.16/4.17 3개 부모 동시 [x]
격상 라운드).

옵션 C 잠금: B4 (자식 항목 진입 시 부모 윈도우 종료) **+** A 부분 (PLAN 본문
symbolic placeholder 1건 평문화). 운영자 디폴트 추천 잠금.

## 맥락 (Context)

### 트리거 — 4.12 / 4.16 / 4.17 3개 부모 동시 [~] 정체

세 부모 항목 모두 *자식 a~e (또는 a~f) 전부 [x]* 잠금 완료 상태이나
**부모 [x] 격상 시 `pnpm harness:plan` 위반 발화**로 [~] 유지 중. 위반의
공통 원인 = 자식 본문에 등장하는 백틱 path-like 표현이 `verify-plan.ts:59-67`
의 *부모 윈도우 추출* (i+1 ~ i+8 라인) 안에 들어와 부모의 `expectedFiles`
배열에 누적되기 때문.

| 부모 | 자식 본문 path-like (백틱) | 실 fs 매칭 | 위반 룰 |
|---|---|---|---|
| 4.12 | `page.test.tsx` (4.12.a basename only), `messages/{ko,nl,fr,en}.json` (4.12.d brace expansion) | ❌ basename 만 / ❌ brace literal | `completed-but-missing` × 2 |
| 4.16 | `src/app/[locale]/compare/[category]/postal/{page,layout}.tsx` (4.16.b brace, 라우트 삭제됨), `comparison-input.test.ts` (4.16.c basename), `CarrierAvailabilityNotice.test.tsx` (4.16.d basename) | ❌ × 3 | `completed-but-missing` × 3 |
| 4.17 | `src/app/[locale]/compare/[category]/STEP/page.tsx` (Rule (i) 명세 본문 — STEP = placeholder) | ❌ literal STEP 디렉토리 부재 | `completed-but-missing` × 1 |

자가-모순 = **4.17 자체가 verifier 룰 강화 ADR (ADR-0044) 라운드**.
verifier 룰 미세조정이 *동일 verifier family 의 다른 룰* (verify-plan) 에
의해 부모 [x] 격상이 막히는 패턴. ADR-0044 §V2 "현 main HEAD GREEN" 자체는
GREEN 유지하나, 4.17 부모 자체가 [x] 가 못 되는 회귀 = ADR-0044 운영
직후 발화한 인접 게이트 버그.

### 5단 게이트 / verify-plan 룰의 현 동작 추적

`scripts/harness/verify-plan.ts` 부모 항목 파싱:

```ts
const itemRe = /^- \[([ x~!])\] \*\*([A-Z]\.\d+|\d+(?:\.[A-Za-z0-9]+)*)\*\* (.+)$/;
const fileRe = /`([^`\s][^`]*\.(?:ts|tsx|js|jsx|sql|md))`/g;

for (let i = 0; i < lines.length; i++) {
  if (!line.match(itemRe)) continue;
  // 다음 인덴트 라인에서 파일 경로 추출
  for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
    if (!subLine.startsWith('  ')) break;
    while ((fm = fileRe.exec(subLine)) !== null) {
      item.expectedFiles!.push(fm[1]);
    }
  }
}
```

**버그 진단**: `j` 루프는 부모 라인 직후 *최대 7라인* (`i+1 ~ i+7`,
upper bound exclusive) 의 인덴트 라인 전체를 부모 expectedFiles로 흡수한다.
*자식 [x] 라인 자체* (`  - [x] **4.16.b** ...`) 도 2칸 인덴트로 시작
→ `startsWith('  ')` 패스 → 자식 본문의 백틱이 *부모* expectedFiles에
편입된다. **자식 본문 책임이 부모로 누수**.

### 회귀 5건 시뮬레이션 (4.16 사례)

4.16 부모 = 라인 2199. 윈도우 j-범위 = 라인 2200~2207 (1-indexed, inclusive).

| 라인 | 내용 | path-like | 누가 책임 |
|---|---|---|---|
| 2200 | 부모 "왜" 본문 | `ADR-0034 Amd 1 D4` 등 외부 링크 (마크다운 `[]()` 형식 — 백틱 X) | 부모 ✅ |
| 2201 | 부모 "결정 영역" | 0 | — |
| 2202 | 부모 "사이즈 추정" | 0 | — |
| 2203 | `- sub-task 분해:` | 0 | — |
| 2204 | **자식 4.16.a** `[x]` | `0043-...md`, `0016-...md` | **자식 책임** ❌ 부모로 누수 |
| 2205 | **자식 4.16.b** `[x]` | `postal/{page,layout}.tsx`, comparison-input.ts, ... | **자식 책임** ❌ 부모로 누수 (postal brace 부재) |
| 2206 | **자식 4.16.c** `[x]` | `comparison-input.test.ts` basename | **자식 책임** ❌ 부모로 누수 |
| 2207 | **자식 4.16.d** `[x]` | `CarrierAvailabilityNotice.tsx`, `CarrierAvailabilityNotice.test.tsx` basename | **자식 책임** ❌ 부모로 누수 |

부모 [x] 격상 시 → 자식 본문 부재 3건 (`postal/{page,layout}.tsx` brace
+ `comparison-input.test.ts` basename + `CarrierAvailabilityNotice.test.tsx`
basename) 이 부모 expectedFiles 에 흡수 → `completed-but-missing` × 3.

자식 4.16.a/b/c/d 각각이 *자식 자신의 [x]* 격상 시점에 *자식 본문* 의
expectedFiles 가 검증되었어야 옳음. (자식이 모두 [x] 인 현 상태 = 자식 본문
expectedFiles 가 *자식 윈도우 추출 시* 이미 PASS 한 거짓 보장 — 실은 4.16.b
자식은 추출 시 brace 표현이 동일한 룰로 부재 처리됐을 텐데도 어떻게
자식이 [x] 가 되었는가? → 자식 라인 자체가 itemRe 의 첫 매치 → 그 자식
의 j-루프 [i+1, i+8) 가 *그 다음 라인부터* 시작 → **자식 자체 본문 라인은
자식의 expectedFiles 로 들어가지 *않는다***. 즉 부모 윈도우에선 자식 본문
누수, 자식 윈도우에선 자식 본문 *비추출*. 양쪽 다 false-negative + 부모만
false-positive.).

근본 원인 = `verify-plan.ts:59` `for (let j = i + 1; j < Math.min(i + 8, ...))`
가 **다음 itemRe 매치 라인을 윈도우 종료 조건으로 인식하지 못함**.

### 운영 제약 (헌법 정합)

- §3 P4 (Type-safe): 룰 정정 = tsc 정합 + `any` 0
- §3 P5 (ADR): 본 결정 = verifier 헌법 룰 정정 = ADR 신설 정합
- §4 작업 흐름: harness:plan 자체 정정 = 4.17 동형 verifier 룰 라운드
- 운영자 €300/월 cap + 솔로 사이드: *간단·정확* — 본문 우회 (옵션 A) 의
  영구 인지 부담 회피
- ADR-0044 D2 (정규식+glob 정적 스캔): 본 결정도 동일 패턴 유지 (룰 변경
  국소, 외부 deps 0)
- ADR-0025 (verifier read-only): harness 자체 코드 변경 = builder 라운드
  (verifier 직접 작성 금지)

## 결정 (Decision)

### D1. 옵션 C 잠금 — B4 (자식 윈도우 경계) + A 부분 (STEP placeholder 평문화)

#### 옵션 비교 매트릭스

| 옵션 | 변경 영역 | 회귀 risk | 미래 인지 부담 |
|---|---|---|---|
| **A** 본문 path-like 표현 우회 | PLAN.md 본문 3 부모 영역 라인 ≈ 5건 | 0 (룰 무변경) | **영구** — 매 ADR/PLAN 라운드 architect/builder 가 백틱 회피 |
| **B** verify-plan.ts 룰 갱신 | scripts/harness/verify-plan.ts j-루프 종료 조건 | 중 (기존 [x] 항목 회귀 검증 필요) | 0 (룰이 책임) |
| **C** B4 핵심 + A 부분 ★ | verify-plan.ts j-루프 1줄 + 4.17 본문 1건 평문 | 저 (B4 = 의미론적으로 정확, 자식 윈도우는 자식이 책임) | ≈ 0 (B4 가 자식 영역 자동 흡수, A 부분 = 1회 본문 정정) |

**채택 = C**. 사유:
1. **의미론적 정확성**: 부모 expectedFiles 는 부모 본문 책임, 자식
   expectedFiles 는 자식 본문 책임. 현 룰은 부모 윈도우에 자식 본문이
   *누수* — 책임 경계 위반. B4 = 책임 경계 복원.
2. **회귀 risk 최소**: B4 = j-루프 종료 조건 1줄 추가 (`itemRe.test(subLine) → break`).
   기존 자식 본문이 itemRe 와 무관하게 부모 expectedFiles 에 들어왔다면
   이는 *원래 자식 책임이 부모로 잘못 흡수된 케이스* = 본 정정이 false-positive
   회복. 진짜 부모 본문 (윈도우 내 비-itemRe 라인) 의 expectedFiles 는 보존.
3. **운영 비용 0**: 새 의존성 0, 새 알고리즘 0, j-루프 종료 조건 1줄.
4. **A 부분 (4.17 STEP placeholder)**: B4 만으로 cover 못 함 (윈도우 i+1~i+7 안에
   부모 본문 자체에 symbolic STEP 등장, 자식 라인 진입 전). 본문 평문화
   1건 = 영구 비용 1회. 미래 symbolic placeholder 패턴은 일반화하지 않고
   case-by-case 평문화 ADR 트리거.

#### 거부 사유

- **옵션 A (전체 우회)**: 운영자가 *룰 회피 본문 패턴* 을 매 PLAN/ADR
  라운드에서 학습 + 적용 = §3 P3 "투명성은 운영자의 짐" 의 오용 (P3 은
  사용자 대 운영자 책임이지, *룰 회피 부담* 을 운영자에 떠넘기는 정합 X).
  €300/월 cap + 솔로 사이드 = 매번 본문 작성 시 인지 비용 누적 = 미래 비용
  > B4 1회 룰 정정.
- **옵션 B (B1 ALL_CAPS placeholder 정규식 추가)**: STEP/CATEGORY 외 미래
  소문자 placeholder 패턴 미커버. 패턴 일반화 = 룰 복잡도 ↑ + false-negative
  risk (진짜 부재 파일 통과). A 부분 평문화 1회로 회피.
- **옵션 B (B3 단독 basename glob 폴백)**: 단독 `page.test.tsx` 가
  `src/**/page.test.tsx` 글로벌 검색 시 무관 파일에 매치 = false-positive
  회복이 거짓. 운영자 의도 = "이 자식 본문에서 만든 *그* page.test.tsx"
  = 자식이 책임져야 옳음 = B4 로 cover.

### D2. B4 룰 명세 — j-루프 종료 조건

`scripts/harness/verify-plan.ts:59-67` j-루프 안에 **`itemRe.test(subLine) → break`**
1줄 추가.

```ts
// 다음 인덴트 라인에서 파일 경로 추출
for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
  const subLine = lines[j];
  if (!subLine || !subLine.startsWith('  ')) break;
  // ADR-0045 D2 — 자식 [x] 라인 진입 시 부모 윈도우 종료.
  // 부모 expectedFiles 는 부모 본문 책임, 자식 본문은 자식이 책임.
  if (itemRe.test(subLine)) break;
  let fm;
  while ((fm = fileRe.exec(subLine)) !== null) {
    if (fm[1] !== undefined) item.expectedFiles!.push(fm[1]);
  }
}
```

**i+8 boundary 보존**: 자식 라인이 윈도우 내에 없는 부모 (예: 부모 본문이
8라인 미만 + sub-task 분해 헤더 인덴트만) 케이스는 i+8 boundary 가 자연
종료. itemRe break 가 *조기* 종료만 추가.

**fileRe 정규식 보존**: itemRe break 는 라인 단위. 라인 안 백틱 추출은
무변경. ADR-0044 §D2 cross-ref (정규식+glob 패턴 유지).

### D3. A 부분 — 4.17 본문 symbolic STEP/page.tsx 평문화

PLAN.md 4.17 부모 본문 라인 2217 (Rule (i) 명세):

**현**:
```
**탐지 패턴**: `Link href={...}` ... 가 `src/app/[locale]/compare/[category]/STEP/page.tsx` 또는 `redirect()` 매핑에 실 존재하는지 검증.
```

**갱신**:
```
**탐지 패턴**: `Link href={...}` ... 가 `src/app/[locale]/compare/[category]/<step>/page.tsx` 라우트 파일 (`<step>` ∈ STEPS 단일 출처) 또는 `redirect()` 매핑에 실 존재하는지 검증.
```

`STEP` (백틱 안 ALL_CAPS placeholder) → `<step>` (백틱 안 angle bracket
placeholder, fileRe 매치 X). 룰 (i) 의미 보존 + ADR-0044 본문 정합 유지.

ADR-0044 본문 라인 (`STEP/page.tsx`) 도 동일 평문화 — D3 의 본문 변경
영역 cross-ref.

### D4. 4.16.e 일치 정정 — `[ ] → [x]`

PLAN.md 라인 2208 4.16.e 현 `[ ]` (미체크). 4.16 부모 본문 (라인 2199)
"4.16.a~e 전부 [x] (2026-06-08)" 표기 ↔ 실 자식 마크 4.16.e `[ ]` 불일치.
PR #47 머지 후 4.16.e (게이트 + PR) DoD 사실상 충족 (PR #47 squash 머지
+ slim.lu prod 실측 PASS, 라인 2199 부모 본문에 실측 결과 기록됨). 본
ADR-0045 라운드에서 일치 정정 = 자식 [x] 격상.

### D5. 부모 3개 [x] 격상 = 별 builder 라운드 (4.x.b 동형)

본 ADR-0045 라운드 = **architect 산출물 (ADR + PLAN 본문 일부) 만**. 실
`verify-plan.ts` 룰 변경 + 부모 3개 [x] 격상 commit = **builder 4.x.b 라운드**
(가칭 4.17.e 또는 별 PLAN 항목 — 운영자 결정 영역 §Q1).

사유:
- 룰 변경 = `scripts/harness/verify-plan.ts` 의 핵심 j-루프 = 회귀 risk →
  단위 테스트 추가 + 기존 모든 [x] 항목 회귀 0 확인 필요 = builder 적합
- 부모 [x] 격상 commit 은 룰 변경 + 본문 변경 + 게이트 통과 후 동반 시점
- ADR-0025 verifier read-only 정합 (architect 도 harness 코드 직접 수정 X,
  명세만)

## 대안 (Rejected Alternatives)

### Rej-1. 옵션 A 단독 (전체 본문 우회)

거부 사유: D1 §거부 사유 참조. 영구 인지 부담 + 솔로 운영자 정합 위반.

### Rej-2. 옵션 B1 (ALL_CAPS placeholder 정규식)

거부 사유: D1 §거부 사유 참조. 일반화 = false-negative risk.

### Rej-3. 옵션 B3 (단독 basename glob 폴백)

거부 사유: D1 §거부 사유 참조. 자식 책임 위양 + glob 무관 파일 false-positive.

### Rej-4. ADR-0044 Amendment 1 (신설 ADR 0045 X)

거부 사유: ADR-0044 = `verify-cross-ref` harness 신설/룰 3종 = **다른
harness family**. 본 결정 = `verify-plan` j-루프 정정. ADR-0044 의 기존
Amendment 트리거 4종 (Amd 1 ts-morph 격상 / Amd 2 카테고리 확장 / Amd 3
e2e CI / Amd 4 dev 사이클 cost) 모두 `verify-cross-ref` 룰 자체 격상/확장.
별 ADR 신설 = ADR family 책임 경계 정확.

### Rej-5. harness:plan 부모 윈도우 i+8 → 동적 확장 (자식 첫 등장까지)

거부 사유: 부모 본문이 매우 긴 일부 케이스 (4.13 hero 5블록 본문 ≈ 50줄
서브-인덴트 무관) 에 false-positive 부담. i+8 boundary = 정상 패턴 cap
보존 + itemRe break = 자식 조기 종료 = 양쪽 cover.

## 결과 (Consequences)

### ✅ 얻는 것

1. **부모 [x] 격상 = 자식 [x] 전수 + 부모 본문 expectedFiles 일치** 의미론
   정확. 4.12/4.16/4.17 3개 부모 동시 [x] 격상 잠금.
2. **운영자 인지 부담 0 (영구)** — 미래 PLAN 본문 작성 시 백틱 path-like
   회피 룰 불요. 자식이 자식 본문 책임, 부모가 부모 본문 책임.
3. **회귀 risk 최소** — j-루프 종료 조건 1줄 + 본문 1건 평문화.
4. **ADR-0044 자가-모순 해소** — verifier 룰 강화 ADR 의 부모 [x] 격상이
   인접 verifier 룰에 막힌 패턴 봉합.

### ⚠️ 잃는 것 / 부채

1. **자식 본문 expectedFiles 검증 영구 비활성** — 자식 윈도우 추출이 *자식
   자신 라인 다음부터* 이므로 자식 자체 본문은 자식 expectedFiles 에 들어가지
   않음 (현 동작 + 본 ADR 무변경). 자식 본문 부재 파일은 *부모도 검증 안 함*
   (B4) + *자식도 검증 안 함* = **자식 본문 path-like = 시각 문서 only**.
   운영자 신호: 자식 본문 path-like 정확성은 architect/builder 작성 시점
   책임 (코드 리뷰 격) + Vercel 실측 PASS 가 봉합. 본 결정 = 게이트 자체에
   서 자식 본문 매칭 비강제 + 실 코드 존재는 자식 [x] 마크 시점 verifier
   판단.
2. **`<step>` placeholder 표기 확산 위험** — 미래 ADR/PLAN 본문에 symbolic
   path 가 또 등장 시 `<...>` 평문화 회피 룰 인지 필요. ADR-0044 §룰 명세
   본문 1건 + 본 ADR §D3 4.17 본문 1건만 현재 영향. 다음 발생 시 ADR
   Amendment 트리거.
3. **i+8 boundary cap 유지** — 부모 본문이 8라인 초과 시 expectedFiles
   누락 가능 (현 동작 부채). 본 ADR scope 밖, 별 ADR 트리거 (D5 cross-ref).

## 검증 방법 (Verification)

### V1. 4.12 / 4.16 / 4.17 3개 부모 [x] 격상 시 `harness:plan` GREEN

builder 4.x.b 라운드 머지 후 `pnpm harness:plan` 실행 → 0 위반 + 합계
표 (총계/완료) 자동 갱신 (97 → 100 잠금, 또는 합계 표 갱신 정합).

### V2. 기존 [x] 항목 회귀 0

builder 4.x.b 라운드에서 **모든 기존 [x] 부모/자식의 expectedFiles 회귀
0** 확인. 본 D2 룰 정정 (itemRe break) 이 기존 부모 윈도우 expectedFiles
에서 *진짜 부모 본문* (윈도우 내 비-itemRe 라인) 의 백틱은 보존하는지
검증.

회귀 검증 매트릭스 (builder 추가 책임):

| 부모 ID | 윈도우 내 부모 본문 백틱 (기존) | 룰 정정 후 유지 |
|---|---|---|
| 4.13 | `ADR-0041` 본문 백틱 0 (마크다운 링크) | ✅ |
| 4.14 | 부모 본문 path-like 0 | ✅ |
| 4.15 | 부모 본문 path-like 0 | ✅ |
| 그 외 페이즈 0~3 부모 | 자식 라인 진입 전까지 부모 expectedFiles 보존 | builder 회귀 |

### V3. ADR-0044 §V2 (현 main HEAD `harness:cross-ref` GREEN) 회귀 0

본 ADR 룰 변경은 `verify-plan.ts` 한정. ADR-0044 `verify-cross-ref` 영향 0.

### V4. ADR-INDEX 신설 + PLAN cross-ref 정합

`docs/adr/INDEX.md` 본 ADR 0045 행 추가 + PLAN 4.12/4.16/4.17 본문
ADR-0045 cross-ref 1줄 (부모 [x] 격상 사유 = ADR-0045 D1~D5) + `pnpm
harness:plan` GREEN 유지.

## Cross-ref

- **ADR-0002** (Build gate ownership) — 본 ADR 은 verify-plan 룰 정정 =
  Build gate 의 일부. 5단/6단 게이트 family 안 룰 미세조정.
- **ADR-0025** (verifier read-only) — architect 도 harness 코드 직접 수정
  X (명세 only). 룰 구현 = builder 라운드.
- **ADR-0044** (verifier cross-ref 룰 3종) — 본 ADR 은 ADR-0044 와 *다른
  harness* (verify-plan vs verify-cross-ref). 단 4.17 부모 본문 STEP
  placeholder 평문화 1건 = ADR-0044 본문 정합 유지 (D3 cross-ref).
- **ADR-0034 D2** (통신 BE 한정) — 본 ADR 룰 범위 = PLAN.md 전수, 카테고리
  무관. ADR-0034 정합 영향 0.
- **PLAN 4.12 / 4.16 / 4.17** — 본 ADR 의 PLAN 본문 잠금 (3개 부모 [x]
  격상 사유).

## Amendment 트리거 (미래)

- **Amd 1 트리거**: 본 D2 룰 정정 후에도 부모/자식 expectedFiles 누수 패턴
  재발견 시 → ts-morph AST 격상 (ADR-0044 §Amd 1 트리거 정합).
- **Amd 2 트리거**: i+8 boundary cap 초과 부모 본문 (≥ 8라인) 의
  expectedFiles 누락 패턴 발화 시 → 동적 윈도우 확장 룰 검토.
- **Amd 3 트리거**: 자식 본문 expectedFiles 검증 강제 신호 (자식 본문 부재
  파일이 [x] 통과하는 운영 사고 발화) 시 → 자식 윈도우도 동일 j-루프 적용
  ADR Amendment.
- **Amd 4 트리거**: `<step>`/`<placeholder>` 표기 패턴이 3건 이상 누적 시 →
  fileRe 정규식 `<...>` 명시 제외 룰 일반화 ADR Amendment.

## 운영자 결정 영역 (Q1, 잠금 완료)

- **Q1** — 본 ADR 라운드 = architect 산출물 (ADR + PLAN 본문 일부)
  vs architect 직접 룰 구현 + 부모 [x] 격상.
  - 옵션 (가) ★ architect = ADR + 본문 평문화 + 4.16.e 정정 만, 룰 구현
    + 부모 [x] 격상 = builder 4.x.b (ADR-0025 verifier read-only 정합 +
    회귀 검증 격상)
  - 옵션 (나) architect 직접 룰 + 부모 [x] 격상 (소규모 1줄 변경 한정)
  - **architect 디폴트 추천 = (가)**. 사유: V2 회귀 검증 매트릭스 (기존
    [x] 항목 전수 회귀 0 확인) = builder 라운드 격이 안전. 운영자
    변경 신호 시 (나) 채택 가능.
