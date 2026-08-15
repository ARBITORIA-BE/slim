/**
 * guides.proximusVsTelenetVsOrangeBe.* 스키마 정합 테스트 (PLAN 4.23.a).
 *
 * 목적:
 *   1. en.json = 정본 (ADR-0051 Amendment 1 §A1.B) — 리프 완결 + HTML 엔티티
 *      잔존 0 (JSX &mdash;/&nbsp; 등을 unicode 로 옮기며 놓친 실수 방지).
 *   2. nl.json / fr.json = en.json 과 동일한 키 구조 + 모든 리프에 locale
 *      prefix (`[nl] ` / `[fr] `) 잔존 0 — 4.23.b DeepL 배치 완료 후 불변식.
 *   3. ko.json = `_comment` 전용 스킵 (en 정본 예외, 리프 값 0).
 */

import { describe, expect, it } from 'vitest';

import ko from '../../messages/ko.json';
import nl from '../../messages/nl.json';
import fr from '../../messages/fr.json';
import en from '../../messages/en.json';

// @builder-justification: JSON import — 구조 순회를 위해 타입 단언, 재귀 순회 유틸에서만 사용
type JsonNode = string | { [key: string]: JsonNode };

function collectLeaves(node: JsonNode, pathStack: string[] = []): Array<{ path: string; value: string }> {
  if (typeof node === 'string') {
    return [{ path: pathStack.join('.'), value: node }];
  }
  const leaves: Array<{ path: string; value: string }> = [];
  for (const [key, val] of Object.entries(node)) {
    if (key === '_comment') continue;
    leaves.push(...collectLeaves(val, [...pathStack, key]));
  }
  return leaves;
}

const enGuide = (en.guides as Record<string, unknown>)
  .proximusVsTelenetVsOrangeBe as JsonNode;
const nlGuide = (nl.guides as Record<string, unknown>)
  .proximusVsTelenetVsOrangeBe as JsonNode;
const frGuide = (fr.guides as Record<string, unknown>)
  .proximusVsTelenetVsOrangeBe as JsonNode;
const koGuide = (ko.guides as Record<string, unknown>)
  .proximusVsTelenetVsOrangeBe as Record<string, unknown>;

describe('guides.proximusVsTelenetVsOrangeBe 스키마 정합 (PLAN 4.23.a)', () => {
  it('en.json 리프 완결 — 100개 이상 (architect 추정 160~200 대비 실제 122)', () => {
    const leaves = collectLeaves(enGuide);
    expect(leaves.length).toBeGreaterThanOrEqual(100);
  });

  it('en.json 리프에 남은 HTML 엔티티 0건 (&mdash;/&nbsp;/&ldquo; 등 unicode 치환 누락 감지)', () => {
    const leaves = collectLeaves(enGuide);
    const leftover = leaves.filter((l) => /&[a-z]+;/i.test(l.value));
    expect(leftover.map((l) => l.path)).toEqual([]);
  });

  it('nl.json 키 구조가 en.json 과 동일', () => {
    const enPaths = collectLeaves(enGuide).map((l) => l.path).sort();
    const nlPaths = collectLeaves(nlGuide).map((l) => l.path).sort();
    expect(nlPaths).toEqual(enPaths);
  });

  it('fr.json 키 구조가 en.json 과 동일', () => {
    const enPaths = collectLeaves(enGuide).map((l) => l.path).sort();
    const frPaths = collectLeaves(frGuide).map((l) => l.path).sort();
    expect(frPaths).toEqual(enPaths);
  });

  // 4.23.b (2026-08-15) DeepL 배치 완료 후 불변식 반전:
  //   P2a 시점에는 "모든 리프가 [nl]/[fr] prefix 를 가짐" 을 단언했다 (placeholder 상태).
  //   배치 후에는 그 반대가 불변식이다 — prefix 가 하나라도 남으면 공개 SEO 페이지에
  //   `[nl] Belgium's...` 같은 마커가 노출된다 (실제로 4.23.a 머지 후 prod 에서 발생).
  //   따라서 회귀 방지 방향은 "prefix 0건" 이다.

  it('nl.json 리프에 "[nl] " placeholder prefix 잔존 0 (4.23.b 배치 완료 불변식)', () => {
    const leaves = collectLeaves(nlGuide);
    const stray = leaves.filter((l) => l.value.startsWith('[nl] '));
    expect(stray.map((l) => l.path)).toEqual([]);
  });

  it('fr.json 리프에 "[fr] " placeholder prefix 잔존 0 (4.23.b 배치 완료 불변식)', () => {
    const leaves = collectLeaves(frGuide);
    const stray = leaves.filter((l) => l.value.startsWith('[fr] '));
    expect(stray.map((l) => l.path)).toEqual([]);
  });

  it('nl/fr 리프가 en 과 다른 실 번역값 (미번역 잔존 탐지)', () => {
    const en = new Map(collectLeaves(enGuide).map((l) => [l.path, l.value]));
    const untranslated = (guide: JsonNode) =>
      collectLeaves(guide)
        // 고유명사/기호만인 셀(예: "Proximus", "—")은 번역해도 동일할 수 있어 제외
        .filter((l) => l.value.length > 25 && en.get(l.path) === l.value)
        .map((l) => l.path);

    expect(untranslated(nlGuide)).toEqual([]);
    expect(untranslated(frGuide)).toEqual([]);
  });

  it('ko.json 은 _comment 전용 스킵 명시 — 리프 값 0 (ADR-0051 Amd 1 §A1.B en 정본 예외)', () => {
    expect(koGuide._comment).toBeTruthy();
    expect(typeof koGuide._comment).toBe('string');
    const keys = Object.keys(koGuide);
    expect(keys).toEqual(['_comment']);
  });

  it('기존 guides.* 9키 (metaTitle 등) 는 4 locale 모두 그대로 유지', () => {
    const shellKeys = [
      'metaTitle',
      'metaDescription',
      'indexHeading',
      'indexDescription',
      'empty',
      'publishedAt',
      'author',
      'readMore',
      'contentComingSoon',
    ];
    for (const key of shellKeys) {
      expect((en.guides as Record<string, unknown>)[key]).toBeTruthy();
      expect((nl.guides as Record<string, unknown>)[key]).toBeTruthy();
      expect((fr.guides as Record<string, unknown>)[key]).toBeTruthy();
      expect((ko.guides as Record<string, unknown>)[key]).toBeTruthy();
    }
  });
});
