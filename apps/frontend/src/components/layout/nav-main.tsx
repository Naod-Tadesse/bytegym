import { Link, useLocation } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { cn } from '@/lib/utils';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { isNavActive } from './is-nav-active';
import { navGroups } from './sidebar-data';

export function NavMain() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { hasPermission } = usePermissions();

  // One flat list, as in ekos. The groups still exist in the data and still
  // drive the header breadcrumb — they just no longer cost four heading rows
  // of sidebar height.
  const items = navGroups
    .flatMap((group) => group.items)
    .filter(
      (item) =>
        !item.requiredPermission || hasPermission(item.requiredPermission),
    );

  return (
    <SidebarGroup className="gap-1 px-3 group-data-[collapsible=icon]:px-1">
      <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
        {items.map((item) => {
          const isActive = isNavActive(pathname, item.url);

          return (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                isActive={isActive}
                tooltip={t(item.titleKey)}
                className={cn(
                  'relative h-10 font-medium transition-colors',
                  // The emerald rail is the "you are here" marker.
                  'before:absolute before:inset-y-1 before:left-0 before:w-1 before:rounded-r-full before:bg-transparent before:transition-colors',
                  'data-active:before:bg-primary',
                  // Solid primary fill for the active item, not a tint. Only
                  // one item is ever active, so a strong fill is signal rather
                  // than noise — and it stays legible for users who struggle
                  // with low-contrast UI.
                  // Must be `data-active:` — the base component styles the
                  // active state with a bare data-active attribute (Base UI
                  // convention), so `data-[active=true]:` never matches and the
                  // accent tint silently wins.
                  'data-active:bg-sidebar-primary data-active:font-semibold data-active:text-sidebar-primary-foreground',
                  'data-active:hover:bg-sidebar-primary data-active:hover:text-sidebar-primary-foreground',
                  !isActive && 'text-muted-foreground hover:text-foreground',
                )}
                render={<Link to={item.url} />}
              >
                <HugeiconsIcon icon={item.icon} />
                <span>{t(item.titleKey)}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
