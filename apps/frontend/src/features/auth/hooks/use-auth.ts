import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { toast } from '@/components/ui/toast';
import ApiClient from '@/services/api-client';
import { useAuthStore } from '../context/auth-store';
import type {
  AuthUser,
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
} from '../data/types';

// The hooks file IS the api layer — no separate api/ folder, per the ekos pattern.
const apiClient = new ApiClient('/api/auth');

// ===== Queries =====

export function useCurrentUser() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery<AuthUser>({
    queryKey: ['auth', 'me'],
    queryFn: () => apiClient.get<AuthUser>('/me'),
    enabled: !!accessToken,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}

// ===== Mutations =====

export function useLogin() {
  const setTokens = useAuthStore((state) => state.setTokens);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: LoginRequest) =>
      apiClient.post<LoginResponse>('/login', data),
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken);
      // Drop anything cached for the previous session.
      queryClient.clear();
      navigate({ to: '/' });
    },
  });

  return {
    login: mutation.mutate,
    loginAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

export function useLogout() {
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => {
      const { refreshToken } = useAuthStore.getState();
      return apiClient.post('/logout', { refreshToken });
    },
    // onSettled, not onSuccess: a server error must not strand the user in a
    // half-logged-out state.
    onSettled: () => {
      clearAuth();
      queryClient.clear();
      navigate({ to: '/auth/login' });
    },
  });

  return { logout: mutation.mutate, isPending: mutation.isPending };
}

export function useChangePassword() {
  const mutation = useMutation({
    mutationFn: (data: ChangePasswordRequest) =>
      apiClient.patch('/change-password', data),
    onSuccess: () => {
      toast.add({ title: 'Password changed', type: 'success' });
    },
  });

  return {
    changePassword: mutation.mutate,
    changePasswordAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
