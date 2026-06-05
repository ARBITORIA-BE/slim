/**
 * translate-legal.mjs — legal.* 네임스페이스 전용 DeepL 번역 스크립트.
 *
 * PLAN 4.5.j.3.a — ADR-0040 D1 (DeepL+legal hybrid 1단계).
 *
 * 실행 방법:
 *   pnpm tsx --env-file=.env.local scripts/i18n/translate-legal.mjs
 *
 * 동작:
 *   1. messages/ko.json 에서 legal.* 리프 키 수집 (103키)
 *   2. messages/{nl,fr,en}.json 에서 legal.* 중 [locale] prefix 잔존 키만 선별
 *      (incremental 모드 — 기존 실번역 무손상)
 *   3. ko 원문 기준 DeepL ko→{NL,FR,EN-US} 번역
 *   4. {nl,fr,en}.json legal.* 해당 키만 교체 + [locale] prefix 제거
 *
 * 왜 별도 스크립트인가:
 *   translate.mjs 의 모든 모드 (기본/incremental/retarget) 는 legal.*를
 *   명시적으로 제외한다 (PLAN 4.5.j.3 경계 — "4.5.j.3 legal 에이전트 처리").
 *   본 라운드 (4.5.j.3.a) 에서 legal.* 번역이 진입 결정됨 (ADR-0040 D1).
 *   translate.mjs 수정 = 경계 잠금 침범 위험 → 별도 스크립트로 격리.
 *
 * ADR-0040 D5 근거:
 *   legal.* 본문 ICU 변수 0건 실증 → var-protection.ts 적용 불요.
 *   단순 텍스트 번역 (tag_handling=xml 은 안전을 위해 유지).
 *
 * 경계 잠금 (ADR-0040 §가):
 *   - legal.* 네임스페이스만 변경
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

// ─── legal.* 리프 경로 수집 ───────────────────────────────────────────────────

/**
 * ko.json legal.* 블록에서 모든 리프 경로 수집.
 * @param {unknown} obj
 * @param {string[]} pathStack
 * @returns {Array<{path: string[], value: string}>}
 */
function collectLegalLeaves(obj, pathStack = []) {
  /** @type {Array<{path: string[], value: string}>} */
  const leaves = [];
  if (typeof obj === 'string') {
    leaves.push({ path: [...pathStack], value: obj });
  } else if (obj && typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj)) {
      if (key === '_comment') continue;
      leaves.push(...collectLegalLeaves(val, [...pathStack, key]));
    }
  }
  return leaves;
}

/**
 * locale.json 의 legal.* 블록에서 [locale] prefix 잔존 키만 선별.
 * affiliateDisclosure.pageTitle 은 prefix 없이 한국어 고정 — 별도 처리 필요.
 * @param {unknown} legalBlock
 * @param {string} locale
 * @param {string[]} pathStack (legal. 이하 경로)
 * @returns {string[][]}
 */
function collectLegalPrefixPaths(legalBlock, locale, pathStack = []) {
  /** @type {string[][]} */
  const paths = [];
  if (typeof legalBlock === 'string') {
    // [locale] prefix 잔존 키
    if (legalBlock.startsWith(`[${locale}] `)) {
      paths.push([...pathStack]);
    }
  } else if (legalBlock && typeof legalBlock === 'object') {
    for (const [key, val] of Object.entries(legalBlock)) {
      if (key === '_comment') continue;
      paths.push(...collectLegalPrefixPaths(val, locale, [...pathStack, key]));
    }
  }
  return paths;
}

// ─── DeepL API 호출 ──────────────────────────────────────────────────────────

