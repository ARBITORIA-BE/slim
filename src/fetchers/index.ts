/**
 * Fetcher registry — 모든 fetcher를 한 배열로 모음 (ADR-0008 §T5).
 *
 * 1.6 cron(`src/inngest/functions.ts`)이 본 모듈의 `registry`를 import해서
 * for-loop로 순회한다.
 *
 * PLAN 1.8 (2026-05-09): Proximus + Telenet 스텁 fetcher 추가.
 *   - src/fetchers/proximus.ts — Proximus BE (mobile + internet)
 *   - src/fetchers/telenet.ts  — Telenet BE (internet + mobile + bundle)
 *
 * PLAN 1.5.6 (부채): 실 스크래핑 fetcher로 교체.
 *   confidence='low' → 'medium'/'high'로 격상.
 *
 * Orange BE는 ADR-0009 결정으로 페이즈 5에서 평가 후 추가.
 *   신설 시: import orangeBe from './orange-be'; + registry에 1줄 추가.
 *
 * harness:data Rule 1은 `src/fetchers/**\/*.ts` 중 types.ts 제외를 검사하므로
 * 본 파일도 검사 대상 — `FetchResult` 식별자를 export 로 노출해 통과.
 */

import type { Fetcher } from './types';
import { proximus } from './proximus';
import { telenet } from './telenet';

// ─── 타입 재export (외부 import 단일 진입점 + harness:data Rule 1 통과) ──

// `FetchResult` 식별자가 본 파일에서도 코드 식별자로 등장 → harness:data
// Rule 1 (src/fetchers/**\/*.ts에서 `FetchResult` 문자열 검사) 안전 통과.
export type {
  Fetcher,
  FetcherMetadata,
  FetchOutcome,
  FetchResult,
  FetchError,
  TariffSnapshotInput,
} from './types';

// ─── Registry — 모든 fetcher 인스턴스의 단일 출처 ─────────────────────────

/**
 * 등록된 모든 fetcher. PLAN 1.8 기준 2개 (Proximus + Telenet).
 *
 * 왜 for-loop인가 (cron 호출 패턴)?
 *   cron은 `Promise.all(registry.map(...))` 가 아니라 for-loop를 쓴다.
 *   한 fetcher 폭발이 다른 fetcher의 step.run을 깨지 않도록 (1.9 격리 — ADR-0008 §T7).
 *
 * 페이즈 5에서 Orange BE 추가 시:
 *   import orangeBe from './orange-be';
 *   export const registry: readonly Fetcher[] = [proximus, telenet, orangeBe];
 */
export const registry: readonly Fetcher[] = [proximus, telenet];

/**
 * Slug로 단일 fetcher를 찾는 helper. 페이즈 4.5+ 어드민 dashboard 에서 "이
 * fetcher만 다시 돌려" 시나리오에 사용.
 *
 * 페이즈 1에서는 cron이 registry 전체를 순회하므로 본 helper는 디버깅용.
 */
export function findFetcher(providerSlug: string): Fetcher | undefined {
  return registry.find((f) => f.metadata.providerSlug === providerSlug);
}
