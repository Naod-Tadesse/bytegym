import { useEffect } from 'react';
import {
  createRootRoute,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';

import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/header/app-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Spinner } from '@/components/ui/spinner';
import { Toaster } from '@/components/ui/toast';
import { useAuthStore } from '@/features/auth/context/auth-store';
import { useCurrentUser } from '@/features/auth/hooks/use-auth';

/**
 * Exact-match allowlist. Anything not listed requires a token AND a resolved
 * /auth/me — see the redirect effect below.
 */
const PUBLIC_ROUTES = ['/auth/login'];

function RootComponent() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const { data: user, isLoading, isError } = useCurrentUser();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isAuthenticated = !!accessToken && !!user;

  useEffect(() => {
    if (!accessToken && !isPublicRoute) {
      navigate({ to: '/auth/login' });
      return;
    }
    if (isAuthenticated && isPublicRoute) {
      navigate({ to: '/' });
      return;
    }
    // A token that /auth/me rejects is a dead token — the interceptor already
    // tried to refresh it.
    if (isError && !isPublicRoute) {
      clearAuth();
      navigate({ to: '/auth/login' });
    }
  }, [
    accessToken,
    isAuthenticated,
    isPublicRoute,
    isError,
    navigate,
    clearAuth,
  ]);

  if (isPublicRoute) {
    return (
      <>
        <Outlet />
        <Toaster />
        {/* bottom-left would sit on top of the sidebar's user block. */}
        <TanStackRouterDevtools position="bottom-right" />
      </>
    );
  }

  if (!accessToken || isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError || !user) return null;

  return (
    <>
      <SidebarProvider>
        <AppSidebar />
        {/* No height or overflow here — SidebarProvider's wrapper is min-h-svh,
            so the page scrolls at the browser level. Forcing h-svh + overflow
            here created a second, inner scrollbar. Matches shadcn dashboard-01. */}
        <SidebarInset>
          <AppHeader />
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
      <TanStackRouterDevtools />
    </>
  );
}

export const Route = createRootRoute({ component: RootComponent });
