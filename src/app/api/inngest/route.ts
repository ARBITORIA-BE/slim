/**
 * Inngest API endpoint (PLAN 1.6).
 *
 * Next.js 15 App Router 표준 위치. Inngest cloud가 본 endpoint를 GET/POST/PUT
 * 으로 호출해 함수 목록 등록 + 실행 요청 송신.
 *
 * 결정 근거: docs/adr/0008-fetcher-interface-and-cron.md §T9
 *
 * 환경변수:
 *   INNGEST_EVENT_KEY    — production만 필수 (이벤트 송신 인증)
 *   INNGEST_SIGNING_KEY  — production만 필수 (서버 ↔ Inngest 서명)
 *
 * 키 부재 시 Inngest SDK 자동 dev mode — 로컬에서 `npx inngest-cli@latest dev`
 * 띄우면 본 endpoint를 자동 발견.
 *
 * Inngest 공식 문서:
 *   https://www.inngest.com/docs/sdk/serve
 */

import { serve } from 'inngest/next';

import { inngest } from '@/lib/inngest';
import { functions } from '@/inngest/functions';

// App Router는 GET/POST/PUT 모두 export 필요 (Inngest 공식 가이드)
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
