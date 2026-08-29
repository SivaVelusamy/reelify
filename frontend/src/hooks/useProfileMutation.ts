import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import {
  updateProfile,
  type UpdateProfilePayload,
} from '../services/authService';
import type { User } from '../types';

export const CURRENT_USER_QUERY_KEY = ['auth', 'me'] as const;

/**
 * React Query v5 mutation for `PUT /auth/me`. On success it primes the cached
 * current-user query; callers should still invoke `refreshUser()` from the
 * auth context so the provider state stays in sync.
 */
export function useProfileMutation(): UseMutationResult<
  User,
  Error,
  UpdateProfilePayload
> {
  const queryClient = useQueryClient();

  return useMutation<User, Error, UpdateProfilePayload>({
    mutationFn: (payload: UpdateProfilePayload) => updateProfile(payload),
    onSuccess: (user) => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user);
    },
  });
}
