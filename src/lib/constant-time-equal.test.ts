import { describe, expect, it } from 'vitest';

import { constantTimeEqual } from './constant-time-equal';

describe('constantTimeEqual', () => {
  it('returns true for identical strings', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('', '')).toBe(true);
  });

  it('returns false for different content of same length', () => {
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('aaa', 'aab')).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(constantTimeEqual('a', 'ab')).toBe(false);
    expect(constantTimeEqual('ab', 'a')).toBe(false);
  });

  it('handles non-ASCII characters', () => {
    expect(constantTimeEqual('한글', '한글')).toBe(true);
    expect(constantTimeEqual('한글', '한국')).toBe(false);
  });
});
