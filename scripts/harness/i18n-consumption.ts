#!/usr/bin/env tsx
/**
 * Harness: i18n-consumption
 *
 * ADR-0033 §A2.8.4 "재발 방지 — 신규 게이트" 잠금 구현.
 * ADR-0036 D2: src/components/ + src/types/comparison-input.ts 스캔 확장 (4.5.j.5.b).
 *
 * 목적: 컴포넌트가 next-intl `t()` 를 실제로 소비하는지 정적 검사.
 * Phase A/B 구분 구조:
 *   - Phase A (4.5.j.4.A) 완료 후: 핵심 21개 파일 한글 0
 *   - Phase B (4.5.j.4.B) 미완료 동안: 보조 경로 5개 파일은 allowlist 로 예외 처리
 *   - 4.5.j.4.B 완료 시 아래 PHASE_B_ALLOWLIST 를 비우면 전수 GREEN
 *
 * 검사 규칙:
 *   1. src/app/[locale]/**\/*.tsx (*.test.tsx 제외, 루트 src/app/layout.tsx 제외)에서
 *      한글 리터럴(JSX 텍스트 / 문자열) 0 개 (단, 화이트리스트 패턴 허용)
 *   2. 핵심 라우트 파일에 useTranslations 또는 getTranslations import 존재
 *   3. (ADR-0036 D2) src/components/**\/*.tsx 한글 리터럴 0 (*.test.tsx 제외)
 *   4. (ADR-0036 D2) src/types/comparison-input.ts 한글 리터럴 0
 *
 * 화이트리스트 허용 예외 (§A2.8.4):
 *   - ICU 토큰 내부: {variable} 형태의 플레이스홀더 (t() 인자 안에 있음 — 파일에서는 0)
 *   - 주석 내 한글: // 또는 /* ... * / 블록 주석 (인라인 // 주석 포함)
 *   - JSX 블록 주석: {/* ... * /} 내부
 *   - 브랜드 상수: "Slim" (한글 아님, 영문 브랜드명)
 *   - "@i18n-allow" 마커가 있는 줄 (명시적 화이트리스트)
 *   - "@i18n-allow" 마커가 있는 바로 위 줄 뒤 나오는 metadata 값 줄
 *     (줄 자체가 `key: '...',` 형태의 metadata 줄인 경우 허용)
 *   NOTE: 주석 안 한글은 "@i18n-allow" 마커 없이도 허용 (주석 행 자동 필터)
 *   NOTE: [locale]/layout.tsx 는 metadata 전체가 Phase B 대기 → PHASE_B_LAYOUT 예외 처리
 *   NOTE: src/components/SiteFooter.tsx JSDoc{slash* *slash} 주석 한글 → 자동 필터 통과 (허용)
 *
 * 실행: pnpm harness:i18n
 *
 * B2 수정 (4.5.j.4.A 버그픽스):
 *   - glob 라이브러리 의존 제거 → Node fs 재귀 디렉터리 워크로 교체
 *   - Windows 경로를 path.sep 정규화(/ 통일) 후 매칭 → 크로스플랫폼 보장
 *   - 인라인 // 주석(코드 뒤) 포함 허용 개선
 *   - JSX 블록 주석 ( {slash* ... *slash} ) 내부 연속 줄 허용
 *   - @i18n-allow 블록 마커 인식 개선 (마커 뒤 연속 metadata 줄 허용)
 *   - [locale]/layout.tsx metadata 블록 Phase B 예외 추가
 *
 * D2 수정 (4.5.j.5.b — ADR-0036):
 *   - src/components/**\/*.tsx 스캔 추가 (*.test.tsx 제외)
 *   - src/types/comparison-input.ts 화이트리스트 스캔 추가
 *   - 각 그룹별 0파일 FATAL 자가검증 추가
 *   - import 검사(useTranslations/getTranslations)는 CORE_ROUTE_FILES 한정 유지 (신규 그룹 적용 안 함)
 */

import { readFile, readdir, access } from 'node:fs/promises';
import * as path from 'node:path';

