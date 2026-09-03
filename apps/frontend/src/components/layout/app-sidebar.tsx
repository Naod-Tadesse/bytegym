import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import { Dumbbell01Icon } from '@hugeicons/core-free-icons';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { NavMain } from './nav-main';
import { NavUser } from './nav-user';

export function AppSidebar({ checkInCount }: { checkInCount?: number }) {
  const { t } = useTranslation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/" />}>
              {/* Same emerald mark as the dashboard; collapses to just the tile. */}
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <HugeiconsIcon icon={Dumbbell01Icon} />
              </div>
              <div className="flex flex-col text-left leading-tight">
                <span className="text-sm font-semibold tracking-tight">
                  {t('app.name')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('app.tagline')}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <NavMain checkInCount={checkInCount} />
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
