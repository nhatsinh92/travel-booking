import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ResultsView from '@/components/ResultsView';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('city=Hanoi&minStars=5'),
}));
vi.mock('@/lib/api/client', () => ({ createBrowserClient: () => ({ GET: vi.fn() }) }));

const hotel = (id: number) => ({
  id,
  name: `Hotel ${id}`,
  starRating: 3,
  pricePerNightCents: 9000,
  currency: 'USD',
  imageUrl: '/images/hotels/hotel-01.png',
});

describe('ResultsView', () => {
  it('shows the hint for idle', () => {
    render(<ResultsView state={{ status: 'idle' }} />);
    expect(screen.getByText(/enter a city/i)).toBeInTheDocument();
  });

  it('shows one card per hotel for results (US1-AS1)', () => {
    render(<ResultsView state={{ status: 'results', items: [hotel(1), hotel(2)], nextCursor: null }} />);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Hotel 2' })).toBeInTheDocument();
  });

  it('suggests different dates or fewer guests for empty (EC5)', () => {
    render(<ResultsView state={{ status: 'empty' }} />);
    expect(screen.getByText(/different dates/i)).toBeInTheDocument();
  });

  it('shows the no-matching-city message for no-city (EC4)', () => {
    render(<ResultsView state={{ status: 'no-city' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no matching city/i);
  });

  it('shows each validation message for error (EC1, EC2, EC3, EC7, EC9)', () => {
    render(
      <ResultsView
        state={{
          status: 'error',
          errors: [
            { field: 'checkIn', code: 'CHECK_IN_IN_PAST', meta: {} },
            { field: 'guests', code: 'GUESTS_OUT_OF_RANGE', meta: { min: 1, max: 10 } },
          ],
        }}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('alert')).toHaveTextContent(/today or later/i);
  });

  it('tells the user to try again for unavailable (EC10, FR-017)', () => {
    render(<ResultsView state={{ status: 'unavailable' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/unavailable/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/try again/i);
  });

  it('shows the clear-filters state for no-filter-match (EC6, FR-009)', () => {
    render(<ResultsView state={{ status: 'no-filter-match' }} />);
    expect(screen.getByText(/no hotels match these filters/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('offers Load more under the first page when there is a next cursor (US2-AS4)', () => {
    render(
      <ResultsView
        state={{ status: 'results', items: [hotel(1)], nextCursor: 'c1' }}
        searchParams={{ city: 'Hanoi' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();
  });

  it('offers no Load more on the last page (US2-AS4)', () => {
    render(
      <ResultsView
        state={{ status: 'results', items: [hotel(1)], nextCursor: null }}
        searchParams={{ city: 'Hanoi' }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });
});
