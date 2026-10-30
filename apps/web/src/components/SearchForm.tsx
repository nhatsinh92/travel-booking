'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import ErrorMessage from '@/components/states/ErrorMessage';
import type { FieldError } from '@/lib/error-messages';
import { buildSearchUrl, parseSearchCriteria, type SearchCriteria } from '@/lib/search-params';
import { validateCriteria } from '@/lib/validate-criteria';
import styles from './SearchForm.module.css';

// Initial values come from the URL. The parent renders this inside KeyedBySearchParams, which
// remounts it when the search params change, so no previously typed state survives.
export default function SearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [values, setValues] = useState<SearchCriteria>(() => parseSearchCriteria(searchParams));
  const [errors, setErrors] = useState<FieldError[]>([]);

  function update(field: keyof SearchCriteria, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateCriteria(values);
    setErrors(found);
    if (found.length === 0) router.push(buildSearchUrl(values));
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <label className={styles.field}>
        City
        <input
          name="city"
          type="text"
          value={values.city}
          onChange={(e) => update('city', e.target.value)}
        />
      </label>
      <label className={styles.field}>
        Check-in
        <input
          name="checkIn"
          type="date"
          value={values.checkIn}
          onChange={(e) => update('checkIn', e.target.value)}
        />
      </label>
      <label className={styles.field}>
        Check-out
        <input
          name="checkOut"
          type="date"
          value={values.checkOut}
          onChange={(e) => update('checkOut', e.target.value)}
        />
      </label>
      <label className={styles.field}>
        Guests
        <input
          name="guests"
          type="text"
          inputMode="numeric"
          value={values.guests}
          onChange={(e) => update('guests', e.target.value)}
        />
      </label>
      <button type="submit" className={styles.submit}>
        Search
      </button>
      {errors.length > 0 && <ErrorMessage errors={errors} />}
    </form>
  );
}
