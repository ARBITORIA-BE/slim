/**
 * 메타데이터 i18n 키 정합성 테스트 (PLAN 4.5.j.4.B — ADR-0033 §A2.9.2).
 *
 * 목적: generateMetadata 에서 사용하는 신규/재사용 키가 4 locale 파일에
 *       모두 존재하는지 정적으로 검증한다.
 *
 * 검증 범위:
 *   1. 신규 키: home.metaTitle / home.metaDescription / metadata.* (4개)
 *   2. 재사용 키: compare.pageTitle / compare.pageDescription
 *   3. step title 키: compare.postal.title / household.title / bill.title /
 *      preview.title / currentProvider.title
 *   4. result 키: result.pageTitle / result.pageDescription / result.notFound.heading
 */

import { describe, expect, it } from 'vitest';

// 4 locale 메시지 파일 직접 import (빌드 타임 검증)
// why: next-intl 런타임 없이 JSON 구조 정합성만 검사.
import ko from '../../messages/ko.json';
import nl from '../../messages/nl.json';
import fr from '../../messages/fr.json';
import en from '../../messages/en.json';

// @builder-justification: JSON import — 타입 추론을 위해 as const 불필요, 구조 접근 목적
type Messages = typeof ko;

const locales: [string, Messages][] = [
  ['ko', ko],
  ['nl', nl as unknown as Messages],
  ['fr', fr as unknown as Messages],
  ['en', en as unknown as Messages],
];

describe('metadata i18n 키 정합성 (ADR-0033 §A2.9.2)', () => {
  describe('신규 키 — home.metaTitle / home.metaDescription', () => {
    it.each(locales)('%s: home.metaTitle 존재 + 비어있지 않음', (_locale, messages) => {
      expect(messages.home.metaTitle).toBeTruthy();
    });

    it.each(locales)('%s: home.metaDescription 존재 + 비어있지 않음', (_locale, messages) => {
      expect(messages.home.metaDescription).toBeTruthy();
    });
  });

  describe('신규 키 — metadata.* 네임스페이스', () => {
    it.each(locales)('%s: metadata.defaultTitle 존재', (_locale, messages) => {
      expect(messages.metadata.defaultTitle).toBeTruthy();
    });

    it.each(locales)('%s: metadata.description 존재', (_locale, messages) => {
      expect(messages.metadata.description).toBeTruthy();
    });

    it.each(locales)('%s: metadata.ogTitle 존재', (_locale, messages) => {
      expect(messages.metadata.ogTitle).toBeTruthy();
    });

    it.each(locales)('%s: metadata.ogDescription 존재', (_locale, messages) => {
      expect(messages.metadata.ogDescription).toBeTruthy();
    });
  });

  describe('재사용 키 — compare.pageTitle / pageDescription', () => {
    it.each(locales)('%s: compare.pageTitle 존재', (_locale, messages) => {
      expect(messages.compare.pageTitle).toBeTruthy();
    });

    it.each(locales)('%s: compare.pageDescription 존재', (_locale, messages) => {
      expect(messages.compare.pageDescription).toBeTruthy();
    });
  });

  describe('신규 step title 키 — compare.<step>.title', () => {
    it.each(locales)('%s: compare.postal.title 존재', (_locale, messages) => {
      expect(messages.compare.postal.title).toBeTruthy();
    });

    it.each(locales)('%s: compare.household.title 존재', (_locale, messages) => {
      expect(messages.compare.household.title).toBeTruthy();
    });

    // ADR-0016 Amendment 3: compare.bill.* 제거 (2026-06-06)
    // bill.title 테스트 삭제 — bill 페이지 + i18n 키 제거됨

    it.each(locales)('%s: compare.preview.title 존재', (_locale, messages) => {
      expect(messages.compare.preview.title).toBeTruthy();
    });

    it.each(locales)('%s: compare.currentProvider.title 존재', (_locale, messages) => {
      expect(messages.compare.currentProvider.title).toBeTruthy();
    });
  });

  describe('재사용 키 — result.pageTitle / pageDescription / notFound.heading', () => {
    it.each(locales)('%s: result.pageTitle 존재', (_locale, messages) => {
      expect(messages.result.pageTitle).toBeTruthy();
    });

    it.each(locales)('%s: result.pageDescription 존재', (_locale, messages) => {
      expect(messages.result.pageDescription).toBeTruthy();
    });

    it.each(locales)('%s: result.notFound.heading 존재', (_locale, messages) => {
      expect(messages.result.notFound.heading).toBeTruthy();
    });
  });

  describe('og:locale 매핑 — 5 locale 전수', () => {
    // layout.tsx 의 OG_LOCALE_MAP 상수와 동기화
    const OG_LOCALE_MAP: Record<string, string> = {
      'nl-BE': 'nl_BE',
      'nl-NL': 'nl_NL',
      'fr-BE': 'fr_BE',
      'fr-LU': 'fr_LU',
      'en': 'en_US',
    };

    it('routing locales 5개 전부 OG_LOCALE_MAP 에 매핑됨', () => {
      const routingLocales = ['nl-BE', 'nl-NL', 'fr-BE', 'fr-LU', 'en'];
      for (const locale of routingLocales) {
        expect(OG_LOCALE_MAP[locale]).toBeTruthy();
      }
    });

    it('OG locale 값이 BCP-47 → 밑줄 언더스코어 형식임', () => {
      for (const ogLocale of Object.values(OG_LOCALE_MAP)) {
        // Open Graph locale 형식: language_REGION (예: nl_BE)
        expect(ogLocale).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
      }
    });
  });
});