// ─── Phase B 대기 allowlist ──────────────────────────────────────────────────
// 4.5.j.4.B 에서 완료 시 아래 파일들을 하나씩 제거하면 전수 GREEN.
// allowlist 에 있는 파일은 한글 리터럴 검사를 건너뜀 (단, import 검사도 스킵).
// NOTE: 경로는 슬래시 기준으로 작성 (path.sep 정규화 후 비교).
const PHASE_B_ALLOWLIST: readonly string[] = [
  // 4.5.j.4.B (나) 메타데이터 i18n 완료 후에도 잔류 — (가) 보조 페이지 본문 미완:
  'src/app/[locale]/data-sources/page.tsx',
  'src/app/[locale]/go/[shortId]/[itemId]/page.tsx',
  'src/app/[locale]/unsubscribe/[token]/page.tsx',
  'src/app/[locale]/admin/page.tsx',
  'src/app/[locale]/legal/affiliate-disclosure/page.tsx',
  // NOTE: [locale]/layout.tsx 는 metadata i18n 완료 (§A2.9.1) → allowlist 제거됨.
  //       한글 리터럴 0 확인 후 스캔 대상 복귀.
];

// ─── 핵심 라우트 파일 — useTranslations/getTranslations import 존재 필수 ──────
// (옵션 a §A2.8.4: "핵심 라우트 파일에 import 존재 정적 검사")
// Phase A 완료 시점의 1순위 라우트만 포함. Phase B 완료 후 보조 경로 추가 가능.
const CORE_ROUTE_FILES: readonly string[] = [
  'src/app/[locale]/page.tsx',
  'src/app/[locale]/compare/page.tsx',
  'src/app/[locale]/r/[shortId]/page.tsx',
  'src/app/[locale]/r/[shortId]/not-found.tsx',
  'src/app/[locale]/compare/[category]/_components/CompareLayout.tsx',
  'src/app/[locale]/compare/[category]/postal/page.tsx',
  'src/app/[locale]/compare/[category]/household/page.tsx',
  'src/app/[locale]/compare/[category]/current-provider/page.tsx',
  'src/app/[locale]/compare/[category]/bill/page.tsx',
  'src/app/[locale]/compare/[category]/preview/page.tsx',
  'src/app/[locale]/r/[shortId]/_components/ResultConclusionCard.tsx',
  'src/app/[locale]/r/[shortId]/_components/ComparisonTable.tsx',
  'src/app/[locale]/r/[shortId]/_components/CalculationDetails.tsx',
  'src/app/[locale]/r/[shortId]/_components/ComparisonControls.tsx',
  'src/app/[locale]/r/[shortId]/_components/ExcludedProvidersSection.tsx',
  'src/app/[locale]/r/[shortId]/_components/BetaEstimatedBanner.tsx',
  'src/app/[locale]/r/[shortId]/_components/AffiliateDisclosureLine.tsx',
  'src/app/[locale]/compare/[category]/current-provider/_components/CurrentProviderForm.tsx',
];

// ─── 한글 감지 정규식 ────────────────────────────────────────────────────────
// /[가-힣]/ — 완성형 한글 유니코드 블록 (AC00–D7A3)
const KOREAN_RE = /[가-힣]/;

interface Violation {
  level: 'error' | 'warn';
  rule: string;
  file: string;
  line: number;
  detail: string;
}

const violations: Violation[] = [];

/**
 * 경로 정규화: Windows backslash → 슬래시 통일.
 * why: Windows 에서 path.join 이 backslash 를 반환 — 크로스플랫폼 비교를 위해 통일.
 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * src/app/[locale] 하위 .tsx 파일을 재귀 수집 (*.test.tsx 제외).
 * why: glob 라이브러리의 posix 옵션이 Windows 에서 0 파일 매치하는 버그를 회피.
 *      Node fs.readdir 재귀 워크는 플랫폼 무관하게 실제 파일 시스템을 탐색한다.
 */
async function collectTsxFiles(dirPath: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.tsx') &&
        !entry.name.endsWith('.test.tsx')
      ) {
        results.push(normalizePath(fullPath));
      }
    }
  }

  await walk(dirPath);
  return results;
}

/**
 * 상대 경로 추출 (프로젝트 루트 기준, 슬래시 통일).
 * why: allowlist / CORE_ROUTE_FILES 는 `src/app/...` 형태로 저장되어 있어
 *      절대 경로를 프로젝트 루트 기준 상대 경로로 변환해야 비교 가능.
 */
function toRelative(absolutePath: string, projectRoot: string): string {
  return normalizePath(absolutePath).replace(normalizePath(projectRoot) + '/', '');
}

