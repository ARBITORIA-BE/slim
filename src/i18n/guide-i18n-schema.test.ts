/**
 * guides.proximusVsTelenetVsOrangeBe.* 스키마 정합 테스트 (PLAN 4.23.a).
 *
 * 목적:
 *   1. en.json = 정본 (ADR-0051 Amendment 1 §A1.B) — 리프 완결 + HTML 엔티티
 *      잔존 0 (JSX &mdash;/&nbsp; 등을 unicode 로 옮기며 놓친 실수 방지).
 *   2. nl.json / fr.json = en.json 과 동일한 키 구조 + 모든 리프에 locale
 *      prefix (`[nl] ` / `[fr] `) — 4.23.b 실 배치 전 상태 확인.
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

  it('nl.json 모든 리프가 "[nl] " prefix 를 가짐 (4.23.b 실 배치 전 placeholder 상태)', () => {
    const leaves = collectLeaves(nlGuide);
    const missing = leaves.filter((l) => !l.value.startsWith('[nl] '));
    expect(missing.map((l) => l.path)).toEqual([]);
  });

  it('fr.json 모든 리프가 "[fr] " prefix 를 가짐 (4.23.b 실 배치 전 placeholder 상태)', () => {
    const leaves = collectLeaves(frGuide);
    const missing = leaves.filter((l) => !l.value.startsWith('[fr] '));
    expect(missing.map((l) => l.path)).toEqual([]);
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
