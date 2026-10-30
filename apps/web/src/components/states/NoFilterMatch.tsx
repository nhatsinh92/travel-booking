'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { clearFiltersUrl } from '@/lib/search-params';

export default function NoFilterMatch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  return (
    <div role="status">
      <p>No hotels match these filters. Try widening the price range or lowering the stars.</p>
      <button type="button" onClick={() => router.push(clearFiltersUrl(searchParams))}>
        Clear filters
      </button>
    </div>
  );
}
