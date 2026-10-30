'use client';

import { useState } from 'react';
import HotelCard from '@/components/HotelCard';
import { createBrowserClient } from '@/lib/api/client';
import { buildSearchQuery, type HotelResult } from '@/lib/load-search';
import type { SearchParamsInput } from '@/lib/search-params';
import styles from './ResultsList.module.css';

type Props = {
  nextCursor: string | null;
  searchParams: Record<string, string | string[] | undefined>;
};

function serialize(params: SearchParamsInput): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) query.set(name, first);
  }
  return query.toString();
}

// Keyed on the serialized search params, so a change of criteria, filters or sort discards the
// appended hotels and starts from the new first page's cursor. router.bfcacheId is not used: it
// does not change on search-param-only navigations (plan.md, Cache Components decision).
export default function LoadMore(props: Props) {
  return <LoadMoreList key={serialize(props.searchParams)} {...props} />;
}

function LoadMoreList({ nextCursor: firstCursor, searchParams }: Props) {
  const [items, setItems] = useState<HotelResult[]>([]);
  const [nextCursor, setNextCursor] = useState(firstCursor);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMore() {
    if (nextCursor === null) return;
    setPending(true);
    setFailed(false);
    try {
      const { data } = await createBrowserClient().GET('/api/v1/hotels/search', {
        params: { query: buildSearchQuery(searchParams, nextCursor) },
      });
      if (data) {
        setItems((current) => [...current, ...data.items]);
        setNextCursor(data.nextCursor);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {items.length > 0 && (
        <ul className={styles.list}>
          {items.map((hotel) => (
            <li key={hotel.id}>
              <HotelCard hotel={hotel} />
            </li>
          ))}
        </ul>
      )}
      {failed && <p role="alert">More hotels could not be loaded. Please try again.</p>}
      {nextCursor !== null && (
        <button type="button" onClick={loadMore} disabled={pending}>
          {pending ? 'Loading…' : 'Load more'}
        </button>
      )}
    </>
  );
}
