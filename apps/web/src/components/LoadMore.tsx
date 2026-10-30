'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import HotelCard from '@/components/HotelCard';
import { createBrowserClient } from '@/lib/api/client';
import { buildSearchQuery, type HotelResult } from '@/lib/load-search';
import type { SearchParamsInput } from '@/lib/search-params';
import styles from './ResultsList.module.css';

type Props = {
  nextCursor: string | null;
  searchParams: Record<string, string | string[] | undefined>;
  // The first page's list items, rendered by the server; the next pages are appended after them.
  children: ReactNode;
};

function serialize(params: SearchParamsInput): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) query.set(name, first);
  }
  return query.toString();
}

// Keyed on the serialized search params and the first page's cursor, so a change of criteria,
// filters or sort, or a re-fetched first page, discards the appended hotels and starts from the
// new first page's cursor. router.bfcacheId is not used: it does not change on search-param-only
// navigations (plan.md, Cache Components decision).
export default function LoadMore(props: Props) {
  const key = `${serialize(props.searchParams)}|${props.nextCursor ?? ''}`;
  return <LoadMoreList key={key} {...props} />;
}

function LoadMoreList({ nextCursor: firstCursor, searchParams, children }: Props) {
  const [items, setItems] = useState<HotelResult[]>([]);
  const [nextCursor, setNextCursor] = useState(firstCursor);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  // The first hotel of the latest batch gets the focus, so keyboard and screen reader users
  // continue from the new results instead of staying on the button.
  const [focusId, setFocusId] = useState<number | null>(null);
  const firstNew = useRef<HTMLLIElement>(null);

  useEffect(() => {
    firstNew.current?.focus();
  }, [focusId]);

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
        setFocusId(data.items[0]?.id ?? null);
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
      <ul className={styles.list}>
        {children}
        {items.map((hotel) => (
          <li key={hotel.id} ref={hotel.id === focusId ? firstNew : undefined} tabIndex={-1}>
            <HotelCard hotel={hotel} />
          </li>
        ))}
      </ul>
      {failed && <p role="alert">More hotels could not be loaded. Please try again.</p>}
      {nextCursor !== null && (
        <button type="button" onClick={loadMore} disabled={pending}>
          {pending ? 'Loading…' : 'Load more'}
        </button>
      )}
    </>
  );
}
