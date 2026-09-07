/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';

import { toast } from '@/components/ui/toast';
import { useAuthStore } from '@/features/auth/context/auth-store';

export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL ?? '',
  withCredentials: true,
});

// Attach the bearer token. Reads zustand outside React on purpose.
axiosInstance.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// ── Single-flight, cross-tab-safe refresh ──────────────────────────────────
// Deliberately uses bare `axios`, not `axiosInstance`: the instance's own
// response interceptor would re-enter this on a failed refresh. The refresher
// must stay outside the pipeline it rescues.
let refreshPromise: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    const run = async (): Promise<string> => {
      // Read inside the lock, so a tab that waited picks up the token the
      // winner just wrote rather than replaying a rotated one.
      const { refreshToken } = useAuthStore.getState();
      const { data } = await axios.post(
        `${import.meta.env.VITE_BASE_URL ?? ''}/api/auth/refresh`,
        { refreshToken },
        { withCredentials: true },
      );
      useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
      return data.accessToken as string;
    };

    // Serialize across tabs: the backend rotates and revokes-on-replay, so two
    // concurrent refreshes with the same token would kill the whole session.
    refreshPromise = (
      typeof navigator !== 'undefined' && 'locks' in navigator
        ? (navigator.locks.request(
            'bytegym-token-refresh',
            run,
          ) as unknown as Promise<string>)
        : run()
    ).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** Routes that must never trigger a refresh — they ARE the auth flow. */
const SKIP_REFRESH_URLS = ['/auth/login', '/auth/refresh'];

const shouldSkipRefresh = (url: string | undefined) =>
  !url || SKIP_REFRESH_URLS.some((path) => url.includes(path));

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    let errorMessage = 'An unexpected error occurred';
    let shouldShowToast = true;

    if (error.response) {
      const { status, data } = error.response as { status: number; data: any };
      const requestUrl = originalRequest?.url ?? '';

      // Refresh once, then replay the original request.
      if (
        status === 401 &&
        !originalRequest._retry &&
        !shouldSkipRefresh(requestUrl)
      ) {
        originalRequest._retry = true;
        try {
          const newAccessToken = await refreshAccessToken();
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return axiosInstance(originalRequest);
        } catch (refreshError) {
          useAuthStore.getState().clearAuth();
          navigateCallback?.('/auth/login');
          return Promise.reject(refreshError);
        }
      }

      switch (status) {
        case 400:
          errorMessage = data?.message || data?.error || 'Bad request';
          break;
        case 401:
          errorMessage = data?.message || data?.error || 'Unauthorized access';
          // The login screen and the boot probe render their own errors.
          if (
            requestUrl.includes('/auth/me') ||
            requestUrl.includes('/auth/login')
          ) {
            shouldShowToast = false;
          } else {
            useAuthStore.getState().clearAuth();
            navigateCallback?.('/auth/login');
          }
          break;
        case 403:
          errorMessage = data?.message || 'Access forbidden';
          break;
        case 404:
          errorMessage = 'Resource not found';
          break;
        case 409:
          errorMessage = data?.message || data?.error || 'Conflict';
          break;
        case 422:
          errorMessage = data?.message || data?.error || 'Validation error';
          break;
        case 500:
          errorMessage = 'Internal server error';
          break;
        default:
          errorMessage = data?.message || data?.error || `Error ${status}`;
      }

      // class-validator returns an array of messages.
      if (Array.isArray(errorMessage)) {
        errorMessage = errorMessage.join(', ');
      }
    } else if (error.request) {
      errorMessage = 'Network error. Please check your connection.';
    }

    if (shouldShowToast) {
      toast.add({ title: errorMessage, type: 'error' });
    }
    return Promise.reject(error);
  },
);

// Set from main.tsx so this layer never imports the router.
let navigateCallback: ((path: string) => void) | null = null;

export const setNavigateCallback = (callback: (path: string) => void) => {
  navigateCallback = callback;
};

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success?: boolean;
  status?: number;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

export default class ApiClient {
  endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async get<T = any>(url = '', config: AxiosRequestConfig = {}): Promise<T> {
    return await axiosInstance
      .get(this.endpoint + url, config)
      .then((res) => res.data);
  }

  async post<T = any, D = any>(
    url = '',
    data?: D,
    config: AxiosRequestConfig = {},
  ): Promise<T> {
    return await axiosInstance
      .post(this.endpoint + url, data, config)
      .then((res) => res.data);
  }

  /**
   * A POST whose **status** matters as much as its body.
   *
   * `post` returns `res.data`, which is right almost everywhere. It is not
   * right for an idempotent endpoint, which answers **201** for "created" and
   * **200** for "you already did this" — with an identical body either way, so
   * the status is the only thing that tells them apart. Check-in is one: a
   * repeat scan is not an error and must not read as a second admission.
   */
  async postRaw<T = any, D = any>(
    url = '',
    data?: D,
    config: AxiosRequestConfig = {},
  ): Promise<AxiosResponse<T>> {
    return await axiosInstance.post<T>(this.endpoint + url, data, config);
  }

  async put<T = any, D = any>(
    url = '',
    data?: D,
    config: AxiosRequestConfig = {},
  ): Promise<T> {
    return await axiosInstance
      .put(this.endpoint + url, data, config)
      .then((res) => res.data);
  }

  async patch<T = any, D = any>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return await axiosInstance
      .patch(this.endpoint + url, data, config)
      .then((res) => res.data);
  }

  async delete<T = any>(
    url: string,
    config: AxiosRequestConfig = {},
  ): Promise<T> {
    return await axiosInstance
      .delete(this.endpoint + url, config)
      .then((res) => res.data);
  }
}
