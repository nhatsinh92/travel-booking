import HotelCard from '@/components/HotelCard';
import LoadMore from '@/components/LoadMore';
import type { HotelResult } from '@/lib/load-search';
import styles from './ResultsList.module.css';

type Props = {
  items: HotelResult[];
  nextCursor: string | null;
  searchParams: Record<string, string | string[] | undefined>;
};

export default function ResultsList({ items, nextCursor, searchParams }: Props) {
  return (
    <div className={styles.results}>
      <LoadMore nextCursor={nextCursor} searchParams={searchParams}>
        {items.map((hotel) => (
          <li key={hotel.id}>
            <HotelCard hotel={hotel} />
          </li>
        ))}
      </LoadMore>
    </div>
  );
}
