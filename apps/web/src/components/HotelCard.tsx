import Image from 'next/image';
import type { HotelResult } from '@/lib/load-search';
import { formatPricePerNight } from '@/lib/money';
import styles from './HotelCard.module.css';

const IMAGE_WIDTH = 320;
const IMAGE_HEIGHT = 200;

export default function HotelCard({ hotel }: { hotel: HotelResult }) {
  return (
    <article className={styles.card}>
      <Image
        className={styles.image}
        src={hotel.imageUrl}
        alt={`${hotel.name} exterior`}
        width={IMAGE_WIDTH}
        height={IMAGE_HEIGHT}
      />
      <div className={styles.body}>
        <h3 className={styles.name}>{hotel.name}</h3>
        <p className={styles.stars} role="img" aria-label={`${hotel.starRating} stars`}>
          {'★'.repeat(hotel.starRating)}
        </p>
        <p className={styles.price}>
          {formatPricePerNight(hotel.pricePerNightCents, hotel.currency)} <span>per night</span>
        </p>
      </div>
    </article>
  );
}
