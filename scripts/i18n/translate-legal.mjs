/**
 * translate-legal.mjs — legal.* + 다중 네임스페이스 DeepL retarget 스크립트.
 *
 * PLAN 4.5.j.3.a — ADR-0040 D1 (DeepL+legal hybrid 1단계).
 * PLAN 4.5.j.4.B.4 — 4 네임스페이스 확장 (affiliateInterstitial / legal.affiliateDisclosure 본문 /
 *                      dataSources / unsubscribe / metadata.{dataSources,affiliateDisclosure,admin}).
 *
 * 실행 방법:
 *   pnpm tsx --env-file=.env.local scripts/i18n/translate-legal.mjs
 *
 * 동작:
 *   1. messages/ko.json 에서 대상 네임스페이스 리프 키 수집
 *   2. messages/{nl,fr,en}.json 에서 해당 키 중 [locale] prefix 잔존 키만 선별
 *      (incremental 모드 — 기존 실번역 무손상)
 *   3. ko 원문 기준 DeepL ko→{NL,FR,EN-US} 번역
 *      ICU {var} 패턴은 var-protection (encodeVars/decodeVars 인라인) 적용
 *   4. {nl,fr,en}.json 해당 키만 교체 + [locale] prefix 제거
 *
 * 왜 translate.mjs 와 별도인가:
 *   translate.mjs 는 legal.* 를 명시적으로 제외한다 (PLAN 4.5.j.3 경계 잠금).
 *   본 스크립트가 legal.* + 신설 네임스페이스를 전담한다.
 *
 * 경계 잠금:
 *   - TARGET_NAMESPACES 에 명시된 키 공간만 변경
 *   - compare.* / result.* / home.* / footer.* / caveats.* 등 변경 0
 *   - messages/{nl-BE,nl-NL,fr-BE,fr-LU}.json 변경 0 (base 상속)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = join(__dirname, '../../messages');

// ─── DeepL 설정 ───────────────────────────────────────────────────────────────

const DEEPL_API_KEY = process.env['DEEPL_API_KEY'];
if (!DEEPL_API_KEY) {
  console.error('ERROR: DEEPL_API_KEY 미설정');
  console.error('  실행: pnpm tsx --env-file=.env.local scripts/i18n/translate-legal.mjs');
  process.exit(1);
}

const DEEPL_ENDPOINT = 'https://api-free.deepl.com/v2/translate';

const TARGET_LANGS = [
  { lang: 'NL', locale: 'nl' },
  { lang: 'FR', locale: 'fr' },
  { lang: 'EN-US', locale: 'en' },
];

/**
 * 대상 네임스페이스 목록.
 * 각 항목은 ko.json 의 최상위 키 경로 (배열) + 설명.
 *
 * 왜 배열로 경로를 표현하는가:
 *   legal.affiliateDisclosure 처럼 중첩 네임스페이스를 ['legal','affiliateDisclosure']
 *   로 표현해 getByPath / setByPath 와 동일한 인터페이스 사용.
 */
const TARGET_NAMESPACES = [
  // 4.5.j.4.B.4 신설 — affiliateInterstitial (최상위)
  { nsPath: ['affiliateInterstitial'], label: 'affiliateInterstitial.*' },
  // 4.5.j.3.a + 4.5.j.4.B.4 — legal.affiliateDisclosure (중첩)
  { nsPath: ['legal', 'affiliateDisclosure'], label: 'legal.affiliateDisclosure.*' },
  // 4.5.j.4.B.4 신설 — dataSources (최상위)
  { nsPath: ['dataSources'], label: 'dataSources.*' },
  // 4.5.j.4.B.4 신설 — unsubscribe (최상위)
  { nsPath: ['unsubscribe'], label: 'unsubscribe.*' },
  // 4.5.j.4.B.4 신설 — metadata.dataSources (중첩)
  { nsPath: ['metadata', 'dataSources'], label: 'metadata.dataSources.*' },
  // 4.5.j.4.B.4 신설 — metadata.affiliateDisclosure (중첩)
  { nsPath: ['metadata', 'affiliateDisclosure'], label: 'metadata.affiliateDisclosure.*' },
  // 4.5.j.4.B.4 신설 — metadata.admin (중첩)
  { nsPath: ['metadata', 'admin'], label: 'metadata.admin.*' },
];

