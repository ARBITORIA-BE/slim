/**
 * verify-cross-ref 단위 테스트 — ADR-0044 §V1 회귀 5건 시뮬레이션
 *
 * 픽스처 전략: 인-메모리 패턴 매칭 (실 파일시스템 X).
 * 룰 함수(checkHrefSegment / checkNextButtonLabel / checkPushStep) 를 직접 임포트해서
 * 픽스처 입력 → 위반 발화 여부 검증.
 *
 * 실행: pnpm test:run (vitest node 환경, vitest.config.ts environmentMatchGlobs)
 */

import { describe, it, expect } from 'vitest';
import {
  checkHrefSegment,
  checkNextButtonLabel,
  checkPushStep,
} from './verify-cross-ref';

// ─── 유효 segment 집합 (현 main 상태) ─────────────────────────────────────────
const VALID_SEGMENTS = new Set(['current-provider', 'household', 'preview']);

// ─── STEPS 배열 (현 main 상태) ────────────────────────────────────────────────
const STEPS = ['current-provider', 'household', 'preview'];

// =============================================================================
// 픽스처 1: 회귀 #2 패턴 — Rule (i) 위반 발화
// ADR-0044 §V1: CategoryGrid.tsx href `/compare/${cat}/postal` → 라우트 부재
// =============================================================================
describe('Rule (i) — href ↔ 라우트 파일 존재', () => {
  it('[위반] 회귀 #2: /compare/${cat}/postal — postal 라우트 없음 → 위반 발화', () => {
    // 시뮬레이션: CategoryGrid href = `/compare/${category}/postal`
    const href = '/compare/telecom/postal';
    const result = checkHrefSegment(href, VALID_SEGMENTS);
    expect(result).toBe('postal');
  });

  it('[위반] /compare/${cat}/bill — bill 라우트 없음 → 위반 발화', () => {
    const href = '/compare/telecom/bill';
    const result = checkHrefSegment(href, VALID_SEGMENTS);
    expect(result).toBe('bill');
  });

  it('[GREEN] /compare/${cat}/current-provider — 유효한 segment → null', () => {
    const href = '/compare/telecom/current-provider';
    const result = checkHrefSegment(href, VALID_SEGMENTS);
    expect(result).toBeNull();
  });

  it('[GREEN] /compare/${cat}/household — 유효한 segment → null', () => {
    const href = '/compare/telecom/household';
    const result = checkHrefSegment(href, VALID_SEGMENTS);
    expect(result).toBeNull();
  });

  it('[GREEN] /compare/${cat}/preview — 유효한 segment → null', () => {
    const href = '/compare/telecom/preview';
    const result = checkHrefSegment(href, VALID_SEGMENTS);
    expect(result).toBeNull();
  });

  it('[GREEN] 동적 segment (${...}) — 정적 분석 불가, 스킵 → null', () => {
    // 동적 변수 치환 케이스 — 정확도 87% 한계 (ADR-0044 D2)
    const href = '/compare/telecom/${step}';
    const result = checkHrefSegment(href, VALID_SEGMENTS);
    expect(result).toBeNull();
  });
});

// =============================================================================
// 픽스처 2: 회귀 #4 패턴 — Rule (ii) 위반 발화
// ADR-0044 §V1: currentProvider.nextButton = "Preview results" (household 도달지인데 preview 의미)
// =============================================================================
describe('Rule (ii) — nextButton 라벨 ↔ 도달지 cross-ref', () => {
  it('[위반] 회귀 #4: currentProvider.nextButton [en] = "Preview results" → 위반 (Household type 없음)', () => {
    const result = checkNextButtonLabel('current-provider', 'en', 'Next — Preview results');
    expect(result).not.toBeNull();
    expect(result).toContain('Household type');
  });

  it('[위반] 회귀 #4: currentProvider.nextButton [nl] = "Resultatenvoorbeeld" 포함 → 위반', () => {
    const result = checkNextButtonLabel('current-provider', 'nl', 'Volgende — Resultatenvoorbeeld');
    expect(result).not.toBeNull();
    expect(result).toContain('Huishoudtype');
  });

  it('[위반] 회귀 #4: currentProvider.nextButton [ko] = "결과 미리보기" → 위반', () => {
    const result = checkNextButtonLabel('current-provider', 'ko', '다음 — 결과 미리보기');
    expect(result).not.toBeNull();
    expect(result).toContain('가구 형태');
  });

  it('[위반] 회귀 #5 패턴: household.nextButton [en] = "Current Supplier" → 위반 (Preview results 없음)', () => {
    // regression #5 — see ADR-0044 §V1
    const result = checkNextButtonLabel('household', 'en', 'Next — Current Supplier');
    expect(result).not.toBeNull();
    expect(result).toContain('Preview results');
  });

  it('[위반] household.nextButton [ko] = "가구 형태" → 위반', () => {
    const result = checkNextButtonLabel('household', 'ko', '다음 — 가구 형태');
    expect(result).not.toBeNull();
    expect(result).toContain('결과 미리보기');
  });

  it('[GREEN] 현 main: currentProvider.nextButton [en] = "Next — Household type" → null', () => {
    const result = checkNextButtonLabel('current-provider', 'en', 'Next — Household type');
    expect(result).toBeNull();
  });

  it('[GREEN] 현 main: household.nextButton [en] = "Next — Preview results" → null', () => {
    const result = checkNextButtonLabel('household', 'en', 'Next — Preview results');
    expect(result).toBeNull();
  });

  it('[GREEN] 현 main: currentProvider.nextButton [nl] = "Volgende — Huishoudtype" → null', () => {
    const result = checkNextButtonLabel('current-provider', 'nl', 'Volgende — Huishoudtype');
    expect(result).toBeNull();
  });

  it('[GREEN] 현 main: household.nextButton [nl] = "Volgende — Resultatenvoorbeeld" → null', () => {
    const result = checkNextButtonLabel('household', 'nl', 'Volgende — Resultatenvoorbeeld');
    expect(result).toBeNull();
  });

  it('[GREEN] 현 main: currentProvider.nextButton [fr] = "Suivant — Type de ménage" → null', () => {
    const result = checkNextButtonLabel('current-provider', 'fr', 'Suivant — Type de ménage');
    expect(result).toBeNull();
  });

  it('[GREEN] 현 main: household.nextButton [fr] = "Suivant — Aperçu des résultats" → null', () => {
    const result = checkNextButtonLabel('household', 'fr', 'Suivant — Aperçu des résultats');
    expect(result).toBeNull();
  });

  it('[GREEN] 현 main: currentProvider.nextButton [ko] = "다음 — 가구 형태" → null', () => {
    const result = checkNextButtonLabel('current-provider', 'ko', '다음 — 가구 형태');
    expect(result).toBeNull();
  });

  it('[GREEN] 현 main: household.nextButton [ko] = "다음 — 결과 미리보기" → null', () => {
    const result = checkNextButtonLabel('household', 'ko', '다음 — 결과 미리보기');
    expect(result).toBeNull();
  });
});

