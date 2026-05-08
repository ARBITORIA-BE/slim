import { describe, it, expect } from 'vitest';
import type { FetchResult, Fetcher } from './types';

describe('FetchResult', () => {
  it('필수 필드를 강제하는 타입', () => {
    const result: FetchResult<{ price: number }> = {
      data: { price: 42 },
      source_url: 'https://engie.be/tariff/123',
      fetched_at: new Date().toISOString(),
      confidence: 'high',
    };
    expect(result.source_url).toMatch(/^https:\/\//);
  });

  it('Fetcher 인터페이스 — providerId 필수', () => {
    const mockFetcher: Fetcher<{ price: number }> = {
      providerId: 'engie-be',
      async fetch() {
        return {
          data: { price: 0.245 },
          source_url: 'https://engie.be',
          fetched_at: new Date().toISOString(),
          confidence: 'high',
        };
      },
    };
    expect(mockFetcher.providerId).toBe('engie-be');
  });
});
