/**
 * MDX 모듈 ambient declaration (ADR-0051 §D1 정합).
 *
 * 왜 필요한가?
 *   `import GuideContent from '@/content/guides/foo.mdx'` 정적 import 시 TypeScript가
 *   `.mdx` 모듈 타입을 모름 → `TS2307: Cannot find module`. `@next/mdx`는 빌드 시 변환만
 *   제공하고 .d.ts 자동 생성 X. 본 파일이 ambient `declare module '*.mdx'` 로
 *   `ComponentType<Record<string, never>>` 타입 보장.
 *
 * 운영자 트랙: 새 가이드 .mdx 추가 시 본 파일 변경 0 (`*.mdx` 와일드카드 적용).
 */

declare module '*.mdx' {
  import type { ComponentType } from 'react';
  const Component: ComponentType<Record<string, never>>;
  export default Component;
}
