/**
 * CookieSettingsButton — footer 쿠키 설정 트리거 (PLAN 4.12.d.(나)).
 *
 * 왜 별도 client island인가:
 *   SiteFooter는 RSC (서버 컴포넌트) — 클라이언트 이벤트(onClick)는 RSC에서 불가.
 *   footer 본문 RSC를 유지하면서 이 버튼만 클라이언트로 격리한다.
 *
 * 동작: 클릭 시 'slim:cookie-settings-open' 커스텀 이벤트 dispatch.
 *   CookieConsent 컴포넌트가 이 이벤트를 구독하여 배너를 재오픈한다.
 */
'use client';

interface CookieSettingsButtonProps {
  label: string; // i18n 라벨 — RSC 부모가 getTranslations로 전달
}

export function CookieSettingsButton({ label }: CookieSettingsButtonProps) {
  function handleClick() {
    window.dispatchEvent(new Event('slim:cookie-settings-open'));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="underline-offset-4 hover:text-fg hover:underline"
    >
      {label}
    </button>
  );
}
