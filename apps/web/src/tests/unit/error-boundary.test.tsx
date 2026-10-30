import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SearchError from '@/app/search/error';

describe('search error boundary (EC10, FR-017)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tells the user to try again', () => {
    render(<SearchError error={new Error('boom')} retry={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/try again/i);
  });

  it('retries when the button is clicked', async () => {
    const retry = vi.fn();
    render(<SearchError error={new Error('boom')} retry={retry} />);

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('logs the error', () => {
    const error = new Error('boom');
    render(<SearchError error={error} retry={() => {}} />);
    expect(console.error).toHaveBeenCalledWith(error);
  });
});
