/**
 * verify-plan.ts 단위 테스트
 *
 * ADR-0045 §V1 회귀 시뮬레이션 — 4.12 / 4.16 / 4.17 부모 [x] 격상 시
 * j-루프 childItemRe break 가 자식 본문 누수를 차단하는지 검증.
 *
 * 픽스처 = 인-메모리 string (fs 부재).
 * parsePlanText 단독 export 로 직접 검증.
 *
 * 주의: itemRe 는 `^- \[` (행 시작 하이픈) 으로 시작. 자식 라인은
 * `  - [x] **4.12.a** ...` 형태로 인덴트 선행 → itemRe 에 매치 안 됨.
 * 따라서 parsePlanText 결과에 자식 항목은 포함되지 않는다.
 * 테스트 대상 = **부모 expectedFiles 에 자식 본문 경로가 누수되지 않는지** 확인.
 */

import { describe, it, expect } from 'vitest';
import { parsePlanText } from './verify-plan';

// ---------------------------------------------------------------------------
// 픽스처 1: 4.12 동형 — 자식 본문 `page.test.tsx` + brace expansion 누수 방지
// 부모 라인 직후 즉시 자식 항목이 등장 (왜/결정 설명 없음).
// ---------------------------------------------------------------------------
const FIXTURE_4_12 = `
- [x] **4.12** 공개 법적 페이지 — 자식 전부 [x] (ADR-0045 §D2 격상).
  - [x] **4.12.a** \`src/app/[locale]/legal/terms/page.tsx\` 신설. 테스트 \`page.test.tsx\`.
  - [x] **4.12.b** 추가 내용. 다른 파일 없음.
  - [x] **4.12.d** 링크 정합. \`messages/{ko,nl,fr,en}.json\` brace expansion.
`.trim();

// ---------------------------------------------------------------------------
// 픽스처 2: 4.16 동형 — postal brace + 단독 .test.{ts,tsx} 누수 방지
// ---------------------------------------------------------------------------
const FIXTURE_4_16 = `
- [x] **4.16** 통신 흐름 ZIP 단계 제거.
  - [x] **4.16.b** 라우트 삭제. \`src/app/[locale]/compare/[category]/postal/{page,layout}.tsx\`. \`comparison-input.test.ts\`.
  - [x] **4.16.c** 데이터 모델 보존. \`comparison-input.test.ts\`.
  - [x] **4.16.d** caveats RSC 신설. \`CarrierAvailabilityNotice.test.tsx\`.
`.trim();

// ---------------------------------------------------------------------------
// 픽스처 3: 4.17 동형
// - 부모 j-loop 범위 (i+1 ~ i+7) 에 자식 항목 등장 전 인덴트 본문 라인이 있고
//   그 안에 실제 존재 파일 경로가 있다.
// - 자식 이후 라인 경로 (`e2e-ci-diagnosis.md`) 는 누수 0.
// ---------------------------------------------------------------------------
const FIXTURE_4_17 = `
- [x] **4.17** verifier 룰 강화.
  - 왜: 설명 라인 (파일명 없음).
  - 룰 3종: \`src/app/[locale]/compare/[category]/current-provider/page.tsx\` 존재.
  - [x] **4.17.a** architect — \`docs/adr/0044-verifier-cross-ref-rules.md\`.
  - [x] **4.17.c** verifier — \`docs/runbook/e2e-ci-diagnosis.md\`.
`.trim();

// ---------------------------------------------------------------------------
// 픽스처 4: 부모 본문 expectedFiles 보존 — 자식 등장 전 인덴트 라인의 경로는 부모 책임
// ---------------------------------------------------------------------------
const FIXTURE_PARENT_FILES = `
- [x] **1.7** Fetcher 인터페이스.
  - 부모 본문: \`src/fetchers/types.ts\` 신설 (파일 존재 보장).
  - [x] **1.7.a** 자식 — \`src/fetchers/other.ts\`.
`.trim();

// ---------------------------------------------------------------------------
// 픽스처 5: 자식 없는 단순 항목 — 인덴트 경로 정상 추출
// ---------------------------------------------------------------------------
const FIXTURE_SIMPLE = `
- [x] **1.1** 기본 항목. 설명만.
  - 본문 설명: \`src/simple/file.ts\` 존재.
- [x] **1.2** 두 번째 항목.
`.trim();

// ---------------------------------------------------------------------------
// 테스트 그룹
// ---------------------------------------------------------------------------

