import ResultsList from '@/components/ResultsList';
import ErrorMessage from '@/components/states/ErrorMessage';
import NoAvailability from '@/components/states/NoAvailability';
import NoCity from '@/components/states/NoCity';
import NoFilterMatch from '@/components/states/NoFilterMatch';
import SearchHint from '@/components/states/SearchHint';
import Unavailable from '@/components/states/Unavailable';
import type { SearchState } from '@/lib/load-search';

type Props = {
  state: SearchState;
  // The URL's search params, for LoadMore to repeat the search with the same filters and sort.
  searchParams: Record<string, string | string[] | undefined>;
};

export default function ResultsView({ state, searchParams }: Props) {
  switch (state.status) {
    case 'idle':
      return <SearchHint />;
    case 'results':
      return (
        <ResultsList items={state.items} nextCursor={state.nextCursor} searchParams={searchParams} />
      );
    case 'empty':
      return <NoAvailability />;
    case 'no-filter-match':
      return <NoFilterMatch />;
    case 'no-city':
      return <NoCity />;
    case 'error':
      return <ErrorMessage errors={state.errors} />;
    case 'unavailable':
      return <Unavailable />;
  }
}