// ─── JSON 경로 유틸 ──────────────────────────────────────────────────────────

/**
 * 중첩 경로로 값 읽기.
 * @param {unknown} obj
 * @param {string[]} path
 * @returns {unknown}
 */
function getByPath(obj, path) {
  let cur = obj;
  for (const key of path) {
    if (cur && typeof cur === 'object' && key in /** @type {object} */ (cur)) {
      cur = /** @type {Record<string, unknown>} */ (cur)[key];
    } else {
      return undefined;
    }
  }
  return cur;
}

/**
 * 중첩 경로로 값 교체 (불변 — 새 객체 반환).
 * @param {unknown} obj
 * @param {string[]} path
 * @param {string} value
 * @returns {unknown}
 */
function setByPath(obj, path, value) {
  if (path.length === 0) return value;
  if (!obj || typeof obj !== 'object') return obj;
  const [head, ...rest] = path;
  const record = /** @type {Record<string, unknown>} */ (obj);
  return {
    ...record,
    [head]: setByPath(record[head], rest, value),
  };
}

// ─── var-protection 인라인 (var-protection.ts 와 동일 로직) ───────────────────
// 왜 인라인인가: .mjs 스크립트에서 TypeScript import 불가. 로직이 단순해 동기화 부담 작음.

/**
 * ICU {varName} 을 DeepL XML 태그 <x id="N"/> 로 인코딩.
 * 공백 정보 (spaceBefore/spaceAfter) 를 varStore 에 저장 → decodeVars 에서 복원.
 * @param {string} text
 * @param {Array<{name: string, spaceBefore: boolean, spaceAfter: boolean}>} varStore
 * @returns {string}
 */
function encodeVars(text, varStore) {
  return text.replace(/\{([^}]+)\}/g, (match, varName, offset) => {
    const spaceBefore = offset > 0 && text[offset - 1] === ' ';
    const spaceAfter = offset + match.length < text.length && text[offset + match.length] === ' ';
    const idx = varStore.length;
    varStore.push({ name: varName, spaceBefore, spaceAfter });
    return `<x id="${idx}"/>`;
  });
}

/**
 * DeepL 번역 결과에서 <x id="N"/> 태그를 {varName} 으로 복원.
 * ko 원문 공백 규칙 기준으로 번역문 공백 보정 (과교정 금지).
 * @param {string} text
 * @param {Array<{name: string, spaceBefore: boolean, spaceAfter: boolean}>} varStore
 * @returns {string}
 */
function decodeVars(text, varStore) {
  return text.replace(/<x id="(\d+)"\/>/g, (match, idxStr, offset, fullText) => {
    const idx = Number(idxStr);
    const entry = varStore[idx];
    if (!entry) return '{?}';

    const restored = `{${entry.name}}`;
    const hasSpaceBefore = offset > 0 && fullText[offset - 1] === ' ';
    const afterPos = offset + match.length;
    const hasSpaceAfter = afterPos < fullText.length && fullText[afterPos] === ' ';

    // ko 에 공백 있는데 번역문에 없으면 → 보정. ko 에 없으면 → 그대로.
    const prefix = entry.spaceBefore && !hasSpaceBefore ? ' ' : '';
    const suffix = entry.spaceAfter && !hasSpaceAfter ? ' ' : '';

    return `${prefix}${restored}${suffix}`;
  });
}

// ─── 리프 수집 + prefix 경로 수집 ────────────────────────────────────────────

/**
 * 네임스페이스 블록에서 모든 리프 경로 수집.
 * @param {unknown} obj
 * @param {string[]} pathStack
 * @returns {Array<{path: string[], value: string}>}
 */
