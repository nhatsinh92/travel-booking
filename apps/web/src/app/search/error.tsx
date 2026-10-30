'use client';

import { useEffect } from 'react';

// Last-resort fallback for failures that loadSearch does not turn into a state.
export default function SearchError({ error, retry }: { error: Error; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main>
      <p role="alert">Something went wrong with the search. Please try again.</p>
      <button type="button" onClick={() => retry()}>
        Try again
      </button>
    </main>
  );
}
