/**
 * translate-guide.mjs — guides.proximusVsTelenetVsOrangeBe.* DeepL en→{NL,FR} 스크립트.
 *
 * PLAN 4.23 (a-3 신설 / b-1 실행) — ADR-0051 §D2 + Amendment 1 §A1.B 정합.
 * architect 결정 잠금 (2026-07-13, 미결 3) — translate-legal.mjs 패턴 재사용
 * (TARGET_NAMESPACES + prefix 감지 + var-protection 인라인), 단 방향이 다름:
 *   translate.mjs / translate-legal.mjs = ko → {nl,fr,en} (ko 정본)
 *   translate-guide.mjs                = en → {nl,fr}    (en 정본, ADR-0051
 *   Amendment 1 §A1.B "운영자 영어 본문" 잠금 — guides 네임스페이스 예외,
 *   ADR-0033 §A2.7 G2-ii ko 정본 규칙 비적용)
 *
 * 실행 방법:
 *   드라이런 (API 호출 0, 이번 4.23.a 라운드 전용):
 *     pnpm tsx scripts/i18n/translate-guide.mjs --dry-run
 *   실 배치 (4.23.b, 트랙 A 머지 + en 정본 확정 후):
 *     pnpm tsx --env-file=.env.local scripts/i18n/translate-guide.mjs
 *   재보정 (4.23.b b-4, 운영자 스팟 검수 후 특정 키만):
 *     pnpm tsx --env-file=.env.local scripts/i18n/translate-guide.mjs --retarget=section5.li1,tables.priceComparison.row1.col2
 *
 * 동작 (기본 = 증분 모드, translate-legal.mjs 와 동형):
 *   1. messages/en.json 에서 대상 네임스페이스(guides.proximusVsTelenetVsOrangeBe) 리프 수집 (정본 소스)
 *   2. messages/{nl,fr}.json 에서 해당 네임스페이스 중 `[nl] `/`[fr] ` prefix 잔존 키만 선별
 *      (증분 모드 — 기존 실번역 무손상, --retarget 지정 시 그 키만 강제 포함)
 *   3. en 원문 기준 DeepL en→{NL,FR} 번역 (source_lang=EN)
 *      ICU {var} 패턴은 var-protection (encodeVars/decodeVars 인라인) 적용
 *   4. {nl,fr}.json 해당 키만 교체 + prefix 제거
 *
 * ko.json 경계 (PLAN 4.23 a-4 — ADR-0051 Amd 1 §A1.B):
 *   messages/ko.json 의 guides.proximusVsTelenetVsOrangeBe.* 는 `_comment` 로
 *   스킵 명시된 en 정본 예외 서브트리다. 본 스크립트는 ko.json 을 읽지도
 *   쓰지도 않는다(소스=en, 타겟=nl/fr) — 구조적으로 소비 대상에서 제외된다.
 *   main() 말미에 ko.json 서브트리가 `_comment` 전용 형태를 유지하는지
 *   자가검증(경계 잠금)만 수행한다.
 *
 * 왜 translate.mjs / translate-legal.mjs 와 별도 파일인가 (미결 3):
 *   source_lang 방향이 반대(en→X vs ko→X)라 공유 로직에 방향 분기를 넣으면
 *   기존 ko 기반 스크립트 회귀 위험이 생긴다. 네임스페이스도 완전히 격리되어
 *   있어(guides.* 전용) 별 파일 = 회귀 위험 0 (기존 스크립트 수정 0줄).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = join(__dirname, '../../messages');

// ─── CLI 플래그 ──────────────────────────────────────────────────────────────

const isDryRun = process.argv.includes('--dry-run');
const retargetArg = process.argv.find((a) => a.startsWith('--retarget='));
/** @type {string[] | null} — 지정 시 이 상대 경로(dot-notation) 목록만 강제 포함 */
const retargetPaths = retargetArg
  ? retargetArg.slice('--retarget='.length).split(',').map((s) => s.trim()).filter(Boolean)
  : null;

// ─── DeepL 설정 ───────────────────────────────────────────────────────────────

const DEEPL_API_KEY = process.env['DEEPL_API_KEY'];
if (!isDryRun && !DEEPL_API_KEY) {
  console.error('ERROR: DEEPL_API_KEY 미설정');
  console.error('  실행: pnpm tsx --env-file=.env.local scripts/i18n/translate-guide.mjs');
  console.error('  (API 호출 없이 대상만 확인하려면 --dry-run 플래그 사용)');
  process.exit(1);
}

const DEEPL_ENDPOINT = 'https://api-free.deepl.com/v2/translate';
const SOURCE_LANG = 'EN'; // en 정본 (ADR-0051 Amd 1 §A1.B) — ko→X 스크립트와 반대 방향

