/**
 * translate.mjs — DeepL API 를 사용해 ko.json → nl/fr/en base 번역.
 *
 * ADR-0033 §A2.7 G2 + PLAN 4.5.j.2 Phase B.
 *
 * 실행 방법:
 *   pnpm tsx --env-file=.env.local scripts/i18n/translate.mjs
 *
 * 동작 (기본 = 전체 모드):
 *   1. messages/ko.json 읽기 (정본 소스 — ADR-0033 §A2.7 G2-ii)
 *   2. DeepL ko→{nl,fr,en} 번역 (base 3 언어, batch 호출)
 *   3. messages/{nl,fr,en}.json 쓰기 (placeholder 교체)
 *   4. region delta(nl-BE/nl-NL/fr-BE/fr-LU) = 별도 thin delta — 이 스크립트 미터치
 *
 * 증분 모드 (--incremental 플래그):
 *   기존 {locale}.json 에서 값이 "[<locale>] ..." 패턴인 리프만 선별 →
 *   그 키에 해당하는 ko.json 원문만 DeepL 번역 → 해당 값만 교체.
 *   기존 실번역 값은 1글자도 건드리지 않는다.
 *
 *   왜 증분 모드가 필요한가:
 *     Phase B 이후 신규 키가 추가된 경우 기존 전체 재번역 = (a) 기존 실번역
 *     회귀 위험 (b) DeepL 쿼터 낭비. 증분 모드는 placeholder 키만 타겟 →
 *     최소 API 호출 + 기존 값 보존 (PLAN 4.5.j.4.A.1 핵심 요구사항).
 *
 * 재보정 모드 (--retarget 플래그):
 *   placeholder 가 아닌 기존 실번역 값 중 지정된 키 경로 목록을 재번역.
 *   PLAN 4.5.j.4.A.1 verifier FAIL 수정 — 41키 ICU 공백 버그 재보정에 사용.
 *   지정 키 외 모든 값은 변경하지 않는다 (기존 Phase B 번역 무손상).
 *
 * 주의사항 (ADR-0033 §A2.7 G2-iii Q2):
 *   - caveats.* 네임스페이스는 DeepL raw 공개, 운영자 수동 검수 1회 필수 (가격 오역 = 사용자 손해).
 *   - legal.* 네임스페이스는 번역 대상 제외 — 4.5.j.3 legal 에이전트.
 *   - 나머지 UI 텍스트는 DeepL raw 공개 + organic 피드백 사후 보정.
 *
 * 변수 보호 (ICU/next-intl 플레이스홀더):
 *   {name}, {count}, {amount} 등 중괄호 변수는 번역 중 깨지면 런타임 오류.
 *   전략: 번역 전 변수를 XML 태그로 치환, DeepL tag_handling=xml 으로 보호,
 *   번역 후 원래 중괄호 형식으로 복원. (DeepL 공식 변수 보호 패턴)
 *
 *   공백 보존 전략 (PLAN 4.5.j.4.A.1 버그 수정):
 *   DeepL tag_handling=xml 은 <x id="N"/> 태그를 보존하나, 태그 양옆 공백을
 *   흡수하는 버그가 있다 — "데이터 {value} GB" 가 "Data{value}GB" 로 출력되는 현상.
 *   수정 전략: encodeVars 가 {var} 양옆 공백을 별도 공백 마커로 포함해 인코딩하고,
 *   decodeVars 가 ko 원문 공백 규칙 기준으로 복원. 단, 과교정 방지 — ko 에 공백
 *   없으면 번역문에도 강제하지 않음 (언어별 구두점 차이 보존).
 *
 * 왜 batch 호출인가:
 *   DeepL API 는 단일 요청에 text[] 배열을 지원한다.
 *   리프 값 전체를 배열로 보내면 API 왕복 횟수를 최소화 — 분량 절약 + 속도.
 *
 * 왜 일회성 스크립트인가:
 *   번역 = 런타임 로직 아님. scripts/ 하위 = 빌드/배포 산출물 비포함.
 *   RESEND_API_KEY / KO_GATE_TOKEN 과 동일 패턴 — 운영자 발급 + 등록.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── 경로 설정 ────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = join(__dirname, '../../messages');

// ─── DeepL 설정 ───────────────────────────────────────────────────────────────

const DEEPL_API_KEY = process.env['DEEPL_API_KEY'];
if (!DEEPL_API_KEY) {
  console.error('ERROR: DEEPL_API_KEY 미설정');
  console.error('  실행: pnpm tsx --env-file=.env.local scripts/i18n/translate.mjs');
  process.exit(1);
}

// Free API endpoint (키가 ':fx' 로 끝나면 Free 키)
const DEEPL_ENDPOINT = 'https://api-free.deepl.com/v2/translate';

// 번역 대상 언어 — base 3개만 (region delta 는 별도)
const TARGET_LANGS = [
  { lang: 'NL', locale: 'nl' },
  { lang: 'FR', locale: 'fr' },
  { lang: 'EN-US', locale: 'en' }, // DeepL 영어는 EN-US 또는 EN-GB 명시 필요
];

// ─── 변수 보호 유틸 ──────────────────────────────────────────────────────────

/**
 * VarEntry: ICU 변수 하나의 메타데이터.
 * ko 원문에서 {var} 양옆 공백 유무를 기록해 두는 이유:
 *   DeepL tag_handling=xml 이 <x id="N"/> 태그 양옆 공백을 흡수하는 버그가 있다.
 *   예: "데이터 {value} GB" → encodeVars → "데이터 <x id="0"/> GB"
 *       → DeepL 번역 → "Data<x id="0"/>GB" (공백 소실!)
 *       → decodeVars (공백 보정) → "Data {value} GB" (ko 원문에 양쪽 공백 있으므로 복원)
 *
 * @typedef {{ name: string; spaceBefore: boolean; spaceAfter: boolean }} VarEntry
 */

