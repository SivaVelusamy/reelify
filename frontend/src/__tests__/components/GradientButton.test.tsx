import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GradientButton } from '../../components/ui/GradientButton';

describe('GradientButton', () => {
  it('renders its children', () => {
    render(<GradientButton>Save changes</GradientButton>);
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('shows a loading label and is disabled while loading', () => {
    render(<GradientButton isLoading>Save</GradientButton>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/loading/i);
  });

  it('fires onClick when enabled', async () => {
    const onClick = vi.fn();
    render(<GradientButton onClick={onClick}>Go</GradientButton>);
    await userEvent.click(screen.getByRole('button', { name: /go/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <GradientButton onClick={onClick} disabled>
        Nope
      </GradientButton>,
    );
    await userEvent.click(screen.getByRole('button', { name: /nope/i }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