const TARGET_LANGS = [
  { lang: 'NL', locale: 'nl' },
  { lang: 'FR', locale: 'fr' },
];

/**
 * 대상 네임스페이스 — guides.proximusVsTelenetVsOrangeBe 단일 서브트리 (미결 3, 1건).
 * 후속 가이드 추가 시(별 PLAN 트리거) 이 배열에 항목만 추가하면 됨.
 */
const TARGET_NAMESPACES = [
  {
    nsPath: ['guides', 'proximusVsTelenetVsOrangeBe'],
    label: 'guides.proximusVsTelenetVsOrangeBe.*',
  },
];

// ─── JSON 경로 유틸 (translate-legal.mjs 와 동일 로직) ─────────────────────────

/**
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

// ─── var-protection 인라인 (translate-legal.mjs 와 동일 로직) ─────────────────

/**
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

    const prefix = entry.spaceBefore && !hasSpaceBefore ? ' ' : '';
    const suffix = entry.spaceAfter && !hasSpaceAfter ? ' ' : '';

    return `${prefix}${restored}${suffix}`;
  });
}

// ─── 리프 수집 + prefix 경로 수집 ────────────────────────────────────────────

/**
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
    body.append('source_lang', SOURCE_LANG);
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
  console.log('=== translate-guide.mjs — guides.* DeepL en→{NL,FR} (PLAN 4.23 a-3/b-1) ===');
  console.log(`소스 언어: source_lang=${SOURCE_LANG} (en 정본 — ADR-0051 Amendment 1 §A1.B)`);
  console.log(`모드: ${isDryRun ? 'DRY-RUN (API 호출 0)' : '실 배치'}`);
  if (retargetPaths) {
    console.log(`재보정 대상 (--retarget): ${retargetPaths.join(', ')}`);
  }
  console.log('');

  const enPath = join(MESSAGES_DIR, 'en.json');
  const enJson = JSON.parse(readFileSync(enPath, 'utf8'));

  // 대상 네임스페이스별 en 리프 카운트 출력
  let totalEnLeaves = 0;
  for (const { nsPath, label } of TARGET_NAMESPACES) {
    const nsBlock = getByPath(enJson, nsPath);
    const leaves = collectLeaves(nsBlock);
    console.log(`en.json ${label}: ${leaves.length}키`);
    totalEnLeaves += leaves.length;
  }
  console.log(`en.json 전체 대상: ${totalEnLeaves}키\n`);

  // ── ko.json 경계 잠금 자가검증 (PLAN 4.23 a-4) ──────────────────────────────
  // 본 스크립트는 ko.json 을 읽지도 쓰지도 않는다 — 구조적으로 소비 대상 제외.
  // 여기서는 ko.json 의 guides.proximusVsTelenetVsOrangeBe 서브트리가
  // `_comment` 전용(리프 값 0)을 유지하는지만 확인 (스킵 명시 회귀 감지).
  const koPath = join(MESSAGES_DIR, 'ko.json');
  const koJson = JSON.parse(readFileSync(koPath, 'utf8'));
  let koBoundaryOk = true;
  for (const { nsPath, label } of TARGET_NAMESPACES) {
    const koNsBlock = getByPath(koJson, nsPath);
    const koLeaves = collectLeaves(koNsBlock);
    const hasComment =
      koNsBlock && typeof koNsBlock === 'object' && '_comment' in koNsBlock;
    if (koLeaves.length > 0 || !hasComment) {
      koBoundaryOk = false;
      console.error(
        `  [경계 위반] ko.json ${label} — _comment 스킵 형식 아님 또는 리프 값 존재 (${koLeaves.length}건). ` +
          'ADR-0051 Amd 1 §A1.B en 정본 예외 규칙 확인 필요.',
      );
    }
  }
  if (koBoundaryOk) {
    console.log('ko.json 경계 잠금: OK (_comment 전용, 리프 값 0 — en 정본 예외 유지)\n');
  } else {
    console.log('');
  }

  if (isDryRun) {
    console.log('=== DRY-RUN — 대상 리프 미리보기 (locale 별 처리 대상만 계산, API 호출 0) ===');
    for (const { locale } of TARGET_LANGS) {
      const outPath = join(MESSAGES_DIR, `${locale}.json`);
      const existingJson = JSON.parse(readFileSync(outPath, 'utf8'));

      /** @type {Array<{nsPath: string[], relPath: string[]}>} */
      const pending = [];
      for (const { nsPath } of TARGET_NAMESPACES) {
        const nsBlock = getByPath(existingJson, nsPath);
        const prefixPaths = collectPrefixPaths(nsBlock ?? {}, locale);
        for (const relPath of prefixPaths) {
          if (retargetPaths && !retargetPaths.includes(relPath.join('.'))) continue;
          pending.push({ nsPath, relPath });
        }
        if (retargetPaths) {
          for (const rp of retargetPaths) {
            const relPath = rp.split('.');
            if (!pending.some((p) => p.relPath.join('.') === rp)) {
              pending.push({ nsPath, relPath });
            }
          }
        }
      }
      console.log(`  [${locale}] 대상 리프: ${pending.length}건 (prefix "[${locale}] " 감지 기준)`);
    }
    console.log('\n드라이런 완료 — 실 배치는 4.23.b (트랙 A 머지 + en 정본 확정 후) 진입.');
    console.log('실행: pnpm tsx --env-file=.env.local scripts/i18n/translate-guide.mjs');
    return;
  }

  // ── 실 배치 ──────────────────────────────────────────────────────────────
  let totalCharsPosted = 0;
  let totalTranslatedCount = 0;

  for (const { lang, locale } of TARGET_LANGS) {
    const outPath = join(MESSAGES_DIR, `${locale}.json`);
    const existingRaw = readFileSync(outPath, 'utf8');
    let existingJson = JSON.parse(existingRaw);

    /** @type {Array<{nsPath: string[], relPath: string[], enValue: string}>} */
    const allPendingLeaves = [];

    for (const { nsPath } of TARGET_NAMESPACES) {
      const nsBlock = getByPath(existingJson, nsPath);
      const prefixPaths = collectPrefixPaths(nsBlock ?? {}, locale);

      for (const relPath of prefixPaths) {
        if (retargetPaths && !retargetPaths.includes(relPath.join('.'))) continue;
        const fullPath = [...nsPath, ...relPath];
        const enValue = String(getByPath(enJson, fullPath) ?? '');
        allPendingLeaves.push({ nsPath, relPath, enValue });
      }

      if (retargetPaths) {
        for (const rp of retargetPaths) {
          const relPath = rp.split('.');
          if (!allPendingLeaves.some((p) => p.relPath.join('.') === rp)) {
            const fullPath = [...nsPath, ...relPath];
            const enValue = String(getByPath(enJson, fullPath) ?? '');
            allPendingLeaves.push({ nsPath, relPath, enValue });
          }
        }
      }
    }

    if (allPendingLeaves.length === 0) {
      console.log(`[${locale}] 배치 대상 0건 — 스킵`);
      continue;
    }

    console.log(`\n[${locale}] 배치 ${allPendingLeaves.length}키 → en→${lang} 번역 시작...`);

    /** @type {Array<Array<{name: string, spaceBefore: boolean, spaceAfter: boolean}>>} */
    const varStores = [];
    const encodedTexts = allPendingLeaves.map((leaf) => {
      /** @type {Array<{name: string, spaceBefore: boolean, spaceAfter: boolean}>} */
      const store = [];
      varStores.push(store);
      return encodeVars(leaf.enValue, store);
    });

    const charsThisBatch = encodedTexts.reduce((sum, t) => sum + t.length, 0);
    totalCharsPosted += charsThisBatch;

    const translatedRaw = await deeplTranslate(encodedTexts, lang);
    totalTranslatedCount += translatedRaw.length;

    for (let i = 0; i < allPendingLeaves.length; i++) {
      const { nsPath, relPath } = allPendingLeaves[i];
      const rawResult = translatedRaw[i] ?? '';
      const translatedValue = decodeVars(rawResult, varStores[i] ?? []);
      const fullPath = [...nsPath, ...relPath];
      const before = String(getByPath(existingJson, fullPath) ?? '');

      const store = varStores[i] ?? [];
      for (const entry of store) {
        if (!translatedValue.includes(`{${entry.name}}`)) {
          console.warn(
            `  경고: ${locale}.${fullPath.join('.')} — {${entry.name}} 변수 유실! 수동 확인 필요`,
          );
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
    console.log(`  → ${outPath} 저장 완료 (${allPendingLeaves.length}키)`);
  }

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

    if (prefixCount > 0) {
      console.error(`  [${locale}] guides.* prefix ${prefixCount}건 잔존 — 실패`);
      anyFail = true;
    } else {
      console.log(`  [${locale}] guides.* prefix 0건 — 정상`);
    }
  }

  if (anyFail) {
    console.error('\nERROR: 검증 실패 — 수동 확인 필요');
    process.exit(1);
  }

  console.log('\n=== 완료 ===');
  console.log('다음 단계:');
  console.log('  1. pnpm typecheck && pnpm lint && pnpm test:run');
  console.log('  2. pnpm harness:i18n && pnpm harness:plan');
  console.log('  3. 운영자 nl/fr 스팟 검수 (PLAN 4.23.b b-4)');
}

main().catch((err) => {
  console.error('translate-guide.mjs 실패:', err);
  process.exit(1);
});