/**
 * next-intl ICU 변수 {varName} 을 DeepL XML 태그로 치환.
 * 번역 중 변수가 변형되지 않도록 보호한다.
 *
 * 왜 XML 태그인가:
 *   DeepL tag_handling=xml 설정 시 태그 내부를 번역하지 않는다.
 *   {amount} → <x id="0"/> 로 치환 → DeepL 통과 → 다시 {amount} 복원.
 *   변수 이름 자체는 별도 맵에 보존한다.
 *
 * 왜 공백 정보를 함께 저장하는가:
 *   DeepL XML 모드가 태그 양옆 공백을 흡수하는 버그가 있다.
 *   ko 원문에서 {var} 양옆 공백 유무를 미리 저장 → decodeVars 에서 복원.
 *   과교정 방지 원칙: ko 에 공백 있으면 번역문에도 보장. ko 에 없으면 강제 안 함.
 *
 * @param {string} text 원본 텍스트 (예: "월 {amount} 절약")
 * @param {VarEntry[]} varStore 변수 메타데이터 저장소 (치환 인덱스 공유)
 * @returns {string} 태그 치환된 텍스트
 */
function encodeVars(text, varStore) {
  // (?<= ...) lookbehind / (?= ...) lookahead 로 공백 포함 여부를 감지한다.
  // replace 콜백에서 match 시작/끝 위치의 앞뒤 문자를 직접 확인하는 방식 사용
  // (Safari lookbehind 지원 불확실 — 인덱스 기반으로 대신).
  return text.replace(/\{([^}]+)\}/g, (match, varName, offset) => {
    // 양옆 공백 유무를 원본 텍스트에서 직접 체크
    const spaceBefore = offset > 0 && text[offset - 1] === ' ';
    const spaceAfter =
      offset + match.length < text.length && text[offset + match.length] === ' ';

    const idx = varStore.length;
    varStore.push({ name: varName, spaceBefore, spaceAfter });
    // 태그 자체는 공백 없이 순수하게 인코딩 — 공백은 주변 텍스트가 담당
    return `<x id="${idx}"/>`;
  });
}

