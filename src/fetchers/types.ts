/**
 * 모든 외부 데이터 fetcher가 구현해야 할 인터페이스.
 * P1 (정보 우선) — source_url + fetched_at + confidence 강제.
 */
export interface FetchResult<T> {
  data: T;
  source_url: string;
  fetched_at: string;
  confidence: 'high' | 'medium' | 'low';
  caveats?: string[];
}

export interface Fetcher<T = unknown> {
  providerId: string;
  fetch(): Promise<FetchResult<T>>;
}
