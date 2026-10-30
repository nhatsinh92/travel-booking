'use client';

import { useSearchParams } from 'next/navigation';
import LoadingResults from '@/components/states/LoadingResults';
import SearchHint from '@/components/states/SearchHint';
import { hasSearch } from '@/lib/search-params';

// What the results area shows while it waits: the loading placeholder when the URL carries a
// search, the hint when it does not (a bare /search runs no search, so nothing is loading).
export default function ResultsFallback() {
  return hasSearch(useSearchParams()) ? <LoadingResults /> : <SearchHint />;
}