/**
 * DeepL 번역 결과에서 XML 태그를 원래 변수 이름으로 복원.
 * ko 원문 공백 규칙(spaceBefore/spaceAfter)을 기준으로 번역문 공백 보정.
 *
 * 과교정 방지 규칙:
 *   - ko 에 공백 있고 번역문에 없으면 → 추가 (복원)
 *   - ko 에 공백 없으면 → 번역문에 있더라도 건드리지 않음 (언어별 구두점 차이 보존)
 *
 * @param {string} text 번역된 텍스트 (XML 태그 포함)
 * @param {VarEntry[]} varStore 변수 메타데이터 저장소
 * @returns {string} 복원된 텍스트
 */
function decodeVars(text, varStore) {
  return text.replace(/<x id="(\d+)"\/>/g, (match, idxStr, offset, fullText) => {
    const idx = Number(idxStr);
    const entry = varStore[idx];
    if (!entry) return `{?}`;

    const restored = `{${entry.name}}`;

    // 번역문에서 태그 양옆 실제 공백 유무 확인
    const hasSpaceBefore = offset > 0 && fullText[offset - 1] === ' ';
    const afterPos = offset + match.length;
    const hasSpaceAfter = afterPos < fullText.length && fullText[afterPos] === ' ';

    // ko 에 공백 있는데 번역문에 없으면 → 보정 추가
    // ko 에 공백 없으면 → 번역문 상태 그대로 (과교정 금지)
    const prefix = entry.spaceBefore && !hasSpaceBefore ? ' ' : '';
    const suffix = entry.spaceAfter && !hasSpaceAfter ? ' ' : '';

    return `${prefix}${restored}${suffix}`;
  });
}

// ─── JSON 트리 순회 ──────────────────────────────────────────────────────────

/**
 * 번역된 값 배열을 원래 JSON 트리 구조로 재조립한다.
 *
 * @param {unknown} original 원본 ko.json 트리
 * @param {Array<{path: string[], translatedValue: string}>} translations
 * @returns {unknown} 번역된 트리
 */
function applyTranslations(original, translations) {
  // 경로 → 번역값 맵 (빠른 조회)
  const translationMap = new Map(
    translations.map((t) => [t.path.join('.'), t.translatedValue]),
  );

  function rebuild(node, pathStack) {
    if (typeof node === 'string') {
      // legal.* 제외 키는 원문 그대로
      if (pathStack[0] === 'legal') return node;
      const key = pathStack.join('.');
      return translationMap.has(key) ? translationMap.get(key) : node;
    }
    if (node && typeof node === 'object') {
      const result = {};
      for (const [k, v] of Object.entries(node)) {
        result[k] = k === '_comment' ? v : rebuild(v, [...pathStack, k]);
      }
      return result;
    }
    return node;
  }

  return rebuild(original, []);
}

// ─── DeepL API 호출 ──────────────────────────────────────────────────────────

/**
 * DeepL REST API 호출 — 텍스트 배열을 한 번에 번역.
 *
 * @param {string[]} texts 번역할 텍스트 배열 (변수 보호 적용 후)
 * @param {string} targetLang DeepL 언어 코드 (예: 'NL', 'FR', 'EN-US')
 * @returns {Promise<string[]>} 번역 결과 배열 (입력과 동일 순서)
 */
async function deeplTranslate(texts, targetLang) {
  // DeepL 단일 요청 최대 50 텍스트 권장 — 초과 시 분할
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
    body.append('tag_handling', 'xml'); // 변수 보호 — XML 태그 내부 번역 안 함
    body.append('ignore_tags', 'x'); // <x id="..."/> 태그 내용 무시

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

    // 배치 사이 잠깐 대기 — API rate limit 여유
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}

// ─── 증분 모드 유틸 ──────────────────────────────────────────────────────────

