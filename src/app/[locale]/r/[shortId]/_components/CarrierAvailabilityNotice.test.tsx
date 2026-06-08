/**
 * CarrierAvailabilityNotice 단위 테스트 (ADR-0043 §D3).
 *
 * 검증 항목:
 *   1. 4 locale 렌더 + 한국어 텍스트가 nl/fr/en 에 없음 (i18n 정합)
 *   2. Telenet 매트릭스 텍스트 포함 여부
 *   3. source + verifiedAt 명시 (헌법 §3 P1 — 출처 없는 숫자 reject)
 *   4. 다크패턴 자가 검사 (헌법 §3 P3 — 사용자 압박 패턴 없음)
 *   5. aria-labelledby 섹션 구조 정합
 *
 * 왜 RSC 를 Vitest 로 테스트하는가?
 *   CarrierAvailabilityNotice 는 async Server Component 이다.
 *   next-intl 의 getTranslations 를 mock 하면 실제 번역 메시지를
 *   주입하여 렌더 결과를 검증할 수 있다.
 */

import { render } from '@testing-library/react';
import { describe, expect, it, vi, type Mock } from 'vitest';

// next-intl 서버 함수 mock
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(),
}));

import { getTranslations } from 'next-intl/server';
import { CarrierAvailabilityNotice } from './CarrierAvailabilityNotice';

// 4 base locale 의 번역 메시지 (messages/*.json 실제 값)
const TRANSLATIONS: Record<string, Record<string, string>> = {
  ko: {
    notice: '참고: Telenet은 플랑드르(Flanders)와 브뤼셀 지역에서만 서비스됩니다. 왈로니아(Wallonia) 거주 시 2 공급사(Proximus, Orange BE)가 비교 후보가 됩니다.',
    sourceLabel: '출처: Telenet 공식 네트워크 페이지',
    verifiedAt: '확인: 2026-06-07',
  },
  nl: {
    notice: 'Let op: Telenet is alleen beschikbaar in Vlaanderen en Brussel. Inwoners van Wallonië kunnen kiezen uit 2 providers (Proximus, Orange BE).',
    sourceLabel: 'Bron: officiële netwerkpagina van Telenet',
    verifiedAt: 'Geverifieerd: 2026-06-07',
  },
  fr: {
    notice: 'Remarque : Telenet est uniquement disponible en Flandre et à Bruxelles. Les résidents de Wallonie peuvent choisir parmi 2 opérateurs (Proximus, Orange BE).',
    sourceLabel: 'Source : page officielle du réseau Telenet',
    verifiedAt: 'Vérifié le : 2026-06-07',
  },
  en: {
    notice: 'Note: Telenet is available in Flanders and Brussels only. Wallonia users can choose from 2 providers (Proximus, Orange BE).',
    sourceLabel: 'Source: Telenet official network page',
    verifiedAt: 'Verified: 2026-06-07',
  },
};

// 다크패턴 금지 패턴 목록 (헌법 §8 #3)
const DARK_PATTERN_PATTERNS = [
  /\d+\s*(명|사람|people|users|viewers|personen|personnes|mensen).*(보고|looking|view|kijken|regardent)/i,
  /지금\s*빨리/i,
  /limited\s*time/i,
  /nur\s*noch/i,
  /hurry/i,
  /only\s+\d+\s+left/i,
];

describe('CarrierAvailabilityNotice (ADR-0043 §D3)', () => {
  describe('4 locale 렌더 + i18n 정합', () => {
    it.each(Object.entries(TRANSLATIONS))('%s locale: Telenet 텍스트 포함', async (_locale, msgs) => {
      // why: getTranslations mock 이 locale 별 번역 반환 — 실제 messages/*.json 값과 동일.
      (getTranslations as Mock).mockResolvedValue((key: string) => msgs[key] ?? '');

      const { container } = render(await CarrierAvailabilityNotice());

      // Telenet 텍스트 확인
      expect(container.textContent).toContain('Telenet');
    });

    it('nl locale: 한국어 텍스트 없음', async () => {
      const msgs = TRANSLATIONS['nl']!;
      (getTranslations as Mock).mockResolvedValue((key: string) => msgs[key] ?? '');

      const { container } = render(await CarrierAvailabilityNotice());
      // 한글 유니코드 블록 없어야 함
      expect(container.textContent).not.toMatch(/[가-힣]/);
    });

    it('fr locale: 한국어 텍스트 없음', async () => {
      const msgs = TRANSLATIONS['fr']!;
      (getTranslations as Mock).mockResolvedValue((key: string) => msgs[key] ?? '');

      const { container } = render(await CarrierAvailabilityNotice());
      expect(container.textContent).not.toMatch(/[가-힣]/);
    });

    it('en locale: 한국어 텍스트 없음', async () => {
      const msgs = TRANSLATIONS['en']!;
      (getTranslations as Mock).mockResolvedValue((key: string) => msgs[key] ?? '');

      const { container } = render(await CarrierAvailabilityNotice());
      expect(container.textContent).not.toMatch(/[가-힣]/);
    });
  });

  describe('source + verifiedAt 명시 (헌법 §3 P1)', () => {
    it('ko: sourceLabel + verifiedAt 텍스트 렌더', async () => {
      const msgs = TRANSLATIONS['ko']!;
      (getTranslations as Mock).mockResolvedValue((key: string) => msgs[key] ?? '');

      const { container } = render(await CarrierAvailabilityNotice());
      // why: source 없는 숫자/주장 = 헌법 §3 P1 위반. source + verifiedAt 모두 필수.
      expect(container.textContent).toContain('2026-06-07');
    });

    it('en: source + verifiedAt 포함', async () => {
      const msgs = TRANSLATIONS['en']!;
      (getTranslations as Mock).mockResolvedValue((key: string) => msgs[key] ?? '');

      const { container } = render(await CarrierAvailabilityNotice());
      expect(container.textContent).toContain('Telenet official network page');
      expect(container.textContent).toContain('2026-06-07');
    });
  });

  describe('aria 구조 정합', () => {
    it('section + aria-labelledby 있음', async () => {
      const msgs = TRANSLATIONS['ko']!;
      (getTranslations as Mock).mockResolvedValue((key: string) => msgs[key] ?? '');

      const { container } = render(await CarrierAvailabilityNotice());
      const section = container.querySelector('section');
      expect(section).toBeTruthy();
      expect(section?.getAttribute('aria-labelledby')).toBe('carrier-availability-heading');
      const heading = container.querySelector('#carrier-availability-heading');
      expect(heading).toBeTruthy();
    });
  });

  describe('다크패턴 자가 검사 (헌법 §3 P3)', () => {
    it('ko: 사용자 압박 패턴 없음', async () => {
      const msgs = TRANSLATIONS['ko']!;
      (getTranslations as Mock).mockResolvedValue((key: string) => msgs[key] ?? '');

      const { container } = render(await CarrierAvailabilityNotice());
      const text = container.textContent ?? '';
      for (const pattern of DARK_PATTERN_PATTERNS) {
        expect(text).not.toMatch(pattern);
      }
    });

    it('en: 사용자 압박 패턴 없음', async () => {
      const msgs = TRANSLATIONS['en']!;
      (getTranslations as Mock).mockResolvedValue((key: string) => msgs[key] ?? '');

      const { container } = render(await CarrierAvailabilityNotice());
      const text = container.textContent ?? '';
      for (const pattern of DARK_PATTERN_PATTERNS) {
        expect(text).not.toMatch(pattern);
      }
    });
  });
});
