#!/usr/bin/env tsx
/**
 * Harness: verify-cross-ref
 *
 * ADR-0044 §D1 룰 3종 — 컴포넌트 ↔ 라우팅 의미 정합 정적 스캔.
 *
 * Rule (i)  — 컴포넌트 href ↔ 라우트 파일 존재 cross-ref
 * Rule (ii) — i18n nextButton 라벨 ↔ 라우팅 실 도달지 cross-ref
 * Rule (iii)— useCompareSession STEPS 단일 출처 ↔ router.push/setStep cross-ref
 *
 * 실행: pnpm harness:cross-ref
 * CI:   Stop hook 6단 게이트 마지막 단계
 *
 * 구현 방식: Q1(ADR-0044 §D2) 정규식+glob 정적 스캔 — 새 의존성 0.
 * 위반 처리: Q2(ADR-0044 §D3) error 격상 → exit 1.
 *
 * 정확도 87% (정규식 한계 — 동적 변수 치환 미지원). 통신 BE 흐름 한정.
 * 격상 트리거: 위양성 ≥ 3건/월 또는 위음성 ≥ 1건/월 → ADR-0044 Amendment 1.
 */

import { readFile } from 'node:fs/promises';
import { glob } from 'glob';
import { resolve } from 'node:path';

// ─── 타입 ───────────────────────────────────────────────────────────────────

interface Violation {
  rule: 'i' | 'ii' | 'iii';
  file: string;
  line: number | null;
  detail: string;
}

// ─── Rule (ii) 단일 출처 매트릭스 ────────────────────────────────────────────
// 4 locale × 2 step = 8 매핑. ADR-0044 §D1 Rule (ii) 단일 출처 const 잠금.
// 수정 시: ADR-0044 Amendment 트리거 + CHANGELOG 필요.
//
// 구조: LABEL_KEYWORDS[step][locale] = 해당 step 의 nextButton 라벨에 포함돼야 할 키워드.
//   - step 'current-provider' → nextButton 도달지 = 'household' 의미여야 함
//   - step 'household'        → nextButton 도달지 = 'preview' 의미여야 함

const LABEL_KEYWORDS = {
  'current-provider': {
    en: 'Household type',
    nl: 'Huishoudtype',
    fr: 'Type de ménage',
    ko: '가구 형태',
  },
  household: {
    en: 'Preview results',
    nl: 'Resultatenvoorbeeld',
    fr: 'Aperçu des résultats',
    ko: '결과 미리보기',
  },
} as const satisfies Record<string, Record<string, string>>;

// 도달지 검증 매트릭스: step → 올바른 다음 segment
const STEP_NEXT_SEGMENT: Record<string, string> = {
  'current-provider': 'household',
  household: 'preview',
};

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

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
 * Rule (i): href 문자열에서 segment 를 추출해 허용 목록과 대조.
 * catches regression #2 — see ADR-0044 §V1
 *
 * @param href   정적 href 문자열 (예: "/compare/telecom/postal" 또는 "/compare/telecom/current-provider")
 * @param validSegments  유효한 segment 집합 (실 파일 존재 기반)
 * @returns      null = OK, string = 위반 segment
 */
