#!/usr/bin/env tsx
/**
 * Harness: verify-plan
 *
 * PLAN.md와 실제 코드의 정합성을 검증한다.
 * 깨졌을 때 = 누군가 플랜 없이 코드를 썼거나, 완료 표시(✅)를 했지만 코드가 없는 경우.
 *
 * 실행: pnpm harness:plan
 * CI: PR 머지 전 필수 통과
 */

import { readFile, access } from 'node:fs/promises';
import { glob } from 'glob';
import { resolve } from 'node:path';

interface PlanItem {
  id: string;            // "1.7" 같은 ID
  status: ' ' | '~' | 'x' | '!';
  title: string;
  expectedFiles?: string[];  // "DoD" 다음 줄에서 추출
}

interface Violation {
  level: 'error' | 'warn';
  rule: string;
  detail: string;
}

const violations: Violation[] = [];

async function parsePlan(path: string): Promise<PlanItem[]> {
  const text = await readFile(path, 'utf-8');
  const items: PlanItem[] = [];
  const lines = text.split('\n');

  const itemRe = /^- \[([ x~!])\] \*\*([A-Z]\.\d+(?:\.[A-Za-z0-9]+)*|\d+(?:\.[A-Za-z0-9]+)*)\*\* (.+)$/;
  const fileRe = /`([^`]+\.(?:ts|tsx|js|jsx|sql|md))`/g;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(itemRe);
    if (!m) continue;
    const item: PlanItem = {
      id: m[2],
      status: m[1] as PlanItem['status'],
      title: m[3],
      expectedFiles: [],
    };
    // 다음 인덴트 라인에서 파일 경로 추출
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      if (!lines[j].startsWith('  ')) break;
      let fm;
      while ((fm = fileRe.exec(lines[j])) !== null) {
        item.expectedFiles!.push(fm[1]);
      }
    }
    items.push(item);
  }
  return items;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(resolve(process.cwd(), p));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const items = await parsePlan('PLAN.md');
  console.log(`📋 PLAN.md에서 ${items.length}개 항목 파싱`);

  // Rule 1: [x]로 마킹된 항목의 expectedFiles는 실제 존재해야 한다
  for (const item of items) {
    if (item.status !== 'x') continue;
    for (const f of item.expectedFiles ?? []) {
      const exists = await fileExists(f);
      if (!exists) {
        violations.push({
          level: 'error',
          rule: 'completed-but-missing',
          detail: `PLAN ${item.id} ([x] 완료) 표시됐지만 ${f} 없음`,
        });
      }
    }
  }

  // Rule 2: 완료 표시된 항목의 합계가 메타 표와 일치
  const text = await readFile('PLAN.md', 'utf-8');
  const summaryMatch = text.match(/\*\*합계\*\* \| \*\*(\d+)\*\* \| \*\*(\d+)\*\*/);
  if (summaryMatch) {
    const [, totalStr, doneStr] = summaryMatch;
    const expectedTotal = items.length;
    const expectedDone = items.filter((i) => i.status === 'x').length;
    if (parseInt(totalStr) !== expectedTotal) {
      violations.push({
        level: 'error',
        rule: 'summary-total-mismatch',
        detail: `합계 표 총계 ${totalStr} ≠ 실제 ${expectedTotal}`,
      });
    }
    if (parseInt(doneStr) !== expectedDone) {
      violations.push({
        level: 'error',
        rule: 'summary-done-mismatch',
        detail: `합계 표 완료 ${doneStr} ≠ 실제 ${expectedDone}`,
      });
    }
  }

  // Rule 3: src/ 안의 모든 파일은 PLAN의 어느 항목에서 언급되어야 한다 (런치 후에만 강제)
  const enforceCoverage = process.env.ENFORCE_PLAN_COVERAGE === 'true';
  if (enforceCoverage) {
    const srcFiles = await glob('src/**/*.{ts,tsx}', { ignore: ['**/*.test.ts', '**/*.test.tsx'] });
    const allMentioned = new Set(items.flatMap((i) => i.expectedFiles ?? []));
    for (const f of srcFiles) {
      if (!allMentioned.has(f)) {
        violations.push({
          level: 'warn',
          rule: 'orphan-source-file',
          detail: `${f}는 PLAN.md에서 언급되지 않음 (architect가 추가하거나 삭제 검토)`,
        });
      }
    }
  }

  // 출력
  if (violations.length === 0) {
    console.log('✅ PLAN.md ↔ 코드 정합성 통과');
    process.exit(0);
  }

  console.log(`\n❌ 정합성 위반 ${violations.length}건:\n`);
  for (const v of violations) {
    const icon = v.level === 'error' ? '🚫' : '⚠️';
    console.log(`${icon} [${v.rule}] ${v.detail}`);
  }
  const errors = violations.filter((v) => v.level === 'error').length;
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('하네스 실행 실패:', err);
  process.exit(2);
});
