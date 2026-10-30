'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { hasSearch, parseSearchFilters, updateFilters } from '@/lib/search-params';
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
  const [minStars, setMinStars] = useState(initial.minStars);
  const [sort, setSort] = useState(initial.sort);

  // Filters need a search to apply to.
  if (!hasSearch(searchParams)) return null;

  function applyPrices() {
    if (minPrice === initial.minPrice && maxPrice === initial.maxPrice) return;
    router.push(updateFilters(searchParams, { minPrice, maxPrice }));
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
          value={minStars}
          onChange={(e) => {
            setMinStars(e.target.value);
            router.push(updateFilters(searchParams, { minStars: e.target.value }));
          }}
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
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            router.push(updateFilters(searchParams, { sort: e.target.value }));
          }}
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
