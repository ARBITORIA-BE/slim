/**
 * Fetcher 공통 헬퍼 (PLAN 1.5.1 — N=2 부분 공통화)
 *
 * 왜 _shared.ts인가?
 *   ADR-0009 §결정 3: N=2 표본 부족으로 추출 가치 약함. 그러나 실제 코드를
 *   살펴보니 *실수 가능성 높은 패턴* 3개가 중복:
 *     1. STUB_FAIL_* 환경변수 → FetchOutcome.ok=false 변환 (~20줄)
 *     2. makeStubConfidence (computeConfidence + selectorMatched=false 보일러)
 *     3. STUB_REASON 문자열 (사용자 노출 텍스트라 일관성 필수)
 *   N=3+로 격상 시 (Orange BE 페이즈 5 추가) 더 많은 추출 가능. 본 모듈은
 *   *그 시점까지 건드릴 필요 없는* 안정 표면으로 설계.
 *
 * underscore prefix:
 *   src/fetchers/index.ts의 registry에 들어가지 않는 *내부 helper*임을 명시.
 *
 * harness:data Rule 1: 본 파일은 FetchResult/FetchOutcome 타입을 *재export*만 함
 * (직접 반환 안 함). 따라서 ignore 패턴에 추가하거나 import만 으로 통과.
 */

import { computeConfidence } from './confidence';
import type { FetchOutcome } from './types';

// Confidence 타입은 tariff_snapshot 스키마에서 — types.ts와 일관 (ADR-0006 §T4)
type Confidence = 'high' | 'medium' | 'low';

// ─── 공통 상수 ────────────────────────────────────────────────────────────

/** 실 fetch 시 사용할 timeout (1.5.6 활성화). 25s = Inngest free step timeout 보수 가정. */
export const STUB_FETCH_TIMEOUT_MS = 25_000;

/** 사용자 노출 reason 텍스트 — 모든 stub fetcher가 동일 메시지로 P3 일관성. */
export const STUB_REASON =
  'stub fetcher — manual data 2026-05-09; replace with real scraper (PLAN 1.5.6)';

// ─── 공통 helper ──────────────────────────────────────────────────────────

/**
 * 스텁 fetcher의 confidence는 항상 'low'. computeConfidence는 selectorMatched
 * 기반인데 스텁은 실 fetch가 없으므로 자연스럽게 base가 low. 명시적으로 호출해
 * "down-grade only" 규칙(ADR-0008 §T3)에 정합되는 코드 의도를 새긴다.
 */
export function makeStubConfidence(): {
  confidence: Confidence;
  reason: string;
} {
  return computeConfidence({
    selectorMatched: false,
    sanityChecks: [],
    parseWarnings: [],
  });
}

/**
 * STUB_FAIL_* 환경변수 검사 → 실패 FetchOutcome 생성.
 *
 * 사용:
 *   const failure = stubFailOutcome('proximus-be', 'STUB_FAIL_PROXIMUS', FETCHER_VERSION, fetchedAt);
 *   if (failure) return failure;
 *
 * 운영에서는 절대 설정하지 않는다 (1.9 격리 수동 검증 전용).
 */
export function stubFailOutcome(
  fetcherSlug: string,
  envVar: string,
  fetcherVersion: string,
  fetchedAt: string,
): FetchOutcome | null {
  if (process.env[envVar] !== '1') return null;
  return {
    ok: false,
    error: {
      fetcherSlug,
      fetchedAt,
      kind: 'network',
      message: `${envVar}=1: simulated failure for 1.9 isolation testing`,
      rawPayload: {
        stub: true,
        fetcher_version: fetcherVersion,
        simulated_failure: true,
      },
    },
  };
}

/**
 * 스텁 raw_payload 표준 형식 — TariffSnapshotInput.rawPayload에 들어감.
 * 모든 스텁 fetcher가 같은 키 구조를 사용해 6.1 어드민 대시보드 / harness:price
 * 등 다운스트림 코드의 분기 0.
 */
export function makeStubRawPayload(
  fetcherVersion: string,
): Readonly<Record<string, unknown>> {
  return {
    stub: true,
    reason: STUB_REASON,
    fetcher_version: fetcherVersion,
  };
}
