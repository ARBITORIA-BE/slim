/**
 * next-intl locale-aware navigation helpers (ADR-0033 §T1).
 *
 * createNavigation(routing) 이 생성하는 locale-aware Link/useRouter/usePathname 은
 * 현재 locale 을 자동으로 URL prefix 에 적용한다.
 *
 * 사용처:
 *   - 클라이언트 컴포넌트: useRouter, usePathname
 *   - RSC/CC 공통: Link (next/link 대신 — locale prefix 자동 처리)
 *
 * localePrefix: 'as-needed' (routing.ts) → defaultLocale(nl-BE) URL 은 prefix 없음.
 * 베타 사용자는 기존 URL (/compare, /r/... 등) 그대로 사용.
 *
 * 서버 컴포넌트 redirect: next/navigation 의 redirect 직접 사용 (string URL 지원).
 *   as-needed prefix → defaultLocale 은 prefix 없음 → `/compare` 그대로 동작.
 */

import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, useRouter, usePathname, getPathname } =
  createNavigation(routing);
