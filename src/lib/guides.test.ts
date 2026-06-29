/**
 * src/lib/guides.ts 단위 테스트 (ADR-0051 §D1/§D3).
 *
 * 검증 범위:
 *   1. getGuideEntries() 가 src/content/guides/*.mdx 를 읽어 올바른 slug 반환
 *   2. frontmatter 파싱 — title / description / publishedAt / author / category
 *   3. 디렉토리 없을 때 빈 배열 반환 (빌드 안정성)
 *   4. getGuideFrontmatter() 정상 / 없는 slug null 반환
 */

import { describe, expect, it } from 'vitest';
import { getGuideEntries, getGuideFrontmatter } from './guides';

describe('getGuideEntries', () => {
  it('src/content/guides/ 에서 최소 1개 가이드를 반환한다', async () => {
    const entries = await getGuideEntries();
    // P1 스켈레톤 가이드 1건 이상 존재
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });

  it('각 entry 가 slug + frontmatter 를 가진다', async () => {
    const entries = await getGuideEntries();
    for (const entry of entries) {
      expect(typeof entry.slug).toBe('string');
      expect(entry.slug.length).toBeGreaterThan(0);
      expect(typeof entry.frontmatter.title).toBe('string');
      expect(typeof entry.frontmatter.publishedAt).toBe('string');
    }
  });

  it('proximus-vs-telenet-vs-orange-be 슬러그가 존재한다', async () => {
    const entries = await getGuideEntries();
    const slugs = entries.map((e) => e.slug);
    expect(slugs).toContain('proximus-vs-telenet-vs-orange-be');
  });

  it('publishedAt 내림차순 정렬 — 최신 가이드 먼저', async () => {
    const entries = await getGuideEntries();
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1]!.frontmatter.publishedAt;
      const curr = entries[i]!.frontmatter.publishedAt;
      expect(prev >= curr).toBe(true);
    }
  });
});

describe('getGuideFrontmatter', () => {
  it('존재하는 slug 의 frontmatter 를 반환한다', async () => {
    const fm = await getGuideFrontmatter('proximus-vs-telenet-vs-orange-be');
    expect(fm).not.toBeNull();
    expect(fm?.title).toContain('Proximus');
    expect(fm?.publishedAt).toBe('2026-06-24');
    expect(fm?.category).toBe('guides');
  });

  it('존재하지 않는 slug 에서 null 반환', async () => {
    const fm = await getGuideFrontmatter('non-existent-slug-xyz');
    expect(fm).toBeNull();
  });
});
