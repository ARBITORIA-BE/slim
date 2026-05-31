/**
 * CookieConsent 단위 테스트 (PLAN 4.12.c DoD).
 *
 * 검증 범위:
 *   1. 초기 렌더: localStorage 비어 있으면 배너 노출 (visible=true)
 *   2. Accept 버튼 클릭 → localStorage 'accepted' 저장 + 배너 숨김
 *   3. Reject 버튼 클릭 → localStorage 'rejected' 저장 + 배너 숨김
 *   4. localStorage 에 'accepted' 값 있으면 초기 비노출 (visible=false)
 *   5. aria 속성 (dialog/labelledby/describedby) 정합
 *
 * mock 전략:
 *   - next-intl: useTranslations → 키 그대로 반환
 *   - localStorage: vitest의 jsdom 환경 기본 제공 (Mock 불필요)
 *   - posthog-js: vi.mock → 동의 시 init 호출 확인용
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CookieConsent } from './CookieConsent';

// next-intl useTranslations mock — 키 그대로 반환
vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

// posthog-js lazy import mock — dynamic import는 vi.mock으로 처리
vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    opt_out_capturing: vi.fn(),
  },
}));

const STORAGE_KEY = 'slim_cookie_consent';

beforeEach(() => {
  // 각 테스트 전 localStorage 초기화
  localStorage.clear();
  vi.clearAllMocks();
});

describe('CookieConsent', () => {
  it('localStorage 비어 있으면 배너 노출', async () => {
    await act(async () => {
      render(<CookieConsent />);
    });

    // role="dialog" 인 요소가 문서에 있어야 한다
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Accept 버튼 클릭 → localStorage accepted + 배너 숨김', async () => {
    await act(async () => {
      render(<CookieConsent />);
    });

    const acceptBtn = screen.getByText('legal.cookie.acceptAll');
    await act(async () => {
      fireEvent.click(acceptBtn);
    });

    // localStorage 저장 확인
    expect(localStorage.getItem(STORAGE_KEY)).toBe('accepted');
    // 배너 사라짐 확인
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Reject 버튼 클릭 → localStorage rejected + 배너 숨김', async () => {
    await act(async () => {
      render(<CookieConsent />);
    });

    const rejectBtn = screen.getByText('legal.cookie.rejectAll');
    await act(async () => {
      fireEvent.click(rejectBtn);
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe('rejected');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('localStorage에 accepted 있으면 초기 비노출', async () => {
    // 사전에 동의 저장
    localStorage.setItem(STORAGE_KEY, 'accepted');

    await act(async () => {
      render(<CookieConsent />);
    });

    // 배너가 렌더되지 않아야 한다
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('localStorage에 rejected 있으면 초기 비노출', async () => {
    localStorage.setItem(STORAGE_KEY, 'rejected');

    await act(async () => {
      render(<CookieConsent />);
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('aria 속성 dialog/labelledby/describedby 정합', async () => {
    await act(async () => {
      render(<CookieConsent />);
    });

    const dialog = screen.getByRole('dialog');
    // aria-labelledby="cookie-title"
    expect(dialog).toHaveAttribute('aria-labelledby', 'cookie-title');
    // aria-describedby="cookie-body"
    expect(dialog).toHaveAttribute('aria-describedby', 'cookie-body');

    // 참조된 id 요소들이 실제 존재해야 한다
    expect(document.getElementById('cookie-title')).toBeInTheDocument();
    expect(document.getElementById('cookie-body')).toBeInTheDocument();
  });

  it('slim:cookie-settings-open 이벤트 → 숨겨진 배너 재오픈', async () => {
    // 이미 동의한 상태 (배너 숨김)
    localStorage.setItem(STORAGE_KEY, 'accepted');

    await act(async () => {
      render(<CookieConsent />);
    });

    // 초기: 배너 없음
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // 커스텀 이벤트 dispatch
    await act(async () => {
      window.dispatchEvent(new Event('slim:cookie-settings-open'));
    });

    // 배너 재노출
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
