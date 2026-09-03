import { Link, useLocation } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { cn } from '@/lib/utils';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { navGroups } from './sidebar-data';

export function NavMain({ checkInCount }: { checkInCount?: number }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { hasPermission } = usePermissions();

  return (
    <>
      {navGroups.map((group) => {
        const items = group.items.filter(
          (item) =>
            !item.requiredPermission || hasPermission(item.requiredPermission),
        );

        // A group whose every item is filtered away renders nothing at all.
        if (items.length === 0) return null;

        return (
          <SidebarGroup key={group.titleKey}>
            <SidebarGroupLabel>{t(group.titleKey)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const isActive =
                    item.url === '/'
                      ? pathname === '/'
                      : pathname.startsWith(item.url);

                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={t(item.titleKey)}
                        className={cn(
                          // A left rail rather than a filled block: the emerald
                          // accent is loud, and filling every active row turns a
                          // dense list into a green wash.
                          'relative before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-transparent',
                          isActive && 'before:bg-primary',
                        )}
                        render={<Link to={item.url} />}
                      >
                        <HugeiconsIcon icon={item.icon} />
                        <span>{t(item.titleKey)}</span>
                      </SidebarMenuButton>
                      {item.showCheckInBadge && checkInCount != null && (
                        <SidebarMenuBadge>{checkInCount}</SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        );
      })}
    </>
  );
}
