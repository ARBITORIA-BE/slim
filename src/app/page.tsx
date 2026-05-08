import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="font-display text-5xl font-medium tracking-tight">
        Slim<span className="text-accent">.</span>
      </h1>
      <p className="text-fg-soft text-lg max-w-md text-center">
        비교는 쉽게, 절약은 두툼하게.
      </p>
      <Button>지금 비교하기</Button>
      <p className="text-muted text-sm mt-8">Phase 0 부트스트랩 완료 ✅</p>
    </main>
  );
}