/**
 * 기존 locale JSON 에서 "[<locale>] ..." placeholder 인 리프 경로를 수집한다.
 *
 * 왜 이 함수가 필요한가:
 *   증분 모드 = 전체 ko.json 재번역 대신, 이미 번역된 값은 건드리지 않고
 *   placeholder 만 골라서 DeepL 번역 후 교체. 기존 실번역 보존 + 쿼터 절약.
 *
 * @param {unknown} obj 기존 locale JSON 객체
 * @param {string} locale 'nl' | 'fr' | 'en'
 * @param {string[]} pathStack 재귀 경로 스택
 * @returns {string[][]} placeholder 인 리프 경로 배열 (예: [['result','notFound','heading'], ...])
 */
function collectPlaceholderPaths(obj, locale, pathStack = []) {
  /** @type {string[][]} */
  const paths = [];
  if (typeof obj === 'string') {
    // "[nl] ", "[fr] ", "[en] " 접두사 확인 — 이것이 placeholder 표시
    if (obj.startsWith(`[${locale}] `)) {
      paths.push([...pathStack]);
    }
  } else if (obj && typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj)) {
      if (key === '_comment') continue; // 메타 주석은 항상 스킵
      paths.push(...collectPlaceholderPaths(val, locale, [...pathStack, key]));
    }
  }
  return paths;
}

/**
 * 중첩 경로로 JSON 객체의 값을 가져온다.
 *
 * @param {unknown} obj
 * @param {string[]} path
 * @returns {unknown}
 */
