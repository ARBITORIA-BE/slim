/**
 * 가이드 콘텐츠 유틸리티 (ADR-0051 §D1/§D3).
 *
 * 왜 이 모듈이 필요한가?
 *   src/content/guides/ 디렉토리에서 MDX 파일 목록을 읽어
 *   slug + frontmatter 를 추출하는 단일 출처 함수.
 *   generateStaticParams, sitemap, 가이드 인덱스 페이지가 모두 이 함수를 소비한다.
 *
 * Node.js fs 직접 사용 (server-only) — 브라우저에서 호출 불가.
 * 'server-only' 마커 없이도 RSC 전용으로 설계 (import 시 client bundle 포함 X).
 */

import { readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';

/** 가이드 frontmatter 구조. */
export interface GuideFrontmatter {
  title: string;
  description: string;
  publishedAt: string;  // ISO 8601 date (YYYY-MM-DD)
  author: string;
  category: string;
}

/** slug + frontmatter 묶음. */
export interface GuideEntry {
  slug: string;
  frontmatter: GuideFrontmatter;
}

// 콘텐츠 디렉토리 경로 — process.cwd() 기준 (Next.js 빌드 루트).
const GUIDES_DIR = path.join(process.cwd(), 'src', 'content', 'guides');

/**
 * frontmatter YAML 블록을 파싱한다.
 *
 * 왜 gray-matter 같은 패키지 없이 직접 파싱하는가?
 *   ADR-0051 §D1 "신규 dep 0" 잠금 — @next/mdx 외 추가 dep 거부.
 *   P1 가이드 frontmatter 는 단순 key: value 구조 — 자체 파싱으로 충분.
 *
 * 지원 타입: 문자열 값만 (모든 frontmatter 필드가 문자열).
 */
function parseFrontmatter(content: string): GuideFrontmatter {
  // CRLF 안전: Windows checkout (core.autocrlf=true)에서 .mdx 가 CRLF 라
  // `\n` 만 매치하는 정규식은 frontmatter 블록을 못 잡고 default ("Untitled")
  // 로 떨어진다. `\r?\n` 으로 LF/CRLF 둘 다 처리.
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch || !fmMatch[1]) {
    return {
      title: 'Untitled',
      description: '',
      publishedAt: '',
      author: '',
      category: 'guides',
    };
  }

  const raw = fmMatch[1];
  const result: Record<string, string> = {};

  for (const line of raw.split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
    result[key] = value;
  }

  return {
    title: result['title'] ?? 'Untitled',
    description: result['description'] ?? '',
    publishedAt: result['publishedAt'] ?? '',
    author: result['author'] ?? '',
    category: result['category'] ?? 'guides',
  };
}

/**
 * src/content/guides/ 디렉토리 내 모든 .mdx 파일을 읽어
 * GuideEntry 배열을 반환한다 (publishedAt 내림차순 정렬).
 *
 * 빌드 시 정적 생성 (generateStaticParams, sitemap) 용도.
 * 런타임 오류가 나지 않도록 디렉토리가 없을 때 빈 배열 반환.
 */
export async function getGuideEntries(): Promise<GuideEntry[]> {
  let files: string[];
  try {
    files = await readdir(GUIDES_DIR);
  } catch {
    // 디렉토리가 없으면 빈 배열 (첫 빌드 안정성)
    return [];
  }

  const mdxFiles = files.filter((f) => f.endsWith('.mdx'));

  const entries: GuideEntry[] = [];
  for (const file of mdxFiles) {
    const slug = file.replace(/\.mdx$/, '');
    try {
      const raw = await readFile(path.join(GUIDES_DIR, file), 'utf-8');
      const frontmatter = parseFrontmatter(raw);
      entries.push({ slug, frontmatter });
    } catch {
      // 개별 파일 읽기 실패 시 건너뜀 (빌드 차단 방지)
    }
  }

  // publishedAt 내림차순 — 최신 가이드 먼저
  entries.sort((a, b) =>
    b.frontmatter.publishedAt.localeCompare(a.frontmatter.publishedAt),
  );

  return entries;
}

/**
 * 특정 slug 의 가이드 frontmatter 를 반환한다.
 * 존재하지 않으면 null.
 */
export async function getGuideFrontmatter(
  slug: string,
): Promise<GuideFrontmatter | null> {
  try {
    const raw = await readFile(
      path.join(GUIDES_DIR, `${slug}.mdx`),
      'utf-8',
    );
    return parseFrontmatter(raw);
  } catch {
    return null;
  }
}
