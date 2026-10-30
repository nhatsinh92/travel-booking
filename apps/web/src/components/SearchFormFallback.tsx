import SearchFields from '@/components/SearchFields';
import styles from './SearchForm.module.css';

const EMPTY = { city: '', checkIn: '', checkOut: '', guests: '' };

// Prerendered in place of SearchForm until the URL's search params are known, so the page shell
// already contains the form's layout.
export default function SearchFormFallback() {
  return (
    <form className={styles.form} aria-busy="true">
      <SearchFields values={EMPTY} disabled />
      <button type="submit" className={styles.submit} disabled>
        Search
      </button>
    </form>
  );
}