/**
 * @param {string[]} texts
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
        'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
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
  console.log('=== translate-legal.mjs — legal.* DeepL retarget (PLAN 4.5.j.3.a) ===');
  console.log('');

  const koPath = join(MESSAGES_DIR, 'ko.json');
  const koJson = JSON.parse(readFileSync(koPath, 'utf8'));

  // ko.json legal.* 리프 전체 수집 (103키 기대)
  const allLegalLeaves = collectLegalLeaves(koJson.legal);
  console.log(`ko.json legal.* 리프: ${allLegalLeaves.length}키`);

  let totalCharsPosted = 0;
  let totalTranslatedCount = 0;

  for (const { lang, locale } of TARGET_LANGS) {
    const outPath = join(MESSAGES_DIR, `${locale}.json`);
    const existingRaw = readFileSync(outPath, 'utf8');
    let existingJson = JSON.parse(existingRaw);

    // [locale] prefix 잔존 경로 수집 (legal 블록 내)
    const prefixPaths = collectLegalPrefixPaths(existingJson.legal ?? {}, locale);

    // affiliateDisclosure.pageTitle = prefix 없이 한국어 고정 → 강제 포함
    const pageTitlePath = ['affiliateDisclosure', 'pageTitle'];
    const pageTitleVal = String(getByPath(existingJson.legal ?? {}, pageTitlePath) ?? '');
    const pageTitleIsKorean = /[가-힣]/.test(pageTitleVal);
    const pageTitleAlreadyInPrefixPaths = prefixPaths.some(
      (p) => p.join('.') === pageTitlePath.join('.'),
    );

    if (pageTitleIsKorean && !pageTitleAlreadyInPrefixPaths) {
      prefixPaths.push(pageTitlePath);
      console.log(`  [${locale}] affiliateDisclosure.pageTitle — 한국어 고정 회귀 → retarget 포함`);
    }

    if (prefixPaths.length === 0) {
      console.log(`[${locale}] retarget 대상 0건 — 스킵`);
      continue;
    }

    console.log(`\n[${locale}] retarget ${prefixPaths.length}키 → ko→${lang} 번역 시작...`);

    // ko 원문 수집 (legal. prefix 포함한 전체 경로로)
    const leaves = prefixPaths.map((relPath) => {
      const fullPath = ['legal', ...relPath];
      const koValue = String(getByPath(koJson, fullPath) ?? '');
      return { relPath, koValue };
    });

    // chars 계산 (누적 추적용)
    const totalCharsThisBatch = leaves.reduce((sum, l) => sum + l.koValue.length, 0);
    totalCharsPosted += totalCharsThisBatch;

    // DeepL 번역
    const translatedTexts = await deeplTranslate(
      leaves.map((l) => l.koValue),
      lang,
    );
    totalTranslatedCount += translatedTexts.length;

    // locale.json legal.* 해당 키만 교체
    for (let i = 0; i < leaves.length; i++) {
      const relPath = leaves[i].relPath;
      const translatedValue = translatedTexts[i] ?? '';
      const before = String(getByPath(existingJson.legal ?? {}, relPath) ?? '');

      // ICU 변수 안전 체크 — {var} 패턴이 생기면 경고 (ADR-0040 D5: legal.*는 변수 0건이므로 있으면 비정상)
      if (/\{[a-zA-Z_]+\}/.test(translatedValue)) {
        console.warn(
          `  경고: ${locale}.legal.${relPath.join('.')} — DeepL 결과에 {변수} 패턴 감지! 수동 확인 필요`,
        );
        console.warn(`    번역 결과: "${translatedValue.substring(0, 100)}"`);
      }

      if (before !== translatedValue) {
        const beforePreview = before.startsWith('[') ? before.substring(0, 50) : before.substring(0, 30);
        console.log(`    legal.${relPath.join('.')}: "${beforePreview}..." → "${translatedValue.substring(0, 50)}..."`);
      }

      // legal 블록 안에서 경로 교체
      const fullPath = ['legal', ...relPath];
      existingJson = setByPath(existingJson, fullPath, translatedValue);
    }

    writeFileSync(outPath, JSON.stringify(existingJson, null, 2) + '\n', 'utf8');
    console.log(`  → ${outPath} 저장 완료 (${leaves.length}키 retarget, 나머지 무변경)`);
  }

  // ─── DeepL 사용량 확인 ───────────────────────────────────────────────────────
  console.log('\n=== DeepL 사용량 확인 ===');
  const usageRes = await fetch('https://api-free.deepl.com/v2/usage', {
    headers: { 'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}` },
  });
  if (usageRes.ok) {
    const usage = await usageRes.json();
    console.log(
      `누적 사용량: ${usage.character_count.toLocaleString()} / ${usage.character_limit.toLocaleString()} 자`,
    );
    console.log(`이번 번역: ~${totalCharsPosted} ko chars (${totalTranslatedCount} 텍스트 항목)`);
  }

  // ─── prefix 잔존 검증 ─────────────────────────────────────────────────────
  console.log('\n=== legal.* prefix 잔존 검증 ===');
  let anyFail = false;
  for (const { locale } of TARGET_LANGS) {
    const outPath = join(MESSAGES_DIR, `${locale}.json`);
    const json = JSON.parse(readFileSync(outPath, 'utf8'));
    let prefixCount = 0;
    function countPrefix(obj) {
      if (typeof obj === 'string') {
        if (obj.startsWith(`[${locale}] `)) prefixCount++;
      } else if (obj && typeof obj === 'object') {
        for (const v of Object.values(obj)) countPrefix(v);
      }
    }
    if (json.legal) countPrefix(json.legal);

    // 한국어 잔존 확인 (affiliateDisclosure.pageTitle 회귀 재확인)
    const pageTitle = json.legal?.affiliateDisclosure?.pageTitle ?? '';
    const hasKorean = /[가-힣]/.test(pageTitle);

    if (prefixCount > 0) {
      console.error(`  [${locale}] legal.* prefix ${prefixCount}건 잔존 — 실패`);
      anyFail = true;
    } else {
      console.log(`  [${locale}] legal.* prefix 0건 — 정상`);
    }
    if (hasKorean) {
      console.error(`  [${locale}] affiliateDisclosure.pageTitle 한국어 잔존: "${pageTitle}" — 실패`);
      anyFail = true;
    } else {
      console.log(`  [${locale}] affiliateDisclosure.pageTitle: "${pageTitle.substring(0, 50)}" — 정상`);
    }
  }

  if (anyFail) {
    console.error('\nERROR: 검증 실패 — 수동 확인 필요');
    process.exit(1);
  }

  console.log('\n=== 완료 ===');
  console.log('다음 단계:');
  console.log('  1. pnpm typecheck && pnpm lint && pnpm test:run');
  console.log('  2. pnpm harness:i18n && pnpm harness:plan && pnpm harness:data');
  console.log('  3. ADR-0033 §Verification #5 누적 카운트 갱신');
  console.log('  4. legal 에이전트 호출 — 4.5.j.3.b 검수');
}

main().catch((err) => {
  console.error('translate-legal.mjs 실패:', err);
  process.exit(1);
});
