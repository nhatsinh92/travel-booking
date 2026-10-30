'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import SearchFields from '@/components/SearchFields';
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
      <SearchFields values={values} onChange={update} />
      <button type="submit" className={styles.submit}>
        Search
      </button>
      {errors.length > 0 && <ErrorMessage errors={errors} />}
    </form>
  );
}
