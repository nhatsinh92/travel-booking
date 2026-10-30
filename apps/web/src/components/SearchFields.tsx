'use client';

import { errorItemId } from '@/components/states/ErrorMessage';
import type { FieldError } from '@/lib/error-messages';
import type { SearchCriteria } from '@/lib/search-params';
import styles from './SearchForm.module.css';

type Props = {
  values: SearchCriteria;
  onChange?: (field: keyof SearchCriteria, value: string) => void;
  disabled?: boolean;
  // Validation errors to show on the inputs they name, and the id prefix of their messages.
  errors?: FieldError[];
  errorIdPrefix?: string;
};

// The four search inputs, shared by the live form and its disabled placeholder so both lay out
// identically.
export default function SearchFields({
  values,
  onChange,
  disabled = false,
  errors = [],
  errorIdPrefix = '',
}: Props) {
  // aria-invalid and aria-describedby for the input that carries an error, nothing for the others.
  function describe(name: keyof SearchCriteria) {
    const own = errors.filter((error) => error.field === name);
    if (own.length === 0) return { disabled };
    return {
      disabled,
      'aria-invalid': true,
      'aria-describedby': own.map((error) => errorItemId(errorIdPrefix, error)).join(' '),
    };
  }
  return (
    <>
      <label className={styles.field}>
        City
        <input
          name="city"
          type="text"
          value={values.city}
          onChange={(e) => onChange?.('city', e.target.value)}
          {...describe('city')}
        />
      </label>
      <label className={styles.field}>
        Check-in
        <input
          name="checkIn"
          type="date"
          value={values.checkIn}
          onChange={(e) => onChange?.('checkIn', e.target.value)}
          {...describe('checkIn')}
        />
      </label>
      <label className={styles.field}>
        Check-out
        <input
          name="checkOut"
          type="date"
          value={values.checkOut}
          onChange={(e) => onChange?.('checkOut', e.target.value)}
          {...describe('checkOut')}
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
          {...describe('guests')}
        />
      </label>
    </>
  );
}
