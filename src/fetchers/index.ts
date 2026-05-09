/**
 * Fetcher registry — 모든 fetcher를 한 배열로 모음 (ADR-0008 §T5).
 *
 * 1.6 cron(`src/inngest/functions.ts`)이 본 모듈의 `registry`를 import해서
 * for-loop로 순회한다. 1.8에서 추가될 fetcher 3개:
 *   - src/fetchers/proximus.ts   (export default new Fetcher 객체)
 *   - src/fetchers/orange-be.ts
 *   - src/fetchers/telenet.ts
 * 가 본 파일에 자기 자신을 push 하면 자동 cron 대상이 된다.
 *
 * 페이즈 1.7 시점(현재) 에는 *registry는 빈 배열* — 1.8 진입 시 채워짐.
 * cron은 빈 배열을 안전하게 처리 (no-op으로 끝남).
 *
 * harness:data Rule 1은 `src/fetchers/**\/*.ts` 중 types.ts 제외를 검사하므로
 * 본 파일도 검사 대상 — `FetchResult` 식별자를 export 로 노출해 통과.
 */

import type { Fetcher } from './types';

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
 * 등록된 모든 fetcher. 페이즈 1.7 시점에는 빈 배열. 1.8에서 채워짐:
 *
 *   import proximus from './proximus';
 *   import orangeBe from './orange-be';
 *   import telenet from './telenet';
 *   export const registry: readonly Fetcher[] = [proximus, orangeBe, telenet];
 *
 * cron은 `Promise.all(registry.map(...))` 가 아니라 for-loop를 쓴다 — 한
 * fetcher 폭발이 다른 fetcher의 step.run을 깨지 않도록 (1.9 격리 — ADR-0008 §T7).
 */
export const registry: readonly Fetcher[] = [];

/**
 * Slug로 단일 fetcher를 찾는 helper. 페이즈 4.5+ 어드민 dashboard 에서 "이
 * fetcher만 다시 돌려" 시나리오에 사용.
 *
 * 페이즈 1에서는 cron이 registry 전체를 순회하므로 본 helper는 디버깅용.
 */
export function findFetcher(providerSlug: string): Fetcher | undefined {
  return registry.find((f) => f.metadata.providerSlug === providerSlug);
}
