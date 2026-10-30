import ResultsList from '@/components/ResultsList';
import ErrorMessage from '@/components/states/ErrorMessage';
import NoAvailability from '@/components/states/NoAvailability';
import NoCity from '@/components/states/NoCity';
import SearchHint from '@/components/states/SearchHint';
import Unavailable from '@/components/states/Unavailable';
import type { SearchState } from '@/lib/load-search';

export default function ResultsView({ state }: { state: SearchState }) {
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
