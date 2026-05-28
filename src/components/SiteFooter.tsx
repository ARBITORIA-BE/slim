/**
 * SiteFooter — 사이트 전역 푸터 (PLAN 4.10.c).
 *
 * 왜:
 *   벨기에 경제법전(CDE) Art. III.74 + XII.6 — 상업 웹사이트는 기업번호·VAT·
 *   법인명·연락처를 모든 페이지에서 접근 가능하게 표시해야 한다.
 *   [locale]/layout.tsx 가 전 페이지 하단에 1회 렌더 → "상시 접근" 충족.
 *   헌법 P3(투명성은 운영자의 짐) 정합.
 *
 * 식별정보 값: src/lib/legal.ts LEGAL_ENTITY 단일 출처 (locale 무관).
 * 라벨: footer.* 네임스페이스 i18n — getTranslations (RSC).
 *   왜 i18n 인가: 공개 사이트는 nl/fr/en 으로 서빙된다 (request.ts base+delta).
 *   한국어 하드코딩 시 공개 네덜란드어 페이지에 한국어 라벨이 노출된다.
 * address null 이면 주소 줄 비노출 (P1 — 추측 주소 금지).
 *
 * RSC — 상호작용 0 → 클라이언트 JS 0 추가 (LCP/번들 예산 보호, 헌법 P2).
 */

import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import {
  LEGAL_ENTITY,
  formatEnterpriseNumber,
  formatVatNumber,
} from '@/lib/legal';
import { LocaleSwitcher } from './LocaleSwitcher';

export async function SiteFooter() {
  const t = await getTranslations('footer');
  const { legalName, enterpriseNumber, vatNumber, address, contactEmail } =
    LEGAL_ENTITY;
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="mt-16 border-t border-fg/10 bg-bg-warm/30"
      aria-label={t('companyInfoHeading')}
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 text-xs text-fg-soft md:px-6">
        {/* ── 사업자 식별정보 (CDE Art. III.74 / XII.6) ── */}
        <section className="flex flex-col gap-1">
          <h2 className="mb-1 font-semibold text-fg">
            {t('companyInfoHeading')}
          </h2>
          <p>
            <span>{t('operatorLabel')}:</span>{' '}
            <span className="text-fg">{legalName}</span>
          </p>
          <p>
            <span>{t('companyNumberLabel')}:</span>{' '}
            <span className="font-mono text-fg">
              {formatEnterpriseNumber(enterpriseNumber)}
            </span>
          </p>
          <p>
            <span>{t('vatLabel')}:</span>{' '}
            <span className="font-mono text-fg">
              {formatVatNumber(vatNumber)}
            </span>
          </p>
          {/* 주소: 운영자 제공 시에만 노출 (address null = 비노출, P1) */}
          {address && (
            <p>
              <span>{t('addressLabel')}:</span>{' '}
              <span className="text-fg">
                {address.street}, {address.postalCode} {address.city},{' '}
                {address.country}
              </span>
            </p>
          )}
          <p>
            <span>{t('contactLabel')}:</span>{' '}
            <a
              href={`mailto:${contactEmail}`}
              className="underline underline-offset-4 hover:text-fg"
            >
              {contactEmail}
            </a>
          </p>
        </section>

        {/* ── 법무 / 투명성 링크 ── */}
        <nav
          aria-label={t('legalLinksLabel')}
          className="flex flex-wrap gap-x-4 gap-y-1"
        >
          <Link
            href="/legal/affiliate-disclosure"
            className="underline-offset-4 hover:text-fg hover:underline"
          >
            {t('affiliateDisclosureLink')}
          </Link>
          <Link
            href="/data-sources"
            className="underline-offset-4 hover:text-fg hover:underline"
          >
            {t('dataSourcesLink')}
          </Link>
        </nav>

        {/* ── 언어 전환기 (LocaleSwitcher client 섬, PLAN 4.11.c) ── */}
        <LocaleSwitcher />

        {/* ── 저작권 ── */}
        <p className="text-fg-soft/70">{t('copyright', { year: currentYear })}</p>
      </div>
    </footer>
  );
}
