import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const login = vi.fn();
const navigate = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    login,
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    user: null,
    isLoading: false,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return { ...actual, useNavigate: () => navigate };
});

import LoginForm from '../../components/forms/LoginForm';

function renderForm() {
  return render(
    <MemoryRouter>
      <LoginForm />
    </MemoryRouter>,
  );
}

describe('LoginForm', () => {
  beforeEach(() => {
    login.mockReset();
    navigate.mockReset();
  });

  it('renders email and password fields', () => {
    renderForm();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('calls the auth service on submit and navigates on success', async () => {
    login.mockResolvedValueOnce(undefined);
    renderForm();

    await userEvent.type(screen.getByLabelText(/email/i), 'me@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith('me@example.com', 'password123'),
    );
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true }),
    );
  });

  it('surfaces an error message when login fails', async () => {
    login.mockRejectedValueOnce(new Error('bad creds'));
    renderForm();

    await userEvent.type(screen.getByLabelText(/email/i), 'me@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});
