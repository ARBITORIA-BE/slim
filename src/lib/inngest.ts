/**
 * Inngest 클라이언트 초기화 (PLAN 1.6).
 *
 * 결정 근거: docs/adr/0008-fetcher-interface-and-cron.md §T8 / §T9
 *
 * 환경변수 (페이즈 1.6에서 신설 — `.env.example` 참조):
 *   INNGEST_EVENT_KEY    — 이벤트 송신 인증 (production만 필수)
 *   INNGEST_SIGNING_KEY  — 서버 ↔ Inngest 통신 서명 (production만 필수)
 *
 * 키 부재 시 Inngest SDK는 자동으로 dev mode로 fallback — 로컬에서
 * `npx inngest-cli@latest dev` 로 띄운 devserver(http://127.0.0.1:8288)에 연결.
 * 별도 가입/계정 불필요한 솔로 친화 동작.
 *
 * 무료 티어 한계 (2026-05-09 — Inngest Pricing 페이지):
 *   - 50,000 executions/월
 *   - 5 concurrent steps
 *   - 100k events/월
 *   - 24h 추적/로그 보존
 *   - 20회 연속 실패 시 함수 자동 일시정지
 * → 본 프로젝트 예상 부하: 3 fetcher × 일 1회 × 30일 ≈ 90 events/월 +
 *   ~180 step runs/월 (한도의 0.4%, 555배 안전 마진).
 */

import { Inngest, EventSchemas } from 'inngest';

// ─── Event 타입 (T8 — Inngest 컨벤션 <entity>/<action>.<state>) ─────────

/**
 * Inngest 이벤트 스키마. cron이 발사하거나, 어드민/dev가 수동 트리거할 때 사용.
 * 페이즈 5에서 카테고리 추가 시 본 타입 union 확장 (별도 ADR).
 */
type Events = {
  /**
   * 모든 fetcher 일괄 실행 요청.
   * - 평소: cron이 일 1회 06:00 UTC에 자동 발사
   * - 디버깅: 어드민/dev가 `only` 필드로 특정 provider만 재실행
   */
  'fetchers/run.requested': {
    data: {
      requestedBy: 'cron' | 'admin' | 'dev';
      /** 특정 provider slug만 실행. 미지정 = 전체 registry. */
      only?: string[];
    };
  };
};

// ─── Client ───────────────────────────────────────────────────────────────

/**
 * Inngest 클라이언트 싱글턴. `src/inngest/functions.ts` 의 cron 함수와
 * `src/app/api/inngest/route.ts` 의 serve() 두 곳에서 import.
 *
 * `id: 'slim'` — Inngest 대시보드의 app id. production/preview/dev 동일 id를
 * 사용해 한 앱으로 추적.
 */
export const inngest = new Inngest({
  id: 'slim',
  schemas: new EventSchemas().fromRecord<Events>(),
});

// 외부 import 편의
export type SlimEvents = Events;
