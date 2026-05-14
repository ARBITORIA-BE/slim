import { defineConfig } from '@playwright/test';

// E2E 전용 ADMIN_TOKEN. 4.5.1.d /admin 가드 검증용. 운영자의 `.env.local`
// ADMIN_TOKEN 과 분리 — Playwright 가 띄우는 dev server 의 env 만 덮어쓴다.
const E2E_ADMIN_TOKEN = 'e2e-admin-token-do-not-use-in-prod';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3000', locale: 'ko-KR' },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    env: { ADMIN_TOKEN: E2E_ADMIN_TOKEN },
  },
});

export { E2E_ADMIN_TOKEN };