function getByPath(obj, path) {
  /** @type {unknown} */
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
 * 중첩 경로로 JSON 객체의 값을 교체한다 (불변 — 새 객체 반환).
 *
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

// ─── 재보정 대상 41키 경로 목록 (PLAN 4.5.j.4.A.1) ─────────────────────────
//
// 왜 경로 목록을 하드코딩하는가:
//   이 키들은 .A.1 에서 placeholder→DeepL raw 로 채워졌으나 ICU 공백 버그로
//   손상됐다. placeholder prefix 가 없어 --incremental 으로 감지 불가.
//   재보정 = 이 41키만 ko 원문 기준 재번역. 나머지 Phase B 값은 절대 건드리지 않는다.

/** @type {string[][]} */
const RETARGET_PATHS = [
  // currentProvider.* (10키)
  ['compare', 'currentProvider', 'heading'],
  ['compare', 'currentProvider', 'supportNote'],
  ['compare', 'currentProvider', 'zeroProvidersFallback'],
  ['compare', 'currentProvider', 'skipAsNew'],
  ['compare', 'currentProvider', 'providerLabel'],
  ['compare', 'currentProvider', 'providerPlaceholder'],
  ['compare', 'currentProvider', 'providerAriaLabel'],
  ['compare', 'currentProvider', 'tariffLabel'],
  ['compare', 'currentProvider', 'tariffPlaceholder'],
  ['compare', 'currentProvider', 'tariffAriaLabel'],
  ['compare', 'currentProvider', 'tariffNotRegistered'],
  ['compare', 'currentProvider', 'tariffUnknown'],
  ['compare', 'currentProvider', 'nextButton'],
  ['compare', 'currentProvider', 'skipButton'],
  // result.* (25키)
  ['result', 'table', 'savingYearly'],
  ['result', 'table', 'subtitleDataGb'],
  ['result', 'table', 'subtitleVoiceMinutes'],
  ['result', 'table', 'activationNote'],
  ['result', 'table', 'promoNote'],
  ['result', 'table', 'commitmentMonths'],
  ['result', 'conclusionCard', 'verdicts', 'positiveSaving'],
  ['result', 'affiliateDisclosure', 'commissionUnknown'],
  ['result', 'affiliateDisclosure', 'commissionKnown'],
  ['result', 'affiliateDisclosure', 'disclosureAriaLabel'],
  ['result', 'calculationDetails', 'assumptions', 'usageSourceEstimated'],
  ['result', 'calculationDetails', 'assumptions', 'usageSourceAnonymized'],
  ['result', 'calculationDetails', 'assumptions', 'householdUnknown'],
  ['result', 'preview', 'serverError'],
  ['result', 'preview', 'submittingMessage'],
  // caveats.* (6키)
  ['caveats', 'commitment'],
  ['caveats', 'activationFee'],
  ['caveats', 'promoEnds'],
  ['caveats', 'dataOverage'],
  ['caveats', 'speed4kInsufficient'],
  ['caveats', 'currentTariffConfidence'],
  ['caveats', 'confidenceMedium'],
];

// ─── 실행 진입점 ─────────────────────────────────────────────────────────────

async function main() {
  // --incremental 플래그 감지
  // 왜 플래그 방식인가: 기본(전체) 모드를 보존하면서 증분 경로를 추가.
  // CI/스크립트가 전체 재번역을 명시적으로 요청할 수 있고,
  // 부채 보정만 할 때는 --incremental 으로 최소 변경.
  const isIncremental = process.argv.includes('--incremental');

  // --retarget 플래그 감지
  // 왜 별도 모드인가: .A.1 41키는 placeholder 가 아니라 실번역(DeepL-raw)이 있다.
  // --incremental 의 placeholder 감지 로직으로는 재번역 대상이 안 된다.
  // --retarget = RETARGET_PATHS 목록의 키만 ko 원문 재번역 + 공백 보정 재적용.
  const isRetarget = process.argv.includes('--retarget');

  const modeLabel = isRetarget
    ? 'Retarget (41-key ICU spacing fix)'
    : isIncremental
      ? 'Incremental (placeholder-only)'
      : 'Phase B (DeepL 실번역)';
  console.log(`=== translate.mjs — ${modeLabel} ===`);
  console.log('');

  // 1. ko.json 읽기
  const koPath = join(MESSAGES_DIR, 'ko.json');
  const koRaw = readFileSync(koPath, 'utf8');
  const koJson = JSON.parse(koRaw);

  console.log(`소스: ${koPath}`);

  // 3. 언어별 번역 실행
  let totalTranslated = 0;

  if (isRetarget) {
    // ── 재보정 모드 (--retarget) ──────────────────────────────────────────────
    // RETARGET_PATHS 목록에 있는 키만 ko 원문 기준 재번역 + 공백 보정 재적용.
    // 기존 Phase B 번역값은 1글자도 건드리지 않는다.
    //
    // 왜 이 모드가 필요한가:
    //   .A.1 에서 채워진 41키는 DeepL XML 공백 흡수 버그로 손상됐다.
    //   placeholder 가 없으므로 --incremental 감지 불가 → 별도 경로 목록으로 타겟.

    for (const { lang, locale } of TARGET_LANGS) {
      const outPath = join(MESSAGES_DIR, `${locale}.json`);
      const existingRaw = readFileSync(outPath, 'utf8');
      const existingJson = JSON.parse(existingRaw);

      // RETARGET_PATHS 중 legal.* 제외 후 ko 원문 수집
      const leaves = RETARGET_PATHS.filter((path) => path[0] !== 'legal').map((path) => ({
        path,
        value: /** @type {string} */ (getByPath(koJson, path) ?? ''),
      }));

      console.log(`\n[${locale}] retarget ${leaves.length}키 → ko→${lang} 재번역 시작...`);

      // 언어별 독립 varStore — ICU 변수 공백 정보 포함
      /** @type {VarEntry[]} */
      const varStore = [];
      const encodedTexts = leaves.map((leaf) => encodeVars(leaf.value, varStore));

      // DeepL 호출 (retarget 키만)
      const translated = await deeplTranslate(encodedTexts, lang);
      totalTranslated += translated.length;

      // 변수 복원 (공백 보정 포함) + locale.json 해당 키만 교체
      let updatedJson = existingJson;
      for (let i = 0; i < leaves.length; i++) {
        const raw = translated[i] ?? '';
        const decodedValue = decodeVars(raw, varStore);
        const before = String(getByPath(existingJson, leaves[i].path) ?? '');
        if (before !== decodedValue) {
          console.log(`    ${leaves[i].path.join('.')}: "${before}" → "${decodedValue}"`);
        }
        updatedJson = setByPath(updatedJson, leaves[i].path, decodedValue);
      }

      writeFileSync(outPath, JSON.stringify(updatedJson, null, 2) + '\n', 'utf8');
      console.log(`  → ${outPath} 저장 완료 (${leaves.length}키 재보정, 기존 값 보존)`);
    }
  } else if (isIncremental) {
    // ── 증분 모드 ─────────────────────────────────────────────────────────────
    // 각 locale.json 에서 "[<locale>] ..." placeholder 인 키만 선별 →
    // ko.json 원문 기준으로 DeepL 번역 → 해당 값만 교체.
    // 기존 실번역 값은 1글자도 건드리지 않는다.
    //
    // 왜 locale-별로 독립 처리하는가:
    //   nl/fr/en 각 파일의 placeholder 대상 키가 다를 수 있다.
    //   각각 독립 실행해야 불필요한 API 호출 0.

    for (const { lang, locale } of TARGET_LANGS) {
      const outPath = join(MESSAGES_DIR, `${locale}.json`);
      const existingRaw = readFileSync(outPath, 'utf8');
      const existingJson = JSON.parse(existingRaw);

      // placeholder 경로 수집
      const placeholderPaths = collectPlaceholderPaths(existingJson, locale);

      if (placeholderPaths.length === 0) {
        console.log(`[${locale}] placeholder 없음 — 스킵`);
        continue;
      }

      console.log(`\n[${locale}] placeholder ${placeholderPaths.length}개 발견 → ko→${lang} 증분 번역 시작...`);

      // 각 placeholder 경로에 대응하는 ko.json 원문 수집
      // legal.* 는 번역 대상 제외 (4.5.j.3 경계)
      const leaves = placeholderPaths
        .filter((path) => path[0] !== 'legal')
        .map((path) => ({
          path,
          value: /** @type {string} */ (getByPath(koJson, path) ?? ''),
        }));

      if (leaves.length === 0) {
        console.log(`[${locale}] legal.* 만 placeholder — 스킵 (4.5.j.3 경계)`);
        continue;
      }

      // 언어별 독립 varStore — ICU 변수 공백 정보 포함
      /** @type {VarEntry[]} */
      const varStore = [];
      const encodedTexts = leaves.map((leaf) => encodeVars(leaf.value, varStore));

      // DeepL 호출 (placeholder 키만 — 전체 재번역 대비 API 호출 최소화)
      const translated = await deeplTranslate(encodedTexts, lang);
      totalTranslated += translated.length;

      // 변수 복원 (공백 보정 포함) + locale.json 에 해당 값만 교체
      let updatedJson = existingJson;
      for (let i = 0; i < leaves.length; i++) {
        const decodedValue = decodeVars(translated[i] ?? '', varStore);
        updatedJson = setByPath(updatedJson, leaves[i].path, decodedValue);
      }

      writeFileSync(outPath, JSON.stringify(updatedJson, null, 2) + '\n', 'utf8');
      console.log(`  → ${outPath} 저장 완료 (${leaves.length} 키 교체, 기존 값 보존)`);
    }
  } else {
    // ── 전체 모드 (기존 Phase B 동작 — 변경 없음) ────────────────────────────
    // 2. 리프 값 수집 + 변수 보호
    // varStore 는 모든 언어 번역에서 공유 — 인덱스 일관성 유지
    // 각 언어별로 독립 varStore 를 사용해야 안전하다.
    // (동일 텍스트 집합이므로 변수 위치는 항상 같지만 명시적으로 분리)

    // 먼저 리프 목록만 추출 (변수 저장소는 언어별 독립)
    const leavesPlain = [];
    (function extractLeavesPaths(obj, paths) {
      if (typeof obj === 'string') {
        if (paths[0] === 'legal') return;
        leavesPlain.push({ path: [...paths], value: obj });
      } else if (obj && typeof obj === 'object') {
        for (const [key, val] of Object.entries(obj)) {
          if (key === '_comment') continue;
          extractLeavesPaths(val, [...paths, key]);
        }
      }
    })(koJson, []);

    console.log(`번역 대상 리프 수: ${leavesPlain.length} (legal.* 제외)`);

    for (const { lang, locale } of TARGET_LANGS) {
      console.log(`\n[${locale}] ko → ${lang} 번역 시작...`);

      // 언어별 독립 varStore — ICU 변수 공백 정보 포함 (공백 보정에 사용)
      /** @type {VarEntry[]} */
      const varStore = [];

      // 변수 보호 적용
      const encodedTexts = leavesPlain.map((leaf) => encodeVars(leaf.value, varStore));

      // DeepL 호출
      const translated = await deeplTranslate(encodedTexts, lang);
      totalTranslated += translated.length;

      // 변수 복원
      const decodedTranslations = translated.map((t, i) => ({
        path: leavesPlain[i].path,
        translatedValue: decodeVars(t, varStore),
      }));

      // 번역된 트리 조립
      const translatedTree = applyTranslations(koJson, decodedTranslations);

      // 기존 파일의 _comment 유지 + 번역 트리 병합
      const outPath = join(MESSAGES_DIR, `${locale}.json`);
      const existingRaw = readFileSync(outPath, 'utf8');
      const existingJson = JSON.parse(existingRaw);
      const existingComment = existingJson['_comment'];

      const output = {
        ...(existingComment ? { _comment: existingComment } : {}),
        ...translatedTree,
      };

      writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
      console.log(`  → ${outPath} 저장 완료 (${leavesPlain.length} 키)`);
    }
  }

  // 4. 사용량 확인
  console.log('\n=== DeepL 사용량 확인 ===');
  const usageRes = await fetch('https://api-free.deepl.com/v2/usage', {
    headers: { 'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}` },
  });
  if (usageRes.ok) {
    const usage = await usageRes.json();
    console.log(`사용량: ${usage.character_count.toLocaleString()} / ${usage.character_limit.toLocaleString()} 자`);
    console.log(`이번 번역: ~${totalTranslated} 텍스트 항목`);
  }

  // 5. 플레이스홀더 검증
  console.log('\n=== 플레이스홀더 검증 ===');
  let placeholderFound = 0;
  for (const { locale } of TARGET_LANGS) {
    const outPath = join(MESSAGES_DIR, `${locale}.json`);
    const raw = readFileSync(outPath, 'utf8');
    // [nl] / [fr] / [en] 패턴 잔존 확인
    const matches = raw.match(/"\[(nl|fr|en)\] /g);
    if (matches && matches.length > 0) {
      console.warn(`  경고: ${locale}.json 에 placeholder ${matches.length}건 잔존`);
      placeholderFound += matches.length;
    } else {
      console.log(`  ${locale}.json — placeholder 0건 (정상)`);
    }
  }

  if (placeholderFound > 0) {
    console.error(`\n오류: placeholder ${placeholderFound}건 잔존 — DoD 미충족`);
    process.exit(1);
  }

  console.log('\n=== 완료 ===');
  console.log('다음 단계:');
  console.log('  1. caveats.* 운영자 수동 검수 (Q2 DoD — 가격/절약 오역 확인)');
  console.log('  2. pnpm tsx scripts/i18n/measure-chars.mjs 실행 → ADR-0033 §Verification #5 기록');
  console.log('  3. pnpm typecheck && pnpm test:run 확인');
}

main().catch((err) => {
  console.error('translate.mjs 실패:', err);
  process.exit(1);
});
