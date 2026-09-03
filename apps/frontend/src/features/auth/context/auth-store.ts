import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Tokens only. The signed-in user lives in the TanStack Query cache under
 * ['auth','me'] — this store exists so the axios interceptor can read the
 * token outside React.
 *
 * Caveat, inherited from the ekos pattern: a refresh token in localStorage is
 * readable by any XSS on the origin. Moving it to an httpOnly cookie is the
 * upgrade path when this goes anywhere near production.
 */
interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
      clearAuth: () => set({ accessToken: null, refreshToken: null }),
    }),
    {
      name: 'bytegym-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
