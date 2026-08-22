/**
 * caveat-text 단위 테스트 (PLAN 4.28, ADR-0055 §D1)
 *
 * 실제 messages/*.json 을 읽어 4 로케일 전부를 검사한다 — mock 번역기로 테스트하면
 * "키는 있는데 로케일 파일에 없다" 는 이번 사고의 원인을 못 잡는다.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, it, expect } from 'vitest';

import { serializeCaveat, CAVEAT_CODES } from '@/engine/caveat-codes';

import { formatCaveats } from './caveat-text';

const LOCALES = ['ko', 'en', 'nl', 'fr'] as const;

function loadCaveatMessages(locale: string): Record<string, string> {
  const file = path.join(process.cwd(), 'messages', `${locale}.json`);
  const json = JSON.parse(readFileSync(file, 'utf8')) as {
    caveats: Record<string, string>;
  };
  return json.caveats;
}

/** next-intl 의 t() 를 최소 구현으로 흉내 (ICU {param} 치환). */
function makeTranslator(messages: Record<string, string>) {
  return (key: string, values?: Record<string, string | number>): string => {
    const template = messages[key];
    if (template === undefined) throw new Error(`missing key: ${key}`);
    return template.replace(/\{(\w+)\}/g, (_m, name: string) =>
      String(values?.[name] ?? `{${name}}`),
    );
  };
}

const SAMPLE = [
  serializeCaveat({ code: 'commitment', params: { months: 24 } }),
  serializeCaveat({ code: 'activationFee', params: { amount: '€50' } }),
  serializeCaveat({ code: 'promoEnds', params: { months: 6, price: '€16.99' } }),
  serializeCaveat({ code: 'dataOverage', params: { usedGb: 10, planGb: 5 } }),
  serializeCaveat({ code: 'noEuRoaming', params: {} }),
  serializeCaveat({ code: 'speed4kInsufficient', params: { mbps: 50 } }),
  serializeCaveat({ code: 'confidenceMedium', params: { reason: '' } }),
  serializeCaveat({ code: 'currentTariffConfidence', params: { confidence: 'medium' } }),
  serializeCaveat({ code: 'stubEstimate', params: {} }),
];

describe('formatCaveats — 4 로케일 실제 메시지', () => {
  for (const locale of LOCALES) {
    it(`${locale}: 모든 코드가 번역된다 (키 누락 0)`, () => {
      const t = makeTranslator(loadCaveatMessages(locale));
      const { texts, unresolved } = formatCaveats(SAMPLE, t);
      expect(unresolved).toBe(0);
      expect(texts).toHaveLength(SAMPLE.length);
      for (const text of texts) expect(text.length).toBeGreaterThan(0);
    });

    it(`${locale}: 치환되지 않은 {param} 플레이스홀더가 남지 않는다`, () => {
      const t = makeTranslator(loadCaveatMessages(locale));
      const { texts } = formatCaveats(SAMPLE, t);
      for (const text of texts) expect(text).not.toMatch(/\{\w+\}/);
    });
  }

  it('ko 이외 로케일에는 한글이 나오지 않는다 (이번 사고의 회귀 가드)', () => {
    for (const locale of ['en', 'nl', 'fr'] as const) {
      const t = makeTranslator(loadCaveatMessages(locale));
      const { texts } = formatCaveats(SAMPLE, t);
      for (const text of texts) {
        expect(/[가-힣]/.test(text), `${locale}: ${text}`).toBe(false);
      }
    }
  });

  it('레거시 한국어 문장도 현재 로케일로 번역된다 (DB 백필 불필요)', () => {
    const t = makeTranslator(loadCaveatMessages('en'));
    const { texts, unresolved } = formatCaveats(
      [
        '프로모 가격은 첫 6개월만 — 이후 €16.99/월',
        '월 10GB 사용 → 본 요금제 5GB 초과. 한도 초과 비용은 표시되지 않습니다.',
      ],
      t,
    );

    expect(unresolved).toBe(0);
    expect(texts[0]).toContain('6');
    expect(texts[0]).toContain('€16.99');
    expect(/[가-힣]/.test(texts.join(' '))).toBe(false);
  });

  it('복원 불가 문장은 원문 유지 + unresolved 카운트', () => {
    const t = makeTranslator(loadCaveatMessages('en'));
    const { texts, unresolved } = formatCaveats(['정체불명 문장'], t);
    expect(unresolved).toBe(1);
    expect(texts[0]).toBe('정체불명 문장');
  });

  it('confidenceMedium: reason 이 비면 중립 기본값으로 채운다', () => {
    const messages = loadCaveatMessages('en');
    const t = makeTranslator(messages);
    const { texts } = formatCaveats(
      [serializeCaveat({ code: 'confidenceMedium', params: { reason: '' } })],
      t,
    );
    expect(texts[0]).toContain(messages['confidenceMediumDefaultReason'] ?? '');
  });

  it('codes 를 함께 돌려준다 (UI 분기용 — 절약액 단정 회피)', () => {
    const t = makeTranslator(loadCaveatMessages('en'));
    const { codes } = formatCaveats(SAMPLE, t);
    expect(codes).toEqual([...CAVEAT_CODES]);
  });
});