/**
 * allowlist 매칭: 상대 경로가 PHASE_B_ALLOWLIST 에 포함되는지 확인.
 */
function isInAllowlist(relPath: string): boolean {
  return PHASE_B_ALLOWLIST.some((al) => relPath === al || relPath.endsWith('/' + al));
}

/**
 * 주석 / 특수 구문 내 한글인지 확인하는 경량 필터.
 *
 * 왜 경량 필터인가: 완전한 AST 파싱 없이 줄 단위로 처리한다.
 * 규칙: 아래 중 하나에 해당하면 해당 줄은 "허용" (한글 있어도 위반 아님):
 *   1. 줄 전체가 // 주석 (선행 공백 무관)
 *   2. 줄 전체가 * 주석 블록 행 (JSDoc / block comment)
 *   3. 줄에 "@i18n-allow" 마커 포함 (명시적 화이트리스트)
 *   4. JSX 블록 주석 행: 줄이 {/* 로 시작하거나, 줄이 JSX 주석 블록 내부 (inJsxComment=true)
 *   5. 코드 뒤 인라인 // 주석: 한글이 // 이후에만 등장하는 경우
 *      (줄에서 // 위치를 찾아 그 앞 부분에 한글이 없으면 허용)
 *   6. @i18n-allow 마커가 있는 블록 안의 metadata 줄
 *      (직전 줄에 @i18n-allow 가 있고 현재 줄이 key: '...' 형태인 경우)
 *
 * NOTE: JSX 안 한글은 이 필터를 통과 → 위반으로 잡힘 (의도된 동작).
 */
function analyzeLines(lines: string[]): number[] {
  // 위반 줄 번호 (1-indexed)
  const violationLines: number[] = [];
  let inJsxComment = false;
  let prevHadI18nAllow = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trimStart();

    // JSX 블록 주석 상태 업데이트 (멀티라인 {/* ... */})
    // 시작: 줄에 {/* 포함, 종료: 줄에 */} 포함
    if (trimmed.startsWith('{/*') || (inJsxComment && !line.includes('*/'))) {
      if (trimmed.startsWith('{/*')) {
        inJsxComment = true;
      }
      if (inJsxComment) {
        // 이 줄에 */ 가 있으면 블록 종료
        if (line.includes('*/')) {
          inJsxComment = false;
        }
        // JSX 블록 주석 내부 — 한글 있어도 허용
        prevHadI18nAllow = false;
        continue;
      }
    }
    // */} 로 끝나는 JSX 주석 종료 줄도 허용
    if (inJsxComment) {
      if (line.includes('*/')) {
        inJsxComment = false;
      }
      prevHadI18nAllow = false;
      continue;
    }

    if (!KOREAN_RE.test(line)) {
      // 한글 없음 — @i18n-allow 마커 여부를 추적.
      // 주의: 마커가 없는 코드 줄(예: `export const metadata = {`)은 블록 전파를 끊지 않도록
      //   이미 true 인 경우 유지. 마커를 명시적으로 포함한 경우만 true 로 세팅.
      if (line.includes('@i18n-allow')) {
        prevHadI18nAllow = true;
      }
      // 한글 없는 줄이 } 또는 ]; 등 블록 닫힘 구분자이면 전파 종료
      const closingPattern = /^\s*[}\]];?\s*$/.test(trimmed);
      if (closingPattern) {
        prevHadI18nAllow = false;
      }
      continue;
    }

    // === 한글이 있는 줄 ===

    // 규칙 1: // 로 시작하는 줄 전체 주석
    // why: @i18n-allow 마커가 // 주석 줄에 있으면 다음 metadata 값 줄도 허용하기 위해
    //      prevHadI18nAllow 를 true 로 유지.
    if (trimmed.startsWith('//')) {
      prevHadI18nAllow = line.includes('@i18n-allow');
      continue;
    }

    // 규칙 2: * 또는 /* 로 시작하는 블록 주석 행 (JSDoc /** ... */ 포함)
    if (trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      prevHadI18nAllow = line.includes('@i18n-allow');
      continue;
    }

    // 규칙 3: @i18n-allow 마커 포함
    if (line.includes('@i18n-allow')) {
      prevHadI18nAllow = true;
      continue;
    }

    // 규칙 4: 직전 줄에 @i18n-allow 가 있고 현재 줄이 metadata 값 줄
    // 판단 기준: trimmed 가 `key: '...',` 또는 `'...',` 또는 `description:` 등
    // metadata 블록 내부 값 줄 패턴 (간단 휴리스틱)
    if (prevHadI18nAllow) {
      const isMetadataValue =
        /^['"`]/.test(trimmed) ||          // 문자열 값 줄
        /^\w[\w.]*\s*:/.test(trimmed);      // key: 형태
      if (isMetadataValue) {
        // 이 줄도 허용 — prevHadI18nAllow 는 유지 (연속 metadata 줄 허용)
        continue;
      }
    }

    // 규칙 5: 인라인 // 주석 — 한글이 // 이후에만 있는 경우
    // why: `currentTariffId: null, // provider 변경 시 tariff 초기화` 같은 줄에서
    //      코드 부분(null,)에는 한글 없고 주석 부분에만 한글이 있으면 허용.
    const inlineCommentIdx = line.indexOf('//');
    if (inlineCommentIdx >= 0) {
      const codePartBeforeComment = line.slice(0, inlineCommentIdx);
      if (!KOREAN_RE.test(codePartBeforeComment)) {
        // 한글이 코드 부분에 없음 (주석에만 있음) → 허용
        prevHadI18nAllow = false;
        continue;
      }
    }

    // 허용 조건 미충족 → 위반
    prevHadI18nAllow = false;
    violationLines.push(i + 1); // 1-indexed
  }

  return violationLines;
}