// =============================================================================
// 픽스처 3: 회귀 #3 패턴 — Rule (iii) 위반 발화
// ADR-0044 §V1: current-provider Skip handler → router.push('preview') — household 우회
// =============================================================================
describe('Rule (iii) — STEPS ↔ router.push 순서 cross-ref', () => {
  it('[위반] 회귀 #3: current-provider step 에서 push "preview" → household 우회 위반', () => {
    // regression #3 — see ADR-0044 §V1
    const result = checkPushStep('current-provider', 'preview', STEPS);
    expect(result).not.toBeNull();
    expect(result).toContain('household');
  });

  it('[위반] 회귀 #5: household step 에서 push "current-provider" → 역방향 위반', () => {
    // regression #5 — see ADR-0044 §V1
    const result = checkPushStep('household', 'current-provider', STEPS);
    expect(result).not.toBeNull();
    expect(result).toContain('preview');
  });

  it('[위반] STEPS 에 없는 segment push → 위반', () => {
    const result = checkPushStep(null, 'postal', STEPS);
    expect(result).not.toBeNull();
    expect(result).toContain('postal');
  });

  it('[위반] STEPS 에 없는 segment push (bill) → 위반', () => {
    const result = checkPushStep('current-provider', 'bill', STEPS);
    expect(result).not.toBeNull();
  });

  it('[GREEN] current-provider step 에서 push "household" → null', () => {
    const result = checkPushStep('current-provider', 'household', STEPS);
    expect(result).toBeNull();
  });

  it('[GREEN] household step 에서 push "preview" → null', () => {
    const result = checkPushStep('household', 'preview', STEPS);
    expect(result).toBeNull();
  });

  it('[GREEN] currentStep null + STEPS 내 segment → null (순서 검증 불가, 존재만)', () => {
    const result = checkPushStep(null, 'household', STEPS);
    expect(result).toBeNull();
  });

  it('[GREEN] preview step — terminal, 다음 없음 → null', () => {
    // preview 는 STEP_NEXT_SEGMENT 에 없음 → 순서 검증 스킵
    const result = checkPushStep('preview', 'household', STEPS);
    // preview 는 STEPS 에 있고 STEP_NEXT_SEGMENT[preview] = undefined → null
    expect(result).toBeNull();
  });
});

// =============================================================================
// 픽스처 5: GREEN 케이스 — 현 main 정합 상태 종합 확인
// =============================================================================
describe('GREEN 케이스 — 현 main 정합 상태', () => {
  it('CategoryGrid href current-provider → Rule (i) GREEN', () => {
    expect(checkHrefSegment('/compare/telecom/current-provider', VALID_SEGMENTS)).toBeNull();
  });

  it('현 main 4 locale × 2 step nextButton 라벨 전체 GREEN', () => {
    // en
    expect(checkNextButtonLabel('current-provider', 'en', 'Next — Household type')).toBeNull();
    expect(checkNextButtonLabel('household', 'en', 'Next — Preview results')).toBeNull();
    // nl
    expect(checkNextButtonLabel('current-provider', 'nl', 'Volgende — Huishoudtype')).toBeNull();
    expect(checkNextButtonLabel('household', 'nl', 'Volgende — Resultatenvoorbeeld')).toBeNull();
    // fr
    expect(checkNextButtonLabel('current-provider', 'fr', 'Suivant — Type de ménage')).toBeNull();
    expect(checkNextButtonLabel('household', 'fr', 'Suivant — Aperçu des résultats')).toBeNull();
    // ko
    expect(checkNextButtonLabel('current-provider', 'ko', '다음 — 가구 형태')).toBeNull();
    expect(checkNextButtonLabel('household', 'ko', '다음 — 결과 미리보기')).toBeNull();
  });

  it('현 main STEPS 순서 정합 — current-provider→household, household→preview GREEN', () => {
    expect(checkPushStep('current-provider', 'household', STEPS)).toBeNull();
    expect(checkPushStep('household', 'preview', STEPS)).toBeNull();
  });
});