function collectLeaves(obj, pathStack = []) {
  /** @type {Array<{path: string[], value: string}>} */
  const leaves = [];
  if (typeof obj === 'string') {
    leaves.push({ path: [...pathStack], value: obj });
  } else if (obj && typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj)) {
      if (key === '_comment') continue;
      leaves.push(...collectLeaves(val, [...pathStack, key]));
    }
  }
  return leaves;
}

/**
 * locale.json 의 네임스페이스 블록에서 [locale] prefix 잔존 경로 수집.
 * @param {unknown} nsBlock
 * @param {string} locale
 * @param {string[]} pathStack
 * @returns {string[][]}
 */
function collectPrefixPaths(nsBlock, locale, pathStack = []) {
  /** @type {string[][]} */
  const paths = [];
  if (typeof nsBlock === 'string') {
    if (nsBlock.startsWith(`[${locale}]`)) {
      paths.push([...pathStack]);
    }
  } else if (nsBlock && typeof nsBlock === 'object') {
    for (const [key, val] of Object.entries(nsBlock)) {
      if (key === '_comment') continue;
      paths.push(...collectPrefixPaths(val, locale, [...pathStack, key]));
    }
  }
  return paths;
}

// ─── DeepL API 호출 ──────────────────────────────────────────────────────────

/**
 * @param {string[]} texts  (var-encoded)
 * @param {string} targetLang
 * @returns {Promise<string[]>}
 */
async function deeplTranslate(texts, targetLang) {
  const BATCH_SIZE = 50;
  const results = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const body = new URLSearchParams();
    for (const text of batch) {
      body.append('text', text);
    }
    body.append('source_lang', 'KO');
    body.append('target_lang', targetLang);
    body.append('tag_handling', 'xml');
    body.append('ignore_tags', 'x');

    const res = await fetch(DEEPL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`DeepL API 오류 (${res.status}): ${errText}`);
    }

    const json = await res.json();
    for (const item of json.translations) {
      results.push(item.text);
    }

    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}

// ─── 실행 진입점 ─────────────────────────────────────────────────────────────

