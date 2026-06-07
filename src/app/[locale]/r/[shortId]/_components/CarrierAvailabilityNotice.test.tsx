/**
 * CarrierAvailabilityNotice 단위 테스트 (PLAN 4.16.d DoD).
 *
 * ADR-0043 §D5: carrier 가용성 안내 RSC.
 * 헌법 §3 P1 + P3: source/verifiedAt 명시 + Telenet Wallonia 정직 표시.
 *
 * 컴포넌트가 async RSC 이므로 await 로 JSX resolve 후 render.
 * (BetaEstimatedBanner.test.tsx 동형 패턴)
 *
 * 검증:
 *   1. nl locale: Telenet 가용성 안내 텍스트 렌더
 *   2. fr locale: 프랑스어 안내 텍스트 렌더
 *   3. en locale: 영어 안내 텍스트 렌더
 *   4. source 출처 텍스트 렌더 (P1 데이터 계약)
 *   5. verifiedAt 날짜 렌더 (P1 신선도)
 *   6. Telenet 헤딩 렌더
 *   7. 다크 패턴 자가 검사: 긴급성 표현 0건
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// ─── 메시지 픽스처 ────────────────────────────────────────────────────────────

const FIXTURES: Record<string, { notice: string; sourceLabel: string; verifiedAt: string }> = {
  nl: {
    notice: 'Telenet is alleen beschikbaar in Vlaanderen en Brussel. Gebruikers in Wallonië en Luxemburg kunnen kiezen voor Proximus of Orange BE.',
    sourceLabel: 'Bron: Telenet officiële dekkingspagina',
    verifiedAt: 'Geverifieerd op: 2026-06-08',
  },
  fr: {
    notice: "Telenet est uniquement disponible en Flandre et à Bruxelles. Les utilisateurs en Wallonie et au Luxembourg peuvent choisir Proximus ou Orange BE.",
    sourceLabel: 'Source : page de couverture officielle de Telenet',
    verifiedAt: 'Vérifié le : 2026-06-08',
  },
  en: {
    notice: 'Telenet is only available in Flanders and Brussels. Users in Wallonia and Luxembourg can choose Proximus or Orange BE.',
    sourceLabel: 'Source: Telenet official coverage page',
    verifiedAt: 'Verified: 2026-06-08',
  },
  ko: {
    notice: 'Telenet 서비스는 플란데런(Flanders) 및 브뤼셀(Brussels) 지역에서만 이용 가능합니다. 왈롱(Wallonia) 및 룩셈부르크(LU) 사용자는 Proximus 또는 Orange BE를 이용하세요.',
    sourceLabel: '출처: Telenet 공식 커버리지 페이지',
    verifiedAt: '검증일: 2026-06-08',
  },
};

// 테스트별로 locale 픽스처를 바꿀 수 있도록 팩토리 패턴.
let currentLocale = 'nl';

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    // namespace = 'compare.carrierAvailability'
    const messages = (FIXTURES as Record<string, Record<string, string>>)[currentLocale] ?? FIXTURES['nl']!;
    void namespace; // 단일 namespace — 값만 사용
    return (key: string) => (messages as Record<string, string>)[key] ?? key;
  },
  setRequestLocale: vi.fn(),
}));

import { CarrierAvailabilityNotice } from './CarrierAvailabilityNotice';

describe('CarrierAvailabilityNotice (ADR-0043 §D5)', () => {
  it('nl locale: Telenet 가용성 안내 텍스트 렌더', async () => {
    currentLocale = 'nl';
    const jsx = await CarrierAvailabilityNotice();
    render(jsx);

    // notice 텍스트 — Wallonia/Brussels 언급
    expect(screen.getByText(/Telenet is alleen beschikbaar in Vlaanderen en Brussel/)).toBeTruthy();
    // source 출처 (P1)
    expect(screen.getByText(/Telenet officiële dekkingspagina/)).toBeTruthy();
    // verifiedAt (P1)
    expect(screen.getByText(/2026-06-08/)).toBeTruthy();
  });

  it('fr locale: 프랑스어 안내 텍스트 렌더', async () => {
    currentLocale = 'fr';
    const jsx = await CarrierAvailabilityNotice();
    render(jsx);

    expect(screen.getByText(/Telenet est uniquement disponible en Flandre/)).toBeTruthy();
    expect(screen.getByText(/page de couverture officielle de Telenet/)).toBeTruthy();
  });

  it('en locale: 영어 안내 텍스트 렌더', async () => {
    currentLocale = 'en';
    const jsx = await CarrierAvailabilityNotice();
    render(jsx);

    expect(screen.getByText(/Telenet is only available in Flanders and Brussels/)).toBeTruthy();
    expect(screen.getByText(/Telenet official coverage page/)).toBeTruthy();
  });

  it('ko locale: 한국어 안내 텍스트 렌더 (G1-a 오버레이 경로)', async () => {
    currentLocale = 'ko';
    const jsx = await CarrierAvailabilityNotice();
    render(jsx);

    expect(screen.getByText(/플란데런.*브뤼셀/u)).toBeTruthy();
    expect(screen.getByText(/Telenet 공식 커버리지 페이지/)).toBeTruthy();
  });

  it('Telenet 섹션 헤딩 렌더', async () => {
    currentLocale = 'en';
    const jsx = await CarrierAvailabilityNotice();
    render(jsx);

    // 헤딩에 "Telenet" 명시 — P3 정직 표기
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toContain('Telenet');
  });

  it('접근성: aria-labelledby 정합', async () => {
    currentLocale = 'nl';
    const jsx = await CarrierAvailabilityNotice();
    const { container } = render(jsx);

    const section = container.querySelector('section[aria-labelledby="carrier-availability-heading"]');
    expect(section).toBeTruthy();
    const heading = container.querySelector('#carrier-availability-heading');
    expect(heading).toBeTruthy();
  });

  it('다크 패턴 자가 검사: 긴급성 표현 0건', async () => {
    currentLocale = 'en';
    const jsx = await CarrierAvailabilityNotice();
    const { container } = render(jsx);

    const text = container.textContent ?? '';
    // 헌법 §8 #3 다크 패턴 금지 — "X명이 지금 보고 있어요" 류
    expect(text).not.toMatch(/limited time|hurry|only \d+ left|명이 지금/i);
  });
});
