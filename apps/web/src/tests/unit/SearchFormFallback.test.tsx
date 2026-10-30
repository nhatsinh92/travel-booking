import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SearchFormFallback from '@/components/SearchFormFallback';

describe('SearchFormFallback', () => {
  it('shows the four search fields and the button with the same labels as the live form', () => {
    render(<SearchFormFallback />);
    for (const label of ['City', 'Check-in', 'Check-out', 'Guests']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it('is disabled throughout', () => {
    render(<SearchFormFallback />);
    for (const label of ['City', 'Check-in', 'Check-out', 'Guests']) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
  });

  it('has empty fields', () => {
    render(<SearchFormFallback />);
    expect(screen.getByLabelText('City')).toHaveValue('');
    expect(screen.getByLabelText('Guests')).toHaveValue('');
  });
});