async function main() {
  console.log('=== translate-legal.mjs — 다중 네임스페이스 DeepL retarget (PLAN 4.5.j.4.B.4) ===');
  console.log('');

  const koPath = join(MESSAGES_DIR, 'ko.json');
  const koJson = JSON.parse(readFileSync(koPath, 'utf8'));

  // 대상 네임스페이스별 ko 리프 카운트 출력
  let totalKoLeaves = 0;
  for (const { nsPath, label } of TARGET_NAMESPACES) {
    const nsBlock = getByPath(koJson, nsPath);
    const leaves = collectLeaves(nsBlock);
    console.log(`ko.json ${label}: ${leaves.length}키`);
    totalKoLeaves += leaves.length;
  }
  console.log(`ko.json 전체 대상: ${totalKoLeaves}키 (architect 추정 ~119 정합 여부)\n`);

  let totalCharsPosted = 0;
  let totalTranslatedCount = 0;

  for (const { lang, locale } of TARGET_LANGS) {
    const outPath = join(MESSAGES_DIR, `${locale}.json`);
    const existingRaw = readFileSync(outPath, 'utf8');
    let existingJson = JSON.parse(existingRaw);

    // 네임스페이스별로 prefix 잔존 경로 수집 → 전체 통합
    /** @type {Array<{nsPath: string[], relPath: string[], koValue: string}>} */
    const allPendingLeaves = [];

    for (const { nsPath } of TARGET_NAMESPACES) {
      const nsBlock = getByPath(existingJson, nsPath);
      const prefixPaths = collectPrefixPaths(nsBlock ?? {}, locale);

      for (const relPath of prefixPaths) {
        const fullPath = [...nsPath, ...relPath];
        const koValue = String(getByPath(koJson, fullPath) ?? '');
        allPendingLeaves.push({ nsPath, relPath, koValue });
      }
    }

    // 4.5.j.3.a 호환: affiliateDisclosure.pageTitle 한국어 고정 회귀 감지
    const pageTitleFullPath = ['legal', 'affiliateDisclosure', 'pageTitle'];
    const pageTitleVal = String(getByPath(existingJson, pageTitleFullPath) ?? '');
    const pageTitleIsKorean = /[가-힣]/.test(pageTitleVal);
    const pageTitleAlreadyPending = allPendingLeaves.some(
      (l) => [...l.nsPath, ...l.relPath].join('.') === pageTitleFullPath.join('.'),
    );
    if (pageTitleIsKorean && !pageTitleAlreadyPending) {
      const koValue = String(getByPath(koJson, pageTitleFullPath) ?? '');
      allPendingLeaves.push({
        nsPath: ['legal', 'affiliateDisclosure'],
        relPath: ['pageTitle'],
        koValue,
      });
      console.log(`  [${locale}] legal.affiliateDisclosure.pageTitle — 한국어 고정 회귀 → retarget 포함`);
    }

    if (allPendingLeaves.length === 0) {
      console.log(`[${locale}] retarget 대상 0건 — 스킵`);
      continue;
    }

    console.log(`\n[${locale}] retarget ${allPendingLeaves.length}키 → ko→${lang} 번역 시작...`);

    // ICU var-protection: 인코딩
    /** @type {Array<Array<{name: string, spaceBefore: boolean, spaceAfter: boolean}>>} */
    const varStores = [];
    const encodedTexts = allPendingLeaves.map((leaf) => {
      /** @type {Array<{name: string, spaceBefore: boolean, spaceAfter: boolean}>} */
      const store = [];
      varStores.push(store);
      return encodeVars(leaf.koValue, store);
    });

    // chars 계산 (인코딩 후 — DeepL 실제 전송 텍스트 기준)
    const charsThisBatch = encodedTexts.reduce((sum, t) => sum + t.length, 0);
    totalCharsPosted += charsThisBatch;

    // DeepL 번역
    const translatedRaw = await deeplTranslate(encodedTexts, lang);
    totalTranslatedCount += translatedRaw.length;

    // ICU var-protection: 디코딩 + locale.json 교체
    for (let i = 0; i < allPendingLeaves.length; i++) {
      const { nsPath, relPath } = allPendingLeaves[i];
      const rawResult = translatedRaw[i] ?? '';
      const translatedValue = decodeVars(rawResult, varStores[i] ?? []);
      const fullPath = [...nsPath, ...relPath];
      const before = String(getByPath(existingJson, fullPath) ?? '');

      // ICU 변수 무결성 확인: varStore 에 있는 변수가 번역 결과에도 있는지
      const store = varStores[i] ?? [];
      for (const entry of store) {
        if (!translatedValue.includes(`{${entry.name}}`)) {
          console.warn(
            `  경고: ${locale}.${fullPath.join('.')} — {${entry.name}} 변수 유실! 수동 확인 필요`,
          );
          console.warn(`    ko 원문: "${allPendingLeaves[i].koValue.substring(0, 100)}"`);
          console.warn(`    번역 결과: "${translatedValue.substring(0, 100)}"`);
        }
      }

      if (before !== translatedValue) {
        const beforePreview = before.startsWith('[') ? before.substring(0, 50) : before.substring(0, 30);
        console.log(
          `    ${fullPath.join('.')}: "${beforePreview}..." → "${translatedValue.substring(0, 50)}..."`,
        );
      }

      existingJson = setByPath(existingJson, fullPath, translatedValue);
    }

    writeFileSync(outPath, JSON.stringify(existingJson, null, 2) + '\n', 'utf8');
    console.log(`  → ${outPath} 저장 완료 (${allPendingLeaves.length}키 retarget)`);
  }

  // ─── DeepL 사용량 확인 ───────────────────────────────────────────────────────
  console.log('\n=== DeepL 사용량 확인 ===');
  const usageRes = await fetch('https://api-free.deepl.com/v2/usage', {
    headers: { Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}` },
  });
  if (usageRes.ok) {
    const usage = await usageRes.json();
    console.log(
      `누적 사용량: ${usage.character_count.toLocaleString()} / ${usage.character_limit.toLocaleString()} 자`,
    );
    console.log(`이번 번역: ~${totalCharsPosted} encoded chars (${totalTranslatedCount} 텍스트 항목)`);
  }

  // ─── prefix 잔존 + 변경 경계 검증 ────────────────────────────────────────────
  console.log('\n=== prefix 잔존 검증 ===');
  let anyFail = false;
  for (const { locale } of TARGET_LANGS) {
    const outPath = join(MESSAGES_DIR, `${locale}.json`);
    const json = JSON.parse(readFileSync(outPath, 'utf8'));

    let prefixCount = 0;
    for (const { nsPath } of TARGET_NAMESPACES) {
      const nsBlock = getByPath(json, nsPath);
      const paths = collectPrefixPaths(nsBlock ?? {}, locale);
      prefixCount += paths.length;
    }

    // 4.5.j.3.a 호환: pageTitle 한국어 잔존 확인
    const pageTitle = String(
      getByPath(json, ['legal', 'affiliateDisclosure', 'pageTitle']) ?? '',
    );
    const hasKorean = /[가-힣]/.test(pageTitle);

    if (prefixCount > 0) {
      console.error(`  [${locale}] 대상 네임스페이스 prefix ${prefixCount}건 잔존 — 실패`);
      anyFail = true;
    } else {
      console.log(`  [${locale}] 대상 네임스페이스 prefix 0건 — 정상`);
    }
    if (hasKorean) {
      console.error(
        `  [${locale}] legal.affiliateDisclosure.pageTitle 한국어 잔존: "${pageTitle}" — 실패`,
      );
      anyFail = true;
    } else {
      console.log(
        `  [${locale}] legal.affiliateDisclosure.pageTitle: "${pageTitle.substring(0, 50)}" — 정상`,
      );
    }
  }

  // 경계 잠금: legal.terms/privacy/cookie 등 기존 키 변경 없음 확인
  console.log('\n=== 경계 잠금 검증 (legal.terms/privacy/cookie) ===');
  const BOUNDARY_PATHS = [
    ['legal', 'terms'],
    ['legal', 'privacy'],
    ['legal', 'cookie'],
  ];
  const koBaseForBoundary = JSON.parse(readFileSync(join(MESSAGES_DIR, 'ko.json'), 'utf8'));
  for (const bPath of BOUNDARY_PATHS) {
    const koBlock = getByPath(koBaseForBoundary, bPath);
    if (!koBlock) continue; // 없으면 검증 불요
    for (const { locale } of TARGET_LANGS) {
      const outPath = join(MESSAGES_DIR, `${locale}.json`);
      const json = JSON.parse(readFileSync(outPath, 'utf8'));
      // [locale] prefix 잔존 수집 (경계 블록에 prefix가 새로 생겼으면 경고)
      const bBlock = getByPath(json, bPath);
      const bPrefixPaths = collectPrefixPaths(bBlock ?? {}, locale);
      if (bPrefixPaths.length > 0) {
        console.warn(
          `  경고: [${locale}] ${bPath.join('.')} 에 prefix ${bPrefixPaths.length}건 — 경계 잠금 침범 의심`,
        );
      }
    }
  }
  console.log('  경계 잠금 검증 완료');

  if (anyFail) {
    console.error('\nERROR: 검증 실패 — 수동 확인 필요');
    process.exit(1);
  }

  console.log('\n=== 완료 ===');
  console.log('다음 단계:');
  console.log('  1. pnpm typecheck && pnpm lint && pnpm test:run');
  console.log('  2. pnpm harness:i18n && pnpm harness:plan && pnpm harness:data');
  console.log('  3. ADR-0033 §Verification #5 누적 카운트 갱신');
  console.log('  4. legal 에이전트 호출 — 4.5.j.3.b 패턴 nl/fr/en 본문 검수 (3차)');
}

main().catch((err) => {
  console.error('translate-legal.mjs 실패:', err);
  process.exit(1);
});
