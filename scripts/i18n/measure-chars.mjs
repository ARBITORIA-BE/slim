/**
 * measure-chars.mjs — ko.json 총 문자 수 + DeepL 호출 분량 측정.
 *
 * ADR-0033 §Verification #5 + PLAN 4.5.j.2 DoD (4).
 * Phase A: 골격만 — 실행은 Phase B (DEEPL_API_KEY 등록 후).
 *
 * 실행 방법:
 *   node scripts/i18n/measure-chars.mjs
 *
 * 출력:
 *   - ko.json 총 값 문자 수 (키 제외, 값만)
 *   - nl/fr/en base 합산 호출 분량 추정 (ko × 3 base 언어)
 *   - DeepL Free 500K 한도 대비 여유 확인
 *
 * 왜 이 스크립트가 필요한가:
 *   ADR-0033 §T3: "DeepL Free 500,000자/월 = 키화 텍스트 분량 충분히 커버할
 *   가능성 높음 (정확 측정 = 키화 후)". 이 스크립트가 그 실측 도구.
 *   base+delta 구조로 DeepL 호출 ≈ 3회 (nl/fr/en base) — 5 locale 전량보다 ~40% 절약.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = join(__dirname, '../../messages');
const DEEPL_FREE_LIMIT = 500_000;

/**
 * JSON 객체에서 모든 리프 값(문자열)을 추출한다.
 * 키/메타(`_comment`)는 제외하고 값 문자열만 합산.
 *
 * @param {unknown} obj
 * @param {string[]} acc
 * @returns {string[]}
 */
function extractLeafValues(obj, acc = []) {
  if (typeof obj === 'string') {
    acc.push(obj);
  } else if (obj && typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj)) {
      if (key === '_comment') continue; // 메타 주석 제외
      extractLeafValues(val, acc);
    }
  }
  return acc;
}

function countChars(locale) {
  try {
    const raw = readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8');
    const json = JSON.parse(raw);
    const values = extractLeafValues(json);
    return values.join('').length;
  } catch {
    return 0;
  }
}

// ─── 측정 실행 ───────────────────────────────────────────────────────────────

const koChars = countChars('ko');

// DeepL 호출 대상: ko → nl base, ko → fr base, ko → en (3회)
// region delta(nl-BE/nl-NL/fr-BE/fr-LU)는 이 3 base 에서 차이만 재번역 (ε)
const baseTargets = ['nl', 'fr', 'en'];
const estimatedDeeplChars = koChars * baseTargets.length;
const remaining = DEEPL_FREE_LIMIT - estimatedDeeplChars;

console.log('=== ADR-0033 §Verification #5 — DeepL 분량 측정 ===');
console.log(`ko.json 값 총 문자 수: ${koChars.toLocaleString()}`);
console.log(`DeepL 호출 언어: ${baseTargets.join(', ')} (base 3회)`);
console.log(`추정 총 호출 분량: ${estimatedDeeplChars.toLocaleString()}`);
console.log(`DeepL Free 한도(500K): ${DEEPL_FREE_LIMIT.toLocaleString()}`);
console.log(`한도 여유: ${remaining.toLocaleString()} 자 (${remaining > 0 ? '여유 있음' : '초과 — 분할 전략 필요'})`);
console.log('');
console.log('다음 단계:');
console.log('  1. 운영자 DEEPL_API_KEY 발급 (DeepL Free, https://www.deepl.com/pro-api)');
console.log('  2. node scripts/i18n/translate.mjs 실행');
console.log('  3. caveats.* 운영자 수동 검수 (Phase B DoD)');
console.log('  4. ADR-0033 §Verification #5 에 실측값 기록');
