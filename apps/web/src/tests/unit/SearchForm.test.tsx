import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import KeyedBySearchParams from '@/components/KeyedBySearchParams';
import SearchForm from '@/components/SearchForm';

const push = vi.fn();
const useSearchParams = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => useSearchParams(),
}));

type Values = { city?: string; checkIn?: string; checkOut?: string; guests?: string };

const LABELS: Record<keyof Values, string> = {
  city: 'City',
  checkIn: 'Check-in',
  checkOut: 'Check-out',
  guests: 'Guests',
};

async function fill(values: Values) {
  const user = userEvent.setup();
  for (const [field, value] of Object.entries(values) as [keyof Values, string][]) {
    await user.type(screen.getByLabelText(LABELS[field]), value);
  }
  return user;
}

const valid = { city: 'Hanoi', checkIn: '2026-12-01', checkOut: '2026-12-03', guests: '2' };

beforeEach(() => {
  push.mockReset();
  useSearchParams.mockReset();
  useSearchParams.mockReturnValue(new URLSearchParams(''));
});

describe('SearchForm', () => {
  it('starts with empty fields when the URL has no search', () => {
    render(<SearchForm />);
    expect(screen.getByLabelText('City')).toHaveValue('');
    expect(screen.getByLabelText('Guests')).toHaveValue('');
  });

  it('reads its initial values from the URL', () => {
    useSearchParams.mockReturnValue(
      new URLSearchParams('city=Hanoi&checkIn=2026-12-01&checkOut=2026-12-03&guests=2'),
    );
    render(<SearchForm />);
    expect(screen.getByLabelText('City')).toHaveValue('Hanoi');
    expect(screen.getByLabelText('Check-in')).toHaveValue('2026-12-01');
    expect(screen.getByLabelText('Check-out')).toHaveValue('2026-12-03');
    expect(screen.getByLabelText('Guests')).toHaveValue('2');
  });

  it('pushes the criteria to the URL on a valid submit (US1-AS2)', async () => {
    render(<SearchForm />);
    const user = await fill(valid);
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(
      '/search?city=Hanoi&checkIn=2026-12-01&checkOut=2026-12-03&guests=2',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('drops the filters and the sort of the current URL when a new search is submitted (US2-AS5)', async () => {
    useSearchParams.mockReturnValue(
      new URLSearchParams(
        'city=Hanoi&checkIn=2026-12-01&checkOut=2026-12-03&guests=2&minPrice=10000&minStars=3&sort=stars_desc',
      ),
    );
    render(<SearchForm />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('City'));
    await user.type(screen.getByLabelText('City'), 'Bangkok');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(push).toHaveBeenCalledWith(
      '/search?city=Bangkok&checkIn=2026-12-01&checkOut=2026-12-03&guests=2',
    );
  });

  it('does not search and names every empty field (EC7, FR-012)', async () => {
    render(<SearchForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(push).not.toHaveBeenCalled();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/city/i);
    expect(alert).toHaveTextContent(/check-in/i);
    expect(alert).toHaveTextContent(/check-out/i);
    expect(alert).toHaveTextContent(/guests/i);
  });

  it('does not search when check-out is not after check-in (EC1)', async () => {
    render(<SearchForm />);
    const user = await fill({ ...valid, checkIn: '2026-12-03' });
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/date range is invalid/i);
  });

  it('clears an earlier error once a valid search is submitted', async () => {
    render(<SearchForm />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await fill(valid);
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('leaves a past check-in and a guest count outside the range to the server', async () => {
    render(<SearchForm />);
    const user = await fill({
      city: 'Hanoi',
      checkIn: '2000-01-01',
      checkOut: '2000-01-03',
      guests: '99',
    });
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(push).toHaveBeenCalledWith(
      '/search?city=Hanoi&checkIn=2000-01-01&checkOut=2000-01-03&guests=99',
    );
  });

  it('lets a non-numeric guest count through so the server names the field (EC9)', async () => {
    render(<SearchForm />);
    const user = await fill({ ...valid, guests: 'abc' });
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(push).toHaveBeenCalledWith(expect.stringContaining('guests=abc'));
  });
});

describe('SearchForm under KeyedBySearchParams', () => {
  function renderKeyed() {
    const ui = () => (
      <KeyedBySearchParams>
        <SearchForm />
      </KeyedBySearchParams>
    );
    const result = render(ui());
    return () => result.rerender(ui());
  }

  it('shows the new URL values and none of the typed state when the params change', async () => {
    useSearchParams.mockReturnValue(new URLSearchParams('city=Hanoi&guests=2'));
    const rerenderKeyed = renderKeyed();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('City'), ' typed');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    useSearchParams.mockReturnValue(new URLSearchParams('city=Bangkok&guests=4'));
    rerenderKeyed();

    expect(screen.getByLabelText('City')).toHaveValue('Bangkok');
    expect(screen.getByLabelText('Guests')).toHaveValue('4');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('empties the fields when the search params are cleared', () => {
    useSearchParams.mockReturnValue(new URLSearchParams('city=Hanoi'));
    const rerenderKeyed = renderKeyed();

    useSearchParams.mockReturnValue(new URLSearchParams(''));
    rerenderKeyed();

    expect(screen.getByLabelText('City')).toHaveValue('');
  });
});