describe('parsePlanText — ADR-0045 §D2 회귀 방지', () => {
  // -------------------------------------------------------------------------
  // Case 1: 4.12 동형 — 자식 본문 단독명 + brace expansion 부모 누수 0
  // -------------------------------------------------------------------------
  it('4.12 동형: 자식 본문 백틱이 부모 expectedFiles 에 누수되지 않는다', () => {
    const items = parsePlanText(FIXTURE_4_12);
    const parent = items.find((i) => i.id === '4.12');
    expect(parent).toBeDefined();
    expect(parent!.status).toBe('x');
    // 부모 j-loop 는 i+1 부터 시작 — 첫 인덴트 라인이 이미 자식 항목
    // (`  - [x] **4.12.a** ...`) 이므로 childItemRe.test() 에서 즉시 break.
    // → 부모 expectedFiles 는 빈 배열.
    expect(parent!.expectedFiles).toHaveLength(0);
    // `page.test.tsx` 단독명과 brace expression 이 부모에 없음 명시 검증.
    const parentFiles = parent!.expectedFiles ?? [];
    expect(parentFiles.some((f) => f.includes('page.test.tsx'))).toBe(false);
    expect(parentFiles.some((f) => f.includes('messages'))).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Case 2: 4.16 동형 — postal brace + 단독 .test.ts 누수 0
  // -------------------------------------------------------------------------
  it('4.16 동형: postal brace + 단독 .test.ts 표현이 부모 expectedFiles 에 누수되지 않는다', () => {
    const items = parsePlanText(FIXTURE_4_16);
    const parent = items.find((i) => i.id === '4.16');
    expect(parent).toBeDefined();
    expect(parent!.status).toBe('x');
    // 부모 인덴트 첫 줄이 자식 4.16.b 항목이므로 즉시 break.
    expect(parent!.expectedFiles).toHaveLength(0);
    // brace / basename 표현이 부모 expectedFiles 에 없음을 명시 검증.
    const parentFiles = parent!.expectedFiles ?? [];
    expect(parentFiles.some((f) => f.includes('postal'))).toBe(false);
    expect(parentFiles.some((f) => f.includes('comparison-input.test.ts'))).toBe(false);
    expect(parentFiles.some((f) => f.includes('CarrierAvailabilityNotice.test.tsx'))).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Case 3: 4.17 동형 — 자식 항목 등장 후 경로 누수 0, 등장 전 경로 추출
  // -------------------------------------------------------------------------
  it('4.17 동형: 자식 항목 등장 전 인덴트 경로는 추출, 등장 후 경로는 누수 없음', () => {
    const items = parsePlanText(FIXTURE_4_17);
    const parent = items.find((i) => i.id === '4.17');
    expect(parent).toBeDefined();
    expect(parent!.status).toBe('x');
    const parentFiles = parent!.expectedFiles ?? [];
    // 자식 등장 전 인덴트 라인 ("룰 3종:" 라인) 의 current-provider/page.tsx 는 추출됨.
    expect(parentFiles).toContain('src/app/[locale]/compare/[category]/current-provider/page.tsx');
    // 자식 이후 라인 경로 (e2e-ci-diagnosis.md) 는 부모 expectedFiles 에 없어야 한다.
    expect(parentFiles.some((f) => f.includes('e2e-ci-diagnosis.md'))).toBe(false);
    // 자식 등장 전까지만 수집: docs/adr/ 경로 없음 (자식 4.17.a 라인에 있음).
    expect(parentFiles.some((f) => f.includes('0044-verifier-cross-ref-rules.md'))).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Case 4: 부모 본문 expectedFiles 보존 — 자식 등장 전 인덴트 경로는 부모 책임
  // -------------------------------------------------------------------------
  it('자식 항목 등장 전 인덴트 라인의 백틱 경로는 부모 expectedFiles 에 남는다', () => {
    const items = parsePlanText(FIXTURE_PARENT_FILES);
    const parent = items.find((i) => i.id === '1.7');
    expect(parent).toBeDefined();
    expect(parent!.status).toBe('x');
    const parentFiles = parent!.expectedFiles ?? [];
    // 자식 등장 전 "부모 본문:" 라인의 경로는 부모 책임으로 추출.
    expect(parentFiles).toContain('src/fetchers/types.ts');
    // 자식 1.7.a 라인 이후 경로 (other.ts) 는 부모에 없어야 한다.
    expect(parentFiles.some((f) => f.includes('other.ts'))).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Case 5: 단순 항목 — 자식 없는 부모의 인덴트 경로는 정상 추출
  // -------------------------------------------------------------------------
  it('자식 없는 단순 항목의 인덴트 경로는 정상 추출된다', () => {
    const items = parsePlanText(FIXTURE_SIMPLE);
    const item = items.find((i) => i.id === '1.1');
    expect(item).toBeDefined();
    expect(item!.status).toBe('x');
    const files = item!.expectedFiles ?? [];
    expect(files).toContain('src/simple/file.ts');
    // 두 번째 항목은 경로 없음.
    const item2 = items.find((i) => i.id === '1.2');
    expect(item2).toBeDefined();
    expect(item2!.expectedFiles).toHaveLength(0);
  });
});
