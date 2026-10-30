import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoadMore from '@/components/LoadMore';

const GET = vi.fn();
vi.mock('@/lib/api/client', () => ({
  createBrowserClient: () => ({ GET }),
}));

const hotel = (id: number) => ({
  id,
  name: `Hotel ${id}`,
  starRating: 3,
  pricePerNightCents: 9000,
  currency: 'USD',
  imageUrl: '/images/hotels/hotel-01.png',
});

const page = (ids: number[], nextCursor: string | null) => ({
  data: { items: ids.map(hotel), nextCursor },
  response: new Response(null, { status: 200 }),
});

// The first page, rendered by the server in the real page and passed in as children.
const first = <li>First hotel</li>;

const searchParams = {
  city: 'Hanoi',
  checkIn: '2026-12-01',
  checkOut: '2026-12-03',
  guests: '2',
  minPrice: '10000',
  minStars: '3',
  sort: 'stars_desc',
};

beforeEach(() => {
  GET.mockReset();
});

describe('LoadMore', () => {
  it('shows a Load more button while there is a next page (US2-AS4)', () => {
    render(<LoadMore nextCursor="c1" searchParams={searchParams}>{first}</LoadMore>);
    expect(screen.getByRole('button', { name: 'Load more' })).toBeEnabled();
  });

  it('shows the first page but no button when there is no next cursor', () => {
    render(<LoadMore nextCursor={null} searchParams={searchParams}>{first}</LoadMore>);
    expect(screen.getByText('First hotel')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('appends the new hotels to the same list as the first page', async () => {
    GET.mockResolvedValue(page([21, 22], null));
    render(<LoadMore nextCursor="c1" searchParams={searchParams}>{first}</LoadMore>);

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await screen.findByRole('heading', { name: 'Hotel 22' });

    expect(screen.getAllByRole('list')).toHaveLength(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('moves focus to the first newly loaded hotel (keyboard and screen reader users)', async () => {
    GET.mockResolvedValueOnce(page([21, 22], 'c2')).mockResolvedValueOnce(page([23], null));
    render(<LoadMore nextCursor="c1" searchParams={searchParams}>{first}</LoadMore>);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    const firstNew = (await screen.findByRole('heading', { name: 'Hotel 21' })).closest('li');
    expect(firstNew).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    const secondBatch = (await screen.findByRole('heading', { name: 'Hotel 23' })).closest('li');
    expect(secondBatch).toHaveFocus();
  });

  it('asks the API for the next page with the same criteria, filters and sort (US2-AS4, FR-011)', async () => {
    GET.mockResolvedValue(page([21], null));
    render(<LoadMore nextCursor="c1" searchParams={searchParams}>{first}</LoadMore>);

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(GET).toHaveBeenCalledWith('/api/v1/hotels/search', {
      params: {
        query: {
          city: 'Hanoi',
          checkIn: '2026-12-01',
          checkOut: '2026-12-03',
          guests: 2,
          minPrice: 10000,
          minStars: 3,
          sort: 'stars_desc',
          cursor: 'c1',
        },
      },
    });
  });

  it('appends the hotels, uses the new cursor next, and hides itself on the last page (US2-AS4)', async () => {
    GET.mockResolvedValueOnce(page([21, 22], 'c2')).mockResolvedValueOnce(page([23], null));
    render(<LoadMore nextCursor="c1" searchParams={searchParams}>{first}</LoadMore>);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('heading', { name: 'Hotel 22' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('heading', { name: 'Hotel 23' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(GET.mock.calls[1][1].params.query.cursor).toBe('c2');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('reads "Loading…" and is disabled while the request is pending, then recovers (FR-016)', async () => {
    let resolve: (value: ReturnType<typeof page>) => void = () => {};
    GET.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<LoadMore nextCursor="c1" searchParams={searchParams}>{first}</LoadMore>);

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    const pending = screen.getByRole('button', { name: 'Loading…' });
    expect(pending).toBeDisabled();

    resolve(page([21], 'c2'));

    expect(await screen.findByRole('button', { name: 'Load more' })).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'Hotel 21' })).toBeInTheDocument();
  });

  it('shows a message and lets the user retry when the request fails', async () => {
    GET.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(page([21], null));
    render(<LoadMore nextCursor="c1" searchParams={searchParams}>{first}</LoadMore>);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/i);
    expect(screen.getByRole('button', { name: 'Load more' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('heading', { name: 'Hotel 21' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('shows the same message for an error response', async () => {
    GET.mockResolvedValue({ error: { status: 500 }, response: new Response(null, { status: 500 }) });
    render(<LoadMore nextCursor="c1" searchParams={searchParams}>{first}</LoadMore>);

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/i);
  });

  it('discards the appended hotels and uses the new cursor when the search params change (US2-AS5)', async () => {
    GET.mockResolvedValueOnce(page([21], 'c2')).mockResolvedValueOnce(page([31], null));
    const { rerender } = render(<LoadMore nextCursor="c1" searchParams={searchParams}>{first}</LoadMore>);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('heading', { name: 'Hotel 21' })).toBeInTheDocument();

    rerender(<LoadMore nextCursor="n1" searchParams={{ ...searchParams, sort: 'price_desc' }}>{first}</LoadMore>);

    expect(screen.queryByRole('heading', { name: 'Hotel 21' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(GET.mock.calls[1][1].params.query).toMatchObject({ cursor: 'n1', sort: 'price_desc' });
    expect(await screen.findByRole('heading', { name: 'Hotel 31' })).toBeInTheDocument();
  });

  it('also starts over when the same search is re-rendered with a new first-page cursor', async () => {
    GET.mockResolvedValueOnce(page([21], 'c2')).mockResolvedValueOnce(page([41], null));
    const { rerender } = render(<LoadMore nextCursor="c1" searchParams={searchParams}>{first}</LoadMore>);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('heading', { name: 'Hotel 21' })).toBeInTheDocument();

    rerender(<LoadMore nextCursor="n1" searchParams={searchParams}>{first}</LoadMore>);

    expect(screen.queryByRole('heading', { name: 'Hotel 21' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(GET.mock.calls[1][1].params.query.cursor).toBe('n1');
  });
});
