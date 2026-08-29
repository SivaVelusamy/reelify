import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LimitMeter } from '../../components/dashboard/LimitMeter';

describe('LimitMeter', () => {
  it('renders a progress bar with the used percentage', () => {
    render(<LimitMeter minutesUsed={15} minutesLimit={30} usedPct={50} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText(/\/ 30 min/)).toBeInTheDocument();
  });

  it('clamps the percentage into the 0-100 range', () => {
    render(<LimitMeter minutesUsed={90} minutesLimit={30} usedPct={300} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('shows an unlimited state when there is no limit', () => {
    render(<LimitMeter minutesUsed={42} minutesLimit={null} usedPct={0} />);
    expect(screen.getByText(/unlimited/i)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
