/**
 * var-protection.ts — ICU {variable} 보호 유틸 (DeepL XML 태그 인코딩/디코딩).
 *
 * 왜 별도 파일로 분리했는가:
 *   translate.mjs 는 Node.js ESM 스크립트 (.mjs) 라 Vitest 에서 직접 import 불가.
 *   단위 테스트 가능하도록 핵심 보호 로직을 TypeScript 모듈로 분리.
 *   translate.mjs 에서 동일 로직을 인라인으로 사용한다 (duplication 허용 —
 *   scripts/ 는 프로덕션 번들 외부이며 로직이 단순해 동기화 부담 작음).
 *
 * PLAN 4.5.j.4.A.1 verifier FAIL 수정: DeepL XML 태그 공백 흡수 버그 대응.
 */

/**
 * ICU 변수 하나의 메타데이터.
 *
 * 왜 spaceBefore/spaceAfter 를 저장하는가:
 *   DeepL tag_handling=xml 이 <x id="N"/> 태그 양옆 공백을 흡수한다.
 *   예: "데이터 {value} GB" → DeepL → "Data<x id="0"/>GB" (공백 소실!)
 *   ko 원문의 공백 유무를 미리 기록 → decodeVars 에서 복원.
 */
export interface VarEntry {
  name: string;
  /** ko 원문에서 {var} 바로 앞이 공백이었는가 */
  spaceBefore: boolean;
  /** ko 원문에서 {var} 바로 뒤가 공백이었는가 */
  spaceAfter: boolean;
}

/**
 * next-intl ICU 변수 {varName} 을 DeepL XML 태그로 치환.
 *
 * 왜 XML 태그인가:
 *   DeepL tag_handling=xml 설정 시 태그 내부를 번역하지 않는다.
 *   {amount} → <x id="0"/> → DeepL 통과 → {amount} 복원.
 *
 * 왜 공백 정보를 함께 저장하는가:
 *   DeepL XML 모드가 태그 양옆 공백을 흡수하는 버그가 있다.
 *   ko 원문에서 {var} 양옆 공백 유무를 미리 저장 → decodeVars 에서 복원.
 *   과교정 방지: ko 에 공백 있으면 번역문에도 보장. ko 에 없으면 강제 안 함.
 *
 * @example
 *   const store: VarEntry[] = [];
 *   encodeVars("데이터 {value} GB", store)
 *   // → "데이터 <x id=\"0\"/> GB"
 *   // store[0] = { name: "value", spaceBefore: true, spaceAfter: true }
 */
export function encodeVars(text: string, varStore: VarEntry[]): string {
  return text.replace(/\{([^}]+)\}/g, (match: string, varName: string, offset: number): string => {
    const spaceBefore = offset > 0 && text[offset - 1] === ' ';
    const spaceAfter =
      offset + match.length < text.length && text[offset + match.length] === ' ';

    const idx = varStore.length;
    varStore.push({ name: varName, spaceBefore, spaceAfter });
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
 * @example
 *   // store[0] = { name: "value", spaceBefore: true, spaceAfter: true }
 *   decodeVars("Data<x id=\"0\"/>GB", store)
 *   // → "Data {value} GB"  (ko 원문에 양쪽 공백 있으므로 복원)
 */
export function decodeVars(text: string, varStore: VarEntry[]): string {
  return text.replace(
    /<x id="(\d+)"\/>/g,
    (match: string, idxStr: string, offset: number, fullText: string): string => {
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
    },
  );
}
