import HotelCard from '@/components/HotelCard';
import type { HotelResult } from '@/lib/load-search';
import styles from './ResultsList.module.css';

export default function ResultsList({ items }: { items: HotelResult[] }) {
  return (
    <ul className={styles.list}>
      {items.map((hotel) => (
        <li key={hotel.id}>
          <HotelCard hotel={hotel} />
        </li>
      ))}
    </ul>
  );
}
