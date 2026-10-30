import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HotelCard from '@/components/HotelCard';

const hotel = {
  id: 7,
  name: 'Grand Hanoi',
  starRating: 4,
  pricePerNightCents: 12550,
  currency: 'USD',
  imageUrl: '/images/hotels/hotel-03.png',
};

describe('HotelCard', () => {
  it('shows the hotel name', () => {
    render(<HotelCard hotel={hotel} />);
    expect(screen.getByRole('heading', { name: 'Grand Hanoi' })).toBeInTheDocument();
  });

  it('shows the star rating', () => {
    render(<HotelCard hotel={hotel} />);
    expect(screen.getByRole('img', { name: '4 stars' })).toBeInTheDocument();
  });

  it.each([1, 3, 5])('shows %i stars', (starRating) => {
    render(<HotelCard hotel={{ ...hotel, starRating }} />);
    expect(screen.getByRole('img', { name: `${starRating} stars` })).toBeInTheDocument();
  });

  it('shows the price per night in dollars', () => {
    render(<HotelCard hotel={hotel} />);
    expect(screen.getByText(/\$125\.50/)).toBeInTheDocument();
    expect(screen.getByText(/per night/i)).toBeInTheDocument();
  });

  it('shows the hotel image with a text alternative that names the hotel', () => {
    render(<HotelCard hotel={hotel} />);
    const image = screen.getByAltText(/Grand Hanoi/);
    expect(image).toBeInTheDocument();
    expect(decodeURIComponent(image.getAttribute('src') ?? '')).toContain(
      '/images/hotels/hotel-03.png',
    );
  });
});
