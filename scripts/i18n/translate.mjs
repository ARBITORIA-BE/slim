/**
 * translate.mjs — DeepL API 를 사용해 ko.json → nl/fr/en base 번역.
 *
 * ADR-0033 §A2.7 G2 + PLAN 4.5.j.2 Phase B.
 *
 * 실행 방법:
 *   pnpm tsx --env-file=.env.local scripts/i18n/translate.mjs
 *
 * 동작:
 *   1. messages/ko.json 읽기 (정본 소스 — ADR-0033 §A2.7 G2-ii)
 *   2. DeepL ko→{nl,fr,en} 번역 (base 3 언어, batch 호출)
 *   3. messages/{nl,fr,en}.json 쓰기 (placeholder 교체)
 *   4. region delta(nl-BE/nl-NL/fr-BE/fr-LU) = 별도 thin delta — 이 스크립트 미터치
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
 * next-intl ICU 변수 {varName} 을 DeepL XML 태그로 치환.
 * 번역 중 변수가 변형되지 않도록 보호한다.
 *
 * 왜 XML 태그인가:
 *   DeepL tag_handling=xml 설정 시 태그 내부를 번역하지 않는다.
 *   {amount} → <x id="0"/> 로 치환 → DeepL 통과 → 다시 {amount} 복원.
 *   변수 이름 자체는 별도 맵에 보존한다.
 *
 * @param {string} text 원본 텍스트 (예: "월 {amount} 절약")
 * @param {string[]} varStore 변수 이름 저장소 (치환 인덱스 공유)
 * @returns {string} 태그 치환된 텍스트
 */
function encodeVars(text, varStore) {
  return text.replace(/\{([^}]+)\}/g, (_, varName) => {
    const idx = varStore.length;
    varStore.push(varName);
    return `<x id="${idx}"/>`;
  });
}

/**
 * DeepL 번역 결과에서 XML 태그를 원래 변수 이름으로 복원.
 *
 * @param {string} text 번역된 텍스트 (XML 태그 포함)
 * @param {string[]} varStore 변수 이름 저장소
 * @returns {string} 복원된 텍스트
 */
function decodeVars(text, varStore) {
  return text.replace(/<x id="(\d+)"\/>/g, (_, idx) => {
    const varName = varStore[Number(idx)];
    return varName !== undefined ? `{${varName}}` : `{?}`;
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

// ─── 실행 진입점 ─────────────────────────────────────────────────────────────

async function main() {
  console.log('=== translate.mjs — Phase B (DeepL 실번역) ===');
  console.log('');

  // 1. ko.json 읽기
  const koPath = join(MESSAGES_DIR, 'ko.json');
  const koRaw = readFileSync(koPath, 'utf8');
  const koJson = JSON.parse(koRaw);

  console.log(`소스: ${koPath}`);

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

  // 3. 언어별 번역 실행
  let totalTranslated = 0;

  for (const { lang, locale } of TARGET_LANGS) {
    console.log(`\n[${locale}] ko → ${lang} 번역 시작...`);

    // 언어별 독립 varStore
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
