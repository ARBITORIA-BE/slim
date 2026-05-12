import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    // scripts/ 하네스 테스트는 jsdom 불필요 — node 환경으로 별도 포함 (PLAN 3.5.1.a)
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.{test,spec}.ts'],
    environmentMatchGlobs: [
      // src/ 는 React 컴포넌트 포함 → jsdom
      ['src/**', 'jsdom'],
      // scripts/ 하네스는 순수 Node 로직 → node 환경 (Playwright/Lighthouse 없이 순수 함수만 테스트)
      ['scripts/**', 'node'],
    ],
  },
  resolve: { alias: { '@': resolve(__dirname, './src') } },
});
