'use client';

import type { SearchCriteria } from '@/lib/search-params';
import styles from './SearchForm.module.css';

type Props = {
  values: SearchCriteria;
  onChange?: (field: keyof SearchCriteria, value: string) => void;
  disabled?: boolean;
};

// The four search inputs, shared by the live form and its disabled placeholder so both lay out
// identically.
export default function SearchFields({ values, onChange, disabled = false }: Props) {
  const common = { disabled };
  return (
    <>
      <label className={styles.field}>
        City
        <input
          name="city"
          type="text"
          value={values.city}
          onChange={(e) => onChange?.('city', e.target.value)}
          {...common}
        />
      </label>
      <label className={styles.field}>
        Check-in
        <input
          name="checkIn"
          type="date"
          value={values.checkIn}
          onChange={(e) => onChange?.('checkIn', e.target.value)}
          {...common}
        />
      </label>
      <label className={styles.field}>
        Check-out
        <input
          name="checkOut"
          type="date"
          value={values.checkOut}
          onChange={(e) => onChange?.('checkOut', e.target.value)}
          {...common}
        />
      </label>
      <label className={styles.field}>
        Guests
        <input
          name="guests"
          type="text"
          inputMode="numeric"
          value={values.guests}
          onChange={(e) => onChange?.('guests', e.target.value)}
          {...common}
        />
      </label>
    </>
  );
}
