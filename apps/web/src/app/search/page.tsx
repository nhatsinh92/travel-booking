import { connection } from 'next/server';
import { Suspense } from 'react';
import KeyedBySearchParams from '@/components/KeyedBySearchParams';
import ResultsFallback from '@/components/ResultsFallback';
import ResultsList from '@/components/ResultsList';
import SearchForm from '@/components/SearchForm';
import SearchFormFallback from '@/components/SearchFormFallback';
import ErrorMessage from '@/components/states/ErrorMessage';
import NoAvailability from '@/components/states/NoAvailability';
import NoCity from '@/components/states/NoCity';
import SearchHint from '@/components/states/SearchHint';
import Unavailable from '@/components/states/Unavailable';
import { createServerClient } from '@/lib/api/client';
import { loadSearch } from '@/lib/load-search';
import styles from './page.module.css';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// The shell does not read searchParams; they are awaited only inside the Suspense boundary, so
// the heading and the loading placeholder are prerendered (plan.md, Cache Components decision).
// The form itself needs the URL's search params, so the shell holds its disabled placeholder
// (SearchFormFallback) until the live form takes over.
export default function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className={styles.page}>
      <h1>Find a hotel</h1>
      <KeyedBySearchParams fallback={<SearchFormFallback />}>
        <SearchForm />
      </KeyedBySearchParams>
      <section className={styles.results} aria-label="Search results">
        {/* Two boundaries on purpose. KeyedBySearchParams has its own Suspense (empty fallback)
            that waits for useSearchParams() while the shell is prerendered, and it keys its
            children so the placeholder shows again when only the search params change; without
            the key React keeps the previous results on screen during the navigation. The inner
            Suspense shows the placeholder (or the hint) while the results load. */}
        <KeyedBySearchParams>
          <Suspense fallback={<ResultsFallback />}>
            <Results searchParams={searchParams} />
          </Suspense>
        </KeyedBySearchParams>
      </section>
    </main>
  );
}

async function Results({ searchParams }: { searchParams: SearchParams }) {
  // Marks the results as request-time work; without it `next dev` reports a
  // blocking-prerender-current-time error for this route.
  await connection();
  const state = await loadSearch(await searchParams, createServerClient());

  switch (state.status) {
    case 'idle':
      return <SearchHint />;
    case 'results':
      return <ResultsList items={state.items} />;
    case 'empty':
      return <NoAvailability />;
    case 'no-city':
      return <NoCity />;
    case 'error':
      return <ErrorMessage errors={state.errors} />;
    case 'unavailable':
      return <Unavailable />;
  }
}
