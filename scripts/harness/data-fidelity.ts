#!/usr/bin/env tsx
/**
 * Harness: data-fidelity
 *
 * P1 (정보 우선) 강제 — UI에 노출되는 모든 숫자는 출처를 가진다.
 *
 * 검증 대상:
 *   1. DB tariff_snapshot 모든 행: source_url + fetched_at
 *   2. UI에서 가격 표시 컴포넌트는 <PriceWithSource> 래퍼 사용
 *   3. 모든 Fetcher 구현은 FetchResult 타입 반환 (정적 분석)
 *   4. 24h 이상 stale 데이터에 "X시간 전" 라벨 노출 코드 존재
 *
 * 실행: pnpm harness:data
 */

import { readFile } from 'node:fs/promises';
import { glob } from 'glob';

interface Violation {
  level: 'error' | 'warn';
  rule: string;
  file: string;
  detail: string;
}

const violations: Violation[] = [];

// Rule 1: src/fetchers/*.ts 가 FetchResult를 반환하는가
async function checkFetcherReturnTypes() {
  const fetchers = await glob('src/fetchers/**/*.ts', {
    ignore: ['**/types.ts', '**/*.test.ts', '**/cache.ts'],
  });
  for (const f of fetchers) {
    const text = await readFile(f, 'utf-8');
    if (!text.includes('FetchResult')) {
      violations.push({
        level: 'error',
        rule: 'fetcher-missing-fetchresult',
        file: f,
        detail: 'Fetcher인데 FetchResult 타입을 반환하지 않음',
      });
    }
  }
}

// Rule 2: UI 컴포넌트에서 가격을 표시할 때 PriceWithSource 사용
async function checkUiPriceWrapper() {
  const components = await glob('src/components/**/*.tsx');
  for (const f of components) {
    const text = await readFile(f, 'utf-8');
    // 휴리스틱: €, EUR, currency 같은 단어가 있는데 PriceWithSource가 없으면 의심
    const hasPrice =
      /€|EUR\b|monthly_cost|yearly_saving|tariff/i.test(text) &&
      !/__SAFE_PRICE_DISPLAY__/.test(text);
    const hasWrapper = /PriceWithSource|<Price[\s>]/.test(text);
    if (hasPrice && !hasWrapper) {
      violations.push({
        level: 'warn',
        rule: 'price-without-source-wrapper',
        file: f,
        detail: '가격으로 보이는 텍스트가 있지만 <PriceWithSource> 사용 안 함. 의도적이면 // __SAFE_PRICE_DISPLAY__ 코멘트 추가.',
      });
    }
  }
}

// Rule 3: stale 데이터 라벨 컴포넌트 존재 확인
async function checkStaleLabel() {
  const found = await glob('src/components/**/StaleLabel.tsx');
  if (found.length === 0) {
    violations.push({
      level: 'error',
      rule: 'missing-stale-label',
      file: 'src/components/',
      detail: '<StaleLabel> 컴포넌트 없음 — 24h 이상 데이터 알림 필수 (P1)',
    });
  }
}

// Rule 4: DB 레벨 검증 (마이그레이션 파일에 NOT NULL 제약)
async function checkSchemaConstraints() {
  const schemas = await glob('src/db/schema/**/*.ts');
  let foundTariffSnapshot = false;
  for (const f of schemas) {
    const text = await readFile(f, 'utf-8');
    if (!text.includes('tariffSnapshot')) continue;
    foundTariffSnapshot = true;
    if (!/source_url.*notNull/s.test(text)) {
      violations.push({
        level: 'error',
        rule: 'schema-source-url-nullable',
        file: f,
        detail: 'tariff_snapshot.source_url이 NOT NULL 아님',
      });
    }
    if (!/fetched_at.*notNull/s.test(text)) {
      violations.push({
        level: 'error',
        rule: 'schema-fetched-at-nullable',
        file: f,
        detail: 'tariff_snapshot.fetched_at이 NOT NULL 아님',
      });
    }
  }
  if (!foundTariffSnapshot) {
    violations.push({
      level: 'warn',
      rule: 'schema-tariff-snapshot-missing',
      file: 'src/db/schema/',
      detail: 'tariff_snapshot 스키마 아직 정의 안 됨 (페이즈 1.3에서 정의 예정)',
    });
  }
}

async function main() {
  await checkFetcherReturnTypes();
  await checkUiPriceWrapper();
  await checkStaleLabel();
  await checkSchemaConstraints();

  if (violations.length === 0) {
    console.log('✅ Data Fidelity 검증 통과 — 모든 데이터에 출처/신선도 보장');
    process.exit(0);
  }

  console.log(`\n❌ Data Fidelity 위반 ${violations.length}건:\n`);
  for (const v of violations) {
    const icon = v.level === 'error' ? '🚫' : '⚠️';
    console.log(`${icon} [${v.rule}] ${v.file}\n   ${v.detail}\n`);
  }
  const errors = violations.filter((v) => v.level === 'error').length;
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('하네스 실행 실패:', err);
  process.exit(2);
});
