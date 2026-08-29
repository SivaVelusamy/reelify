import axios from 'axios';
import api from './api';
import type { AuthTokens, User } from '../types';

/* -------------------------------------------------------------------------- */
/* Payload / response shapes                                                   */
/* -------------------------------------------------------------------------- */

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
}

export interface UpdateProfilePayload {
  full_name: string;
}

interface ValidationErrorItem {
  msg?: string;
}

interface ApiErrorBody {
  detail?: string | ValidationErrorItem[];
}

/* -------------------------------------------------------------------------- */
/* Error helper                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Extract a user-presentable message from an unknown thrown value, handling
 * FastAPI's `{ detail: string }` and `{ detail: [{ msg }] }` shapes.
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim().length > 0) {
      return detail;
    }
    if (Array.isArray(detail) && detail.length > 0) {
      const messages = detail
        .map((item) => item.msg)
        .filter((msg): msg is string => typeof msg === 'string');
      if (messages.length > 0) {
        return messages.join(', ');
      }
    }
    if (error.message) {
      return error.message;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

/* -------------------------------------------------------------------------- */
/* Endpoint wrappers                                                           */
/* -------------------------------------------------------------------------- */

/** POST /auth/register — create an account. */
export async function register(payload: RegisterPayload): Promise<User> {
  const { data } = await api.post<User>('/auth/register', payload);
  return data;
}

/** POST /auth/login — exchange credentials for access + refresh tokens. */
export async function login(
  email: string,
  password: string,
): Promise<AuthTokens> {
  const form = new FormData();
  form.append('username', email);
  form.append('password', password);
  const { data } = await api.post<AuthTokens>('/auth/login', form);
  return data;
}

/** POST /auth/refresh — mint a fresh token pair from a refresh token. */
export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const { data } = await api.post<AuthTokens>('/auth/refresh', {
    refresh_token: refreshToken,
  });
  return data;
}

/** POST /auth/logout — revoke the current refresh token. */
export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

/** POST /auth/forgot-password — email a password-reset token. */
export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}

/** POST /auth/reset-password — set a new password using an emailed token. */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  await api.post('/auth/reset-password', {
    token,
    new_password: newPassword,
  });
}

/** GET /auth/me — current authenticated user. */
export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me');
  return data;
}

/** PUT /auth/me — update the current user's profile. */
export async function updateProfile(
  payload: UpdateProfilePayload,
): Promise<User> {
  const { data } = await api.put<User>('/auth/me', payload);
  return data;
}

export const authService = {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
  updateProfile,
};
