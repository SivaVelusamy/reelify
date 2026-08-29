import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from '../../components/ui/StatusBadge';

describe('StatusBadge', () => {
  it('renders a known status label', () => {
    render(<StatusBadge status="rendered" />);
    expect(screen.getByText('rendered')).toBeInTheDocument();
  });

  it('humanises underscored status strings', () => {
    render(<StatusBadge status="past_due" />);
    expect(screen.getByText('past due')).toBeInTheDocument();
  });

  it('falls back gracefully for an unknown status', () => {
    render(<StatusBadge status="mystery" />);
    expect(screen.getByText('mystery')).toBeInTheDocument();
  });
});