/**
 * Rule 1: 한글 리터럴 0 검사
 * allowlist 파일은 건너뜀.
 */
async function checkNoKoreanLiterals(
  files: string[],
  projectRoot: string,
): Promise<void> {
  for (const filePath of files) {
    const relPath = toRelative(filePath, projectRoot);

    // allowlist 파일은 Phase B 대기 — 스킵
    if (isInAllowlist(relPath)) {
      continue;
    }

    const text = await readFile(filePath, 'utf-8');
    const lines = text.split(/\r?\n/);
    const violationLineNums = analyzeLines(lines);

    for (const lineNum of violationLineNums) {
      const lineText = lines[lineNum - 1] ?? '';
      violations.push({
        level: 'error',
        rule: 'korean-literal-in-tsx',
        file: relPath,
        // 1-indexed 라인 번호 (사람이 읽기 편한 형식)
        line: lineNum,
        detail: `한글 리터럴 발견: ${lineText.trim().slice(0, 80)}`,
      });
    }
  }
}

/**
 * Rule 2: 핵심 라우트 파일에 useTranslations / getTranslations import 존재
 * Phase B allowlist 에 있는 핵심 라우트 파일은 이 규칙도 스킵.
 */
async function checkTranslationsImport(
  files: string[],
  projectRoot: string,
): Promise<void> {
  // 파일 경로 슬래시 정규화
  const fileSet = new Set(files.map((f) => normalizePath(f)));

  for (const coreFile of CORE_ROUTE_FILES) {
    // allowlist 파일은 스킵 (Phase B 대기)
    if (isInAllowlist(coreFile)) {
      continue;
    }

    // 파일 집합 안에 있는지 확인 (절대 경로로 찾기)
    const found = [...fileSet].find((f) => {
      const rel = toRelative(f, projectRoot);
      return rel === coreFile;
    });

    if (!found) {
      // 파일 자체가 없으면 별도 체크 (missing file — import 검사 스킵)
      continue;
    }

    const text = await readFile(found, 'utf-8');
    const hasTranslationsImport =
      text.includes('useTranslations') || text.includes('getTranslations');

    if (!hasTranslationsImport) {
      violations.push({
        level: 'error',
        rule: 'missing-translations-import',
        file: coreFile,
        line: 0,
        detail: `핵심 라우트 파일에 useTranslations / getTranslations import 없음`,
      });
    }
  }
}

