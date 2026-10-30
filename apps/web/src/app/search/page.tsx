import { connection } from 'next/server';
import { Suspense } from 'react';
import KeyedBySearchParams from '@/components/KeyedBySearchParams';
import ResultsList from '@/components/ResultsList';
import SearchForm from '@/components/SearchForm';
import ErrorMessage from '@/components/states/ErrorMessage';
import LoadingResults from '@/components/states/LoadingResults';
import NoAvailability from '@/components/states/NoAvailability';
import NoCity from '@/components/states/NoCity';
import { createServerClient } from '@/lib/api/client';
import { loadSearch } from '@/lib/load-search';
import styles from './page.module.css';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// The shell does not read searchParams; they are awaited only inside the Suspense boundary, so
// the form and the loading placeholder can be prerendered (plan.md, Cache Components decision).
export default function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className={styles.page}>
      <h1>Find a hotel</h1>
      <KeyedBySearchParams>
        <SearchForm />
      </KeyedBySearchParams>
      <section className={styles.results} aria-label="Search results">
        {/* Keyed so the placeholder shows again when only the search params change; without the
            key React keeps the previous results on screen during the navigation. */}
        <KeyedBySearchParams fallback={<LoadingResults />}>
          <Suspense fallback={<LoadingResults />}>
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
      return null;
    case 'results':
      return <ResultsList items={state.items} />;
    case 'empty':
      return <NoAvailability />;
    case 'no-city':
      return <NoCity />;
    case 'error':
      return <ErrorMessage errors={state.errors} />;
  }
}
