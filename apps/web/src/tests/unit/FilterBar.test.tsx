import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FilterBar from '@/components/FilterBar';
import KeyedBySearchParams from '@/components/KeyedBySearchParams';

const push = vi.fn();
const useSearchParams = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => useSearchParams(),
}));

const CRITERIA = 'city=Hanoi&checkIn=2026-12-01&checkOut=2026-12-03&guests=2';

function pushedQuery(): Record<string, string> {
  expect(push).toHaveBeenCalledTimes(1);
  const url: string = push.mock.calls[0][0];
  expect(url.startsWith('/search?')).toBe(true);
  return Object.fromEntries(new URLSearchParams(url.slice('/search?'.length)));
}

beforeEach(() => {
  push.mockReset();
  useSearchParams.mockReset();
  useSearchParams.mockReturnValue(new URLSearchParams(CRITERIA));
});

describe('FilterBar', () => {
  it('starts with no filters and the default sort when the URL has none', () => {
    render(<FilterBar />);
    expect(screen.getByLabelText('Minimum price ($)')).toHaveValue('');
    expect(screen.getByLabelText('Maximum price ($)')).toHaveValue('');
    expect(screen.getByLabelText('Minimum stars')).toHaveValue('');
    expect(screen.getByLabelText('Sort by')).toHaveValue('price_asc');
  });

  it('shows the filters and the sort of the URL, prices in dollars', () => {
    useSearchParams.mockReturnValue(
      new URLSearchParams(`${CRITERIA}&minPrice=10000&maxPrice=25050&minStars=3&sort=stars_desc`),
    );
    render(<FilterBar />);
    expect(screen.getByLabelText('Minimum price ($)')).toHaveValue('100');
    expect(screen.getByLabelText('Maximum price ($)')).toHaveValue('250.50');
    expect(screen.getByLabelText('Minimum stars')).toHaveValue('3');
    expect(screen.getByLabelText('Sort by')).toHaveValue('stars_desc');
  });

  it('renders nothing when there is no search yet', () => {
    useSearchParams.mockReturnValue(new URLSearchParams(''));
    const { container } = render(<FilterBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it('puts the price range in the URL in cents, keeping the criteria (US2-AS1)', async () => {
    render(<FilterBar />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Minimum price ($)'), '100');
    await user.type(screen.getByLabelText('Maximum price ($)'), '250.5');
    await user.keyboard('{Enter}');

    expect(pushedQuery()).toEqual({
      city: 'Hanoi',
      checkIn: '2026-12-01',
      checkOut: '2026-12-03',
      guests: '2',
      minPrice: '10000',
      maxPrice: '25050',
    });
  });

  it('applies the typed prices when the Apply price button is clicked', async () => {
    render(<FilterBar />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Maximum price ($)'), '300');
    await user.click(screen.getByRole('button', { name: 'Apply price' }));

    expect(pushedQuery().maxPrice).toBe('30000');
  });

  it('does not navigate while the user tabs between the price fields', async () => {
    render(<FilterBar />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Minimum price ($)'), '100');
    await user.tab();
    await user.type(screen.getByLabelText('Maximum price ($)'), '300');

    expect(push).not.toHaveBeenCalled();
  });

  it('does not touch the URL when the prices are applied unchanged', async () => {
    useSearchParams.mockReturnValue(new URLSearchParams(`${CRITERIA}&minPrice=10000`));
    render(<FilterBar />);
    await userEvent.click(screen.getByRole('button', { name: 'Apply price' }));

    expect(push).not.toHaveBeenCalled();
  });

  it('puts the minimum stars in the URL as soon as it is chosen (US2-AS2)', async () => {
    render(<FilterBar />);
    await userEvent.selectOptions(screen.getByLabelText('Minimum stars'), '4');

    expect(pushedQuery()).toMatchObject({ city: 'Hanoi', minStars: '4' });
  });

  it.each([
    ['price_desc', 'Price: high to low'],
    ['stars_desc', 'Stars: high to low'],
    ['stars_asc', 'Stars: low to high'],
  ])('puts the sort %s in the URL as soon as it is chosen (US2-AS3)', async (sort, label) => {
    render(<FilterBar />);
    await userEvent.selectOptions(screen.getByLabelText('Sort by'), label);

    expect(pushedQuery()).toMatchObject({ city: 'Hanoi', guests: '2', sort });
  });

  it('takes the sort out of the URL when the default is chosen again', async () => {
    useSearchParams.mockReturnValue(new URLSearchParams(`${CRITERIA}&sort=stars_desc`));
    render(<FilterBar />);
    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'Price: low to high');

    expect(pushedQuery()).not.toHaveProperty('sort');
  });

  it('keeps the other filters and the sort when one control changes', async () => {
    useSearchParams.mockReturnValue(
      new URLSearchParams(`${CRITERIA}&minPrice=10000&minStars=3&sort=price_desc`),
    );
    render(<FilterBar />);
    await userEvent.selectOptions(screen.getByLabelText('Minimum stars'), '5');

    expect(pushedQuery()).toMatchObject({ minPrice: '10000', minStars: '5', sort: 'price_desc' });
  });

  it('removes the stars filter when "Any" is chosen', async () => {
    useSearchParams.mockReturnValue(new URLSearchParams(`${CRITERIA}&minStars=3`));
    render(<FilterBar />);
    await userEvent.selectOptions(screen.getByLabelText('Minimum stars'), 'Any');

    expect(pushedQuery()).not.toHaveProperty('minStars');
  });
});

describe('FilterBar under KeyedBySearchParams (US2-AS5)', () => {
  function renderKeyed() {
    const ui = () => (
      <KeyedBySearchParams>
        <FilterBar />
      </KeyedBySearchParams>
    );
    const result = render(ui());
    return () => result.rerender(ui());
  }

  it('clears the price, stars and sort controls when the new search params carry no filters', () => {
    useSearchParams.mockReturnValue(
      new URLSearchParams(`${CRITERIA}&minPrice=10000&maxPrice=25050&minStars=3&sort=stars_desc`),
    );
    const rerenderKeyed = renderKeyed();
    expect(screen.getByLabelText('Minimum price ($)')).toHaveValue('100');

    useSearchParams.mockReturnValue(new URLSearchParams(CRITERIA.replace('Hanoi', 'Bangkok')));
    rerenderKeyed();

    expect(screen.getByLabelText('Minimum price ($)')).toHaveValue('');
    expect(screen.getByLabelText('Maximum price ($)')).toHaveValue('');
    expect(screen.getByLabelText('Minimum stars')).toHaveValue('');
    expect(screen.getByLabelText('Sort by')).toHaveValue('price_asc');
  });

  it('discards text typed before the params changed and shows the filters of the new params', async () => {
    const rerenderKeyed = renderKeyed();
    await userEvent.type(screen.getByLabelText('Minimum price ($)'), '77');

    useSearchParams.mockReturnValue(new URLSearchParams(`${CRITERIA}&minStars=2&sort=price_desc`));
    rerenderKeyed();

    expect(screen.getByLabelText('Minimum price ($)')).toHaveValue('');
    expect(screen.getByLabelText('Minimum stars')).toHaveValue('2');
    expect(screen.getByLabelText('Sort by')).toHaveValue('price_desc');
  });
});
