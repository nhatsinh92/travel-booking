import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import KeyedBySearchParams from '@/components/KeyedBySearchParams';

const useSearchParams = vi.fn();
vi.mock('next/navigation', () => ({ useSearchParams: () => useSearchParams() }));

function TypedValue() {
  const [value, setValue] = useState('');
  return <input aria-label="typed" value={value} onChange={(e) => setValue(e.target.value)} />;
}

function renderKeyed(fallback?: React.ReactNode) {
  const ui = () => (
    <KeyedBySearchParams fallback={fallback}>
      <TypedValue />
    </KeyedBySearchParams>
  );
  const result = render(ui());
  return { ...result, rerenderKeyed: () => result.rerender(ui()) };
}

beforeEach(() => {
  useSearchParams.mockReset();
  useSearchParams.mockReturnValue(new URLSearchParams('city=Hanoi&guests=2'));
});

describe('KeyedBySearchParams', () => {
  it('renders its children', () => {
    renderKeyed();
    expect(screen.getByLabelText('typed')).toBeInTheDocument();
  });

  it('renders its children when there are no search params', () => {
    useSearchParams.mockReturnValue(new URLSearchParams(''));
    renderKeyed();
    expect(screen.getByLabelText('typed')).toBeInTheDocument();
  });

  it('keeps a child\'s local state when re-rendered with the same search params', async () => {
    const { rerenderKeyed } = renderKeyed();
    await userEvent.type(screen.getByLabelText('typed'), 'Da Nang');

    useSearchParams.mockReturnValue(new URLSearchParams('city=Hanoi&guests=2'));
    rerenderKeyed();

    expect(screen.getByLabelText('typed')).toHaveValue('Da Nang');
  });

  it('discards a child\'s local state when the search params change', async () => {
    const { rerenderKeyed } = renderKeyed();
    await userEvent.type(screen.getByLabelText('typed'), 'Da Nang');

    useSearchParams.mockReturnValue(new URLSearchParams('city=Bangkok&guests=2'));
    rerenderKeyed();

    expect(screen.getByLabelText('typed')).toHaveValue('');
  });

  it('discards local state when the search params are cleared', async () => {
    const { rerenderKeyed } = renderKeyed();
    await userEvent.type(screen.getByLabelText('typed'), 'x');

    useSearchParams.mockReturnValue(new URLSearchParams(''));
    rerenderKeyed();

    expect(screen.getByLabelText('typed')).toHaveValue('');
  });

  it('shows the fallback while useSearchParams suspends', () => {
    useSearchParams.mockImplementation(() => {
      throw new Promise(() => {});
    });
    renderKeyed(<p>fallback shown</p>);

    expect(screen.getByText('fallback shown')).toBeInTheDocument();
    expect(screen.queryByLabelText('typed')).not.toBeInTheDocument();
  });

  it('shows nothing while useSearchParams suspends and no fallback is given', () => {
    useSearchParams.mockImplementation(() => {
      throw new Promise(() => {});
    });
    const { container } = renderKeyed();

    expect(container).toBeEmptyDOMElement();
  });
});