async function main(): Promise<void> {
  // 프로젝트 루트 = process.cwd() (pnpm 스크립트로 실행 시 프로젝트 루트)
  const projectRoot = normalizePath(process.cwd());
  const localeDir = path.join(process.cwd(), 'src', 'app', '[locale]');

  // ── 그룹 1: src/app/[locale] 하위 .tsx 파일 수집 (Node fs 재귀 워크 — 크로스플랫폼) ──
  const allFiles = await collectTsxFiles(localeDir);

  // 루트 src/app/layout.tsx 제외 (next-intl 공식 비대상 — [locale] 하위만)
  const targetFiles = allFiles.filter(
    (f) => !f.endsWith('src/app/layout.tsx'),
  );

  // 자가검증: 0 파일이면 게이트가 false GREEN — 즉시 FATAL
  console.log(`[harness:i18n] [locale] 대상 파일 수: ${targetFiles.length}`);
  if (targetFiles.length === 0) {
    console.error(
      `[harness:i18n] FATAL — src/app/[locale] 대상 파일 0개. 경로 확인 필요: ${localeDir}`,
    );
    process.exit(2);
  }

  // ── 그룹 2 (ADR-0036 D2): src/components/**/*.tsx 수집 — *.test.tsx 제외 ──
  // why: 공유 컴포넌트(PriceWithSource/StaleLabel 등)의 한글 누출이 harness 사각이었음.
  //      collectTsxFiles 의 test 제외 규칙(*.test.tsx 제외)을 그대로 재사용한다.
  const componentsDir = path.join(process.cwd(), 'src', 'components');
  const componentFiles = await collectTsxFiles(componentsDir);

  // 자가검증: src/components 에 .tsx 파일이 0개면 경로/구조 이상 — FATAL
  console.log(`[harness:i18n] components 대상 파일 수: ${componentFiles.length}`);
  if (componentFiles.length === 0) {
    console.error(
      `[harness:i18n] FATAL — src/components 대상 .tsx 파일 0개. 경로 확인 필요: ${componentsDir}`,
    );
    process.exit(2);
  }

  // ── 그룹 3 (ADR-0036 D2): src/types/comparison-input.ts 단일 파일 화이트리스트 ──
  // why: Zod 메시지 한국어 하드코딩이 이 .ts 1파일에만 실증됨.
  //      src/**/*.ts 전체 확장은 dev throw·주석·픽스처 오탐을 폭증시키므로 거부(ADR-0036 §대안).
  const comparisonInputPath = normalizePath(
    path.join(process.cwd(), 'src', 'types', 'comparison-input.ts'),
  );

  // 자가검증: comparison-input.ts 가 없으면 FATAL (파일 이동/삭제 시 게이트 false GREEN 방지)
  try {
    await access(comparisonInputPath);
  } catch {
    console.error(
      `[harness:i18n] FATAL — src/types/comparison-input.ts 파일 없음. 경로 확인 필요: ${comparisonInputPath}`,
    );
    process.exit(2);
  }
  console.log(`[harness:i18n] comparison-input.ts 확인됨: ${comparisonInputPath}`);

  // ── 한글 리터럴 검사 실행 ──────────────────────────────────────────────────
  // 그룹 1(locale route) + 그룹 2(components) + 그룹 3(comparison-input.ts) 통합.
  // import 검사(useTranslations/getTranslations)는 CORE_ROUTE_FILES 한정 — 신규 그룹엔 적용 안 함.
  await Promise.all([
    checkNoKoreanLiterals([...targetFiles, ...componentFiles, comparisonInputPath], projectRoot),
    checkTranslationsImport(targetFiles, projectRoot),
  ]);

  // ─── 결과 출력 ────────────────────────────────────────────────────────────
  if (violations.length === 0) {
    const allowlistCount = PHASE_B_ALLOWLIST.length;
    console.log(
      `[harness:i18n] GREEN — 한글 리터럴 0 + translations import 정합.\n` +
      `  스캔 범위: [locale](${targetFiles.length}) + components(${componentFiles.length}) + comparison-input.ts(1)\n` +
      `  Phase B allowlist: ${allowlistCount}개 파일 대기 중 (4.5.j.4.B 완료 시 0 예정).`,
    );
    process.exit(0);
  }

  console.error(`\n[harness:i18n] RED — ${violations.length}건 위반:\n`);
  for (const v of violations) {
    const loc = v.line > 0 ? `:${v.line}` : '';
    console.error(`  [${v.rule}] ${v.file}${loc}\n    ${v.detail}\n`);
  }
  const errors = violations.filter((v) => v.level === 'error').length;
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err: unknown) => {
  console.error('[harness:i18n] 실행 실패:', err);
  process.exit(2);
});
