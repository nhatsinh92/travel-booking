'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  hasSearch,
  parseSearchFilters,
  updateFilters,
  type SearchFilters,
} from '@/lib/search-params';
import styles from './FilterBar.module.css';

const SORT_OPTIONS = [
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'stars_desc', label: 'Stars: high to low' },
  { value: 'stars_asc', label: 'Stars: low to high' },
];

const STAR_OPTIONS = [1, 2, 3, 4, 5];

// Values come from the URL. The parent renders this inside KeyedBySearchParams, which remounts it
// when the search params change, so no previously typed or chosen value survives. Prices are
// applied on Enter or the Apply button (not on blur: that would navigate, and remount the bar,
// when the user tabs from the minimum to the maximum field), the selects as soon as they change.
export default function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = parseSearchFilters(searchParams);
  const [minPrice, setMinPrice] = useState(initial.minPrice);
  const [maxPrice, setMaxPrice] = useState(initial.maxPrice);
  // What the bar has asked for so far. The URL (searchParams) lags behind until the navigation
  // finishes, so a second change made meanwhile must build on this, not on the old URL.
  const [applied, setApplied] = useState(initial);

  // Filters need a search to apply to.
  if (!hasSearch(searchParams)) return null;

  // Every change also applies the prices typed so far, so a select change does not lose them.
  function apply(changes: Partial<SearchFilters> = {}) {
    const next = { ...applied, minPrice, maxPrice, ...changes };
    setApplied(next);
    router.push(updateFilters(searchParams, next));
  }

  function applyPrices() {
    if (minPrice === applied.minPrice && maxPrice === applied.maxPrice) return;
    apply();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyPrices();
  }

  return (
    <form className={styles.bar} aria-label="Filter and sort" onSubmit={submit} noValidate>
      <label className={styles.field}>
        Minimum price ($)
        <input
          name="minPrice"
          type="text"
          inputMode="decimal"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        Maximum price ($)
        <input
          name="maxPrice"
          type="text"
          inputMode="decimal"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
        />
      </label>
      <button type="submit" className={styles.apply}>
        Apply price
      </button>
      <label className={styles.field}>
        Minimum stars
        <select
          name="minStars"
          value={applied.minStars}
          onChange={(e) => apply({ minStars: e.target.value })}
        >
          <option value="">Any</option>
          {STAR_OPTIONS.map((stars) => (
            <option key={stars} value={stars}>
              {stars}+ stars
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        Sort by
        <select
          name="sort"
          value={applied.sort}
          onChange={(e) => apply({ sort: e.target.value })}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
