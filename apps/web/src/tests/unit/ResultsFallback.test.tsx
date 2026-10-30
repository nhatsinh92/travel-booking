import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResultsFallback from '@/components/ResultsFallback';

const useSearchParams = vi.fn();
vi.mock('next/navigation', () => ({ useSearchParams: () => useSearchParams() }));

beforeEach(() => {
  useSearchParams.mockReset();
});

describe('ResultsFallback', () => {
  it('shows the loading placeholder when the URL carries a search (FR-016)', () => {
    useSearchParams.mockReturnValue(new URLSearchParams('city=Hanoi&guests=2'));
    render(<ResultsFallback />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading results');
  });

  it('shows the hint, not the placeholder, on a bare /search', () => {
    useSearchParams.mockReturnValue(new URLSearchParams(''));
    render(<ResultsFallback />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText(/enter a city/i)).toBeInTheDocument();
  });

  it('shows the hint when only unrelated params are present', () => {
    useSearchParams.mockReturnValue(new URLSearchParams('utm=x'));
    render(<ResultsFallback />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
