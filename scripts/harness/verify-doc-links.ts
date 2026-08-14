#!/usr/bin/env tsx
/**
 * Harness: verify-doc-links
 *
 * ADR-0044 Amendment 1 §A1.D1 — 문서 간 상대 링크 무결성 정적 스캔.
 *
 * Rule (iv) — 마크다운 상대 링크 `[텍스트](경로.md)` 의 대상 파일 실재 검증.
 *
 * 실행: pnpm harness:doc-links
 *
 * 왜 필요했나 (2026-08-14 실측):
 *   PLAN.md / CHANGELOG.md 가 ADR-0048/0049 를 11건 `[x]` 격상의 근거로 링크했으나
 *   해당 ADR 파일이 main 에 없었다 (미머지 PR #62 에만 존재). 근거 없는 `[x]` 11건이
 *   4개월간 게이트를 통과했다 — harness:cross-ref 룰 3종은 컴포넌트↔라우팅 한정이라
 *   문서 링크를 보지 않는다. 헌법 §3 P1(출처 없는 주장 금지) + P5(결정은 ADR로) 위반.
 *
 * 구현 방식: ADR-0044 §D2 와 동형 — 정규식 정적 스캔, 새 의존성 0.
 * 위반 처리: ADR-0044 §D3 와 동형 — error 격상 → exit 1.
 *
 * 범위 밖 (의도적):
 *   - 외부 URL (http/https/mailto) — 네트워크 의존 = 게이트 비결정성. 별 트랙.
 *   - 앵커(`#section`) 실재 — 한글 앵커 slug 규칙이 렌더러마다 달라 위양성 위험.
 *     경로만 검증하고 앵커는 잘라낸다.
 */

import { readFile } from 'node:fs/promises';
import { glob } from 'glob';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { existsSync } from 'node:fs';

// ─── 타입 ───────────────────────────────────────────────────────────────────

interface Violation {
  file: string;
  line: number;
  target: string;
  resolved: string;
}

interface ExtractedLink {
  target: string;
  line: number;
}

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function red(s: string): string {
  return `\x1b[31m${s}\x1b[0m`;
}

function green(s: string): string {
  return `\x1b[32m${s}\x1b[0m`;
}

function bold(s: string): string {
  return `\x1b[1m${s}\x1b[0m`;
}

// ─── 공개 함수 (단위 테스트 대상) ────────────────────────────────────────────

/**
 * 펜스 코드블록(``` … ```)을 같은 줄 수의 빈 줄로 치환한다.
 *
 * why: 문서가 예시로 적어둔 링크(예: BOUNDARY 문서가 "지운 줄"을 인용)를 실 링크로
 *      오탐하지 않기 위함. 줄 수를 보존해야 위반 라인 번호가 어긋나지 않는다.
 */
export function stripCodeFences(md: string): string {
  const lines = md.split('\n');
  let inFence = false;
  return lines
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return '';
      }
      return inFence ? '' : line;
    })
    .join('\n');
}

/**
 * 백틱 인라인 코드(`...`)를 같은 길이의 공백으로 치환한다.
 *
 * why: 문서가 링크 **문법 자체를 설명할 때** 쓰는 `[텍스트](경로.md)` 를 실 링크로
 *      오탐하지 않기 위함. 길이를 보존해야 위반 라인 번호가 어긋나지 않는다.
 *      인라인 코드는 줄을 넘지 않는다고 본다 (마크다운 관례).
 */
export function stripInlineCode(text: string): string {
  return text.replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));
}

/**
 * 마크다운 링크 중 **상대 경로 .md 대상**만 추출한다.
 *
 * 건너뛰는 것: 외부 URL(http/https/mailto/tel), 앵커 단독(`#foo`), .md 아닌 경로.
 * 앵커가 붙은 경로(`foo.md#bar`)는 앵커를 잘라 경로만 남긴다.
 */
export function extractMdLinks(text: string): ExtractedLink[] {
  const out: ExtractedLink[] = [];
  const linkRe = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m: RegExpExecArray | null;

  while ((m = linkRe.exec(text)) !== null) {
    // noUncheckedIndexedAccess — 캡처 그룹은 타입상 optional
    const raw = m[1] ?? '';
    if (raw === '') continue;
    if (/^(https?:|mailto:|tel:|#)/i.test(raw)) continue;

    const pathOnly = raw.split('#')[0] ?? '';
    if (pathOnly === '') continue;
    if (!pathOnly.toLowerCase().endsWith('.md')) continue;

    out.push({
      target: pathOnly,
      line: text.slice(0, m.index).split('\n').length,
    });
  }
  return out;
}

/**
 * 링크 대상을 저장소 루트 기준 절대 경로로 해석한다.
 *
 * `/docs/...` 처럼 루트 절대 경로로 적힌 링크는 저장소 루트 기준으로 본다
 * (마크다운 문서 관례 — 파일시스템 루트가 아님).
 */
export function resolveTarget(
  cwd: string,
  fromFile: string,
  target: string,
): string {
  if (target.startsWith('/')) {
    return resolve(cwd, `.${target}`);
  }
  return resolve(dirname(resolve(cwd, fromFile)), target);
}

// ─── 스캔 ────────────────────────────────────────────────────────────────────

async function runRuleIV(cwd: string, violations: Violation[]): Promise<number> {
  const files = await glob('**/*.md', {
    cwd,
    ignore: [
      'node_modules/**',
      '.next/**',
      '.claude/worktrees/**',
      'coverage/**',
    ],
    nodir: true,
  });

  let linkCount = 0;

  for (const file of files) {
    const raw = await readFile(resolve(cwd, file), 'utf8');
    const text = stripInlineCode(stripCodeFences(raw));

    for (const link of extractMdLinks(text)) {
      linkCount++;
      const resolved = resolveTarget(cwd, file, link.target);
      if (!existsSync(resolved)) {
        const rel = isAbsolute(resolved) ? relative(cwd, resolved) : resolved;
        violations.push({
          file,
          line: link.line,
          target: link.target,
          resolved: rel.split('\\').join('/'),
        });
      }
    }
  }

  return linkCount;
}

// ─── 메인 ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const cwd = process.cwd();
  const violations: Violation[] = [];

  console.log(bold('\n[harness:doc-links] ADR-0044 Amd 1 룰 (iv) 문서 링크 무결성 스캔 시작\n'));

  process.stdout.write('  Rule (iv)  마크다운 상대 링크 ↔ 파일 존재 … ');
  const linkCount = await runRuleIV(cwd, violations);
  console.log(violations.length === 0 ? green('GREEN') : red(`${violations.length}건 위반`));

  console.log(`\n  검사한 링크: ${linkCount}건`);

  if (violations.length === 0) {
    console.log(green('\n✅ 문서 링크 검증 통과 — 깨진 상대 링크 0'));
    process.exit(0);
  }

  console.log(red(bold(`\n❌ 깨진 문서 링크 ${violations.length}건:\n`)));
  for (const v of violations) {
    console.log(
      `  ${red('[Rule IV]')} ${v.file}:${v.line}\n    링크: ${v.target}\n    대상 없음: ${v.resolved}\n`,
    );
  }

  console.log(
    red(`harness:doc-links 실패 — ${violations.length}건. 파일명 오타이거나, 근거 문서가 아직 머지되지 않았다는 뜻이다.`),
  );
  process.exit(1);
}

// tsx 로 직접 실행될 때만 main 구동 (테스트는 순수 함수만 import)
if (process.argv[1]?.includes('verify-doc-links')) {
  main().catch((err: unknown) => {
    console.error('harness:doc-links 실행 오류:', err);
    process.exit(2);
  });
}
