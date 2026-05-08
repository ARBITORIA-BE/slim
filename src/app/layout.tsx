import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Slim — 비교는 쉽게, 절약은 두툼하게',
  description: '베네룩스 비교 플랫폼. BE · NL · LU에서 5분 안에 비교.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
