import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ErrorMessage from '@/components/states/ErrorMessage';
import LoadingResults from '@/components/states/LoadingResults';
import NoAvailability from '@/components/states/NoAvailability';
import NoCity from '@/components/states/NoCity';
import Unavailable from '@/components/states/Unavailable';

describe('ErrorMessage', () => {
  it('shows the message for an invalid date range (EC1)', () => {
    render(<ErrorMessage errors={[{ field: 'checkOut', code: 'INVALID_DATE_RANGE', meta: {} }]} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/date range is invalid/i);
  });

  it('shows the message for a check-in in the past (EC2)', () => {
    render(<ErrorMessage errors={[{ field: 'checkIn', code: 'CHECK_IN_IN_PAST', meta: {} }]} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/today or later/i);
  });

  it('shows the allowed guest range (EC3)', () => {
    render(
      <ErrorMessage
        errors={[{ field: 'guests', code: 'GUESTS_OUT_OF_RANGE', meta: { min: 1, max: 10 } }]}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/between 1 and 10/);
  });

  it('names each missing field (EC7)', () => {
    render(
      <ErrorMessage
        errors={[
          { field: 'city', code: 'REQUIRED', meta: {} },
          { field: 'checkIn', code: 'REQUIRED', meta: {} },
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(/city/i);
    expect(items[1]).toHaveTextContent(/check-in/i);
  });

  it('names the field that is in the wrong format', () => {
    render(<ErrorMessage errors={[{ field: 'guests', code: 'INVALID_VALUE', meta: {} }]} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/guests.*wrong format/i);
  });
});

describe('NoCity (EC4, FR-006)', () => {
  it('says there is no matching city and asks to check the spelling', () => {
    render(<NoCity />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no matching city/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/spelling/i);
  });
});

describe('NoAvailability (EC5, FR-007)', () => {
  it('suggests different dates or a smaller number of guests', () => {
    render(<NoAvailability />);
    expect(screen.getByText(/different dates/i)).toHaveTextContent(/smaller number of guests/i);
  });
});

describe('LoadingResults (FR-016)', () => {
  it('is a status region reading "Loading results"', () => {
    render(<LoadingResults />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading results');
  });
});

describe('Unavailable (EC10, FR-017)', () => {
  it('tells the user to try again', () => {
    render(<Unavailable />);
    expect(screen.getByRole('alert')).toHaveTextContent(/unavailable/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/try again/i);
  });
});