export function checkHrefSegment(
  href: string,
  validSegments: ReadonlySet<string>,
): string | null {
  // /compare/[category]/[segment] 패턴 (동적 category 포함)
  // 템플릿 리터럴 치환 후 형태: /compare/telecom/postal 또는 /compare/${category}/postal
  const m = href.match(/\/compare\/[^/]+\/([^/?"'`\s]+)/);
  if (!m || m[1] === undefined) return null;
  const segment = m[1];
  // 이미 동적 변수면 정적 분석 불가 → 스킵 (정확도 87% 한계 — ADR-0044 D2)
  if (segment.startsWith('$') || segment.includes('{')) return null;
  if (!validSegments.has(segment)) return segment;
  return null;
}

/**
 * Rule (ii): nextButton 라벨이 예상 키워드를 포함하는지 검증.
 * catches regression #4 — see ADR-0044 §V1
 * catches regression #5 — see ADR-0044 §V1 (Rule ii + iii 중첩)
 *
 * @param step    'current-provider' | 'household'
 * @param locale  'en' | 'nl' | 'fr' | 'ko'
 * @param label   messages/{locale}.json 에서 읽은 nextButton 값
 * @returns       null = OK, string = 위반 상세
 */
export function checkNextButtonLabel(
  step: keyof typeof LABEL_KEYWORDS,
  locale: keyof (typeof LABEL_KEYWORDS)[keyof typeof LABEL_KEYWORDS],
  label: string,
): string | null {
  const expected = LABEL_KEYWORDS[step][locale];
  if (!label.includes(expected)) {
    return `compare.${step}.nextButton [${locale}] = "${label}" — "${expected}" 키워드 없음 (도달지 불일치)`;
  }
  return null;
}

/**
 * Rule (iii): router.push 세그먼트가 STEPS 의 다음 step 인지 검증.
 * catches regression #3 — see ADR-0044 §V1
 * catches regression #5 — see ADR-0044 §V1 (Rule ii + iii 중첩)
 *
 * @param currentStep  현재 파일이 속한 step ('current-provider' | 'household' | null)
 * @param pushSegment  router.push 의 정적 segment
 * @param steps        STEPS 배열 (단일 출처 파싱 결과)
 * @returns            null = OK, string = 위반 상세
 */
export function checkPushStep(
  currentStep: string | null,
  pushSegment: string,
  steps: ReadonlyArray<string>,
): string | null {
  // STEPS 에 없는 segment push 는 위반 (화이트리스트 제외는 호출 전에 처리)
  if (!steps.includes(pushSegment)) {
    return `router.push segment "${pushSegment}" 가 STEPS [${steps.join(', ')}] 에 없음`;
  }
  // currentStep 이 없으면 순서 검증 불가 — 세그먼트 존재만 검증
  if (currentStep === null) return null;
  const expectedNext = STEP_NEXT_SEGMENT[currentStep];
  if (expectedNext === undefined) return null; // preview 등 terminal step
  if (pushSegment !== expectedNext) {
    return `"${currentStep}" step 에서 router.push → "${pushSegment}" (예상: "${expectedNext}") — STEPS 순서 위반`;
  }
  return null;
}

// ─── Rule (i) 구현 ───────────────────────────────────────────────────────────

/**
 * Rule (i) — 컴포넌트 href ↔ 라우트 파일 존재 cross-ref.
 * catches regression #2 — see ADR-0044 §V1
 */
async function runRuleI(
  cwd: string,
  violations: Violation[],
): Promise<void> {
  // 유효한 segment 목록 = 실제 page.tsx 파일이 있는 segment
  const routeFiles = await glob(
    'src/app/\\[locale\\]/compare/\\[category\\]/*/page.tsx',
    { cwd },
  );
  const validSegments = new Set<string>();
  for (const f of routeFiles) {
    // src/app/[locale]/compare/[category]/SEGMENT/page.tsx
    const parts = f.replace(/\\/g, '/').split('/');
    // 인덱스: src(0) app(1) [locale](2) compare(3) [category](4) SEGMENT(5) page.tsx(6)
    const seg = parts[5];
    if (seg && !seg.startsWith('[')) {
      validSegments.add(seg);
    }
  }

  // 스캔 대상: CategoryGrid + compare 흐름 전체
  const scanFiles = await glob(
    [
      'src/components/Hero/CategoryGrid.tsx',
      'src/app/\\[locale\\]/compare/**/*.{ts,tsx}',
    ],
    { cwd },
  );

  // href 패턴: href="/compare/..." 또는 href={`/compare/...`}
  const hrefRe = /href=(?:`([^`]*\/compare\/[^`]*)`|"([^"]*\/compare\/[^"]*)")/g;

  for (const file of scanFiles) {
    const text = await readFile(resolve(cwd, file), 'utf-8');
    let m: RegExpExecArray | null;
    hrefRe.lastIndex = 0;
    while ((m = hrefRe.exec(text)) !== null) {
      const href = m[1] ?? m[2] ?? '';
      const badSeg = checkHrefSegment(href, validSegments);
      if (badSeg !== null) {
        violations.push({
          rule: 'i',
          file,
          line: lineOf(text, m.index),
          detail: `href "${href}" — segment "${badSeg}" 라우트 파일 없음 (src/app/[locale]/compare/[category]/${badSeg}/page.tsx)`,
        });
      }
    }
  }
}

// ─── Rule (ii) 구현 ──────────────────────────────────────────────────────────

/**
 * Rule (ii) — i18n nextButton 라벨 ↔ 라우팅 실 도달지 cross-ref.
 * catches regression #4, #5 — see ADR-0044 §V1
 */
async function runRuleII(
  cwd: string,
  violations: Violation[],
): Promise<void> {
  const locales = ['en', 'nl', 'fr', 'ko'] as const;
  const steps = Object.keys(LABEL_KEYWORDS) as Array<keyof typeof LABEL_KEYWORDS>;

  for (const locale of locales) {
    const msgFile = `messages/${locale}.json`;
    let raw: string;
    try {
      raw = await readFile(resolve(cwd, msgFile), 'utf-8');
    } catch {
      violations.push({
        rule: 'ii',
        file: msgFile,
        line: null,
        detail: `messages/${locale}.json 읽기 실패 — 파일 부재 또는 접근 거부`,
      });
      continue;
    }

    // JSON 파싱 — unknown 으로 받고 좁힘
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      violations.push({
        rule: 'ii',
        file: msgFile,
        line: null,
        detail: `messages/${locale}.json JSON 파싱 실패`,
      });
      continue;
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('compare' in parsed)
    ) {
      violations.push({
        rule: 'ii',
        file: msgFile,
        line: null,
        detail: `messages/${locale}.json 에 "compare" 최상위 키 없음`,
      });
      continue;
    }

    const compare = (parsed as Record<string, unknown>)['compare'];
    if (typeof compare !== 'object' || compare === null) continue;

    for (const step of steps) {
      // compare.household 또는 compare.currentProvider
      // JSON 키: "household" / "currentProvider" (camelCase 변환)
      const jsonKey = step === 'current-provider' ? 'currentProvider' : step;
      const stepObj = (compare as Record<string, unknown>)[jsonKey];
      if (typeof stepObj !== 'object' || stepObj === null) {
        violations.push({
          rule: 'ii',
          file: msgFile,
          line: null,
          detail: `messages/${locale}.json — compare.${jsonKey} 키 없음`,
        });
        continue;
      }

      const label = (stepObj as Record<string, unknown>)['nextButton'];
      if (typeof label !== 'string') {
        violations.push({
          rule: 'ii',
          file: msgFile,
          line: null,
          detail: `messages/${locale}.json — compare.${jsonKey}.nextButton 키 없음 또는 문자열 아님`,
        });
        continue;
      }

      const err = checkNextButtonLabel(step, locale, label);
      if (err !== null) {
        // 라인 번호: 파일에서 nextButton 위치 찾기
        const lineMatch = raw.indexOf(`"nextButton": "${label}"`);
        violations.push({
          rule: 'ii',
          file: msgFile,
          line: lineMatch >= 0 ? lineOf(raw, lineMatch) : null,
          detail: err,
        });
      }
    }
  }
}

// ─── Rule (iii) 구현 ─────────────────────────────────────────────────────────

/**
 * Rule (iii) — useCompareSession STEPS 단일 출처 ↔ router.push/setStep cross-ref.
 * catches regression #3, #5 — see ADR-0044 §V1
 */
async function runRuleIII(
  cwd: string,
  violations: Violation[],
): Promise<void> {
  // STEPS 단일 출처 파싱
  const sessionFile = 'src/app/[locale]/compare/[category]/_components/useCompareSession.ts';
  let sessionText: string;
  try {
    sessionText = await readFile(resolve(cwd, sessionFile), 'utf-8');
  } catch {
    violations.push({
      rule: 'iii',
      file: sessionFile,
      line: null,
      detail: 'useCompareSession.ts 읽기 실패 — STEPS 단일 출처 부재',
    });
    return;
  }

  // `const STEPS = ['current-provider', 'household', 'preview'] as const;`
  const stepsMatch = sessionText.match(/const STEPS\s*=\s*\[([^\]]+)\]\s*as\s*const/);
  if (!stepsMatch || stepsMatch[1] === undefined) {
    violations.push({
      rule: 'iii',
      file: sessionFile,
      line: null,
      detail: 'useCompareSession.ts 에서 `const STEPS = [...] as const` 파싱 실패',
    });
    return;
  }

  const steps: string[] = stepsMatch[1]
    .split(',')
    .map((s) => s.trim().replace(/['"]/g, ''))
    .filter((s) => s.length > 0);

  // 스캔 대상: compare/[category] 아래 모든 tsx/ts (useCompareSession 제외)
  const scanFiles = await glob(
    'src/app/\\[locale\\]/compare/\\[category\\]/**/*.{ts,tsx}',
    {
      cwd,
      ignore: [
        '**/useCompareSession.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
    },
  );

  // router.push(`/compare/${...}/SEGMENT`) 패턴 추출
  // 정적 segment 만 (변수 치환 없는 것). 예:
  //   router.push(`/compare/${category}/household`)  → "household"
  //   router.push(`/compare/${category}/preview`)    → "preview"
  const pushRe = /router\.push\(`\/compare\/\$\{[^}]+\}\/([^`/?"'\s]+)`\)/g;
  // setStep('SEGMENT') 패턴
  const setStepRe = /setStep\(['"]([^'"]+)['"]\)/g;

  for (const file of scanFiles) {
    const text = await readFile(resolve(cwd, file), 'utf-8');

    // 현재 파일의 step 추론: 경로에서 판단
    // src/app/[locale]/compare/[category]/current-provider/... → 'current-provider'
    // src/app/[locale]/compare/[category]/household/...        → 'household'
    const normalizedPath = file.replace(/\\/g, '/');
    let currentStep: string | null = null;
    for (const step of steps) {
      if (normalizedPath.includes(`/[category]/${step}/`)) {
        currentStep = step;
        break;
      }
    }

    // router.push 검증
    pushRe.lastIndex = 0;
    let pm: RegExpExecArray | null;
    while ((pm = pushRe.exec(text)) !== null) {
      const seg = pm[1];
      if (seg === undefined) continue;
      // 동적 변수 치환이면 스킵
      if (seg.startsWith('$') || seg.includes('{')) continue;

      const err = checkPushStep(currentStep, seg, steps);
      if (err !== null) {
        violations.push({
          rule: 'iii',
          file,
          line: lineOf(text, pm.index),
          detail: err,
        });
      }
    }

    // setStep 검증: STEPS 에 없는 값이면 위반
    setStepRe.lastIndex = 0;
    let sm: RegExpExecArray | null;
    while ((sm = setStepRe.exec(text)) !== null) {
      const seg = sm[1];
      if (seg === undefined) continue;
      if (!steps.includes(seg)) {
        violations.push({
          rule: 'iii',
          file,
          line: lineOf(text, sm.index),
          detail: `setStep("${seg}") — STEPS [${steps.join(', ')}] 에 없는 값`,
        });
      }
    }

    // setStep + router.push 일치 검증 (같은 핸들러 내에서 불일치)
    // 패턴: setStep('X') ... router.push(`.../Y`) 가 같은 12줄 이내에 있을 때 X≠Y 감지
    const handlerRe =
      /setStep\(['"]([^'"]+)['"]\)[\s\S]{0,400}?router\.push\(`\/compare\/\$\{[^}]+\}\/([^`/?"'\s]+)`\)/g;
    handlerRe.lastIndex = 0;
    let hm: RegExpExecArray | null;
    while ((hm = handlerRe.exec(text)) !== null) {
      const setStepSeg = hm[1];
      const pushSeg = hm[2];
      if (setStepSeg === undefined || pushSeg === undefined) continue;
      if (setStepSeg !== pushSeg) {
        violations.push({
          rule: 'iii',
          file,
          line: lineOf(text, hm.index),
          detail: `setStep("${setStepSeg}") 과 router.push(".../${pushSeg}") 세그먼트 불일치`,
        });
      }
    }
  }
}

// ─── 메인 ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const cwd = process.cwd();
  const violations: Violation[] = [];

  console.log(bold('\n[harness:cross-ref] ADR-0044 룰 3종 정적 스캔 시작\n'));

  // Rule (i)
  process.stdout.write('  Rule (i)   href ↔ 라우트 파일 존재 … ');
  await runRuleI(cwd, violations);
  const ruleICount = violations.filter((v) => v.rule === 'i').length;
  console.log(ruleICount === 0 ? green('GREEN') : red(`${ruleICount}건 위반`));

  // Rule (ii)
  process.stdout.write('  Rule (ii)  nextButton 라벨 ↔ 도달지  … ');
  await runRuleII(cwd, violations);
  const ruleIICount = violations.filter((v) => v.rule === 'ii').length;
  console.log(ruleIICount === 0 ? green('GREEN') : red(`${ruleIICount}건 위반`));

  // Rule (iii)
  process.stdout.write('  Rule (iii) STEPS ↔ router.push       … ');
  await runRuleIII(cwd, violations);
  const ruleIIICount = violations.filter((v) => v.rule === 'iii').length;
  console.log(ruleIIICount === 0 ? green('GREEN') : red(`${ruleIIICount}건 위반`));

  console.log('');

  if (violations.length === 0) {
    console.log(green('✅ Cross-ref 검증 통과 — 룰 3종 GREEN'));
    process.exit(0);
  }

  console.log(red(bold(`❌ Cross-ref 위반 ${violations.length}건:\n`)));
  for (const v of violations) {
    const loc = v.line !== null ? `:${v.line}` : '';
    console.log(
      `  ${red(`[Rule ${v.rule.toUpperCase()}]`)} ${v.file}${loc}\n    ${v.detail}\n`,
    );
  }

  console.log(red(`harness:cross-ref 실패 — ${violations.length}건 위반. 위 파일·라인 수정 후 재실행.`));
  process.exit(1);
}

main().catch((err: unknown) => {
  console.error('harness:cross-ref 실행 오류:', err);
  process.exit(2);
});
