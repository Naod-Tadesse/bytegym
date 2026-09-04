import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import { Dumbbell01Icon } from '@hugeicons/core-free-icons';

import { ModeToggle } from '@/components/mode-toggle';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { NavMain } from './nav-main';

export function AppSidebar() {
  const { t } = useTranslation();

  return (
    // `floating` makes the sidebar its own rounded card on the page
    // background, matching the header and page cards. Not `inset`, which
    // instead wraps the whole content area in one slab.
    <Sidebar variant="floating" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="hover:bg-transparent active:bg-transparent"
              render={<Link to="/" />}
            >
              {/* Emerald tile with a soft glow — the accent used as light
                  rather than as another surface. */}
              <div className="relative flex aspect-square size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20 after:absolute after:inset-0 after:rounded-lg after:bg-primary/25 after:blur-md">
                <HugeiconsIcon
                  icon={Dumbbell01Icon}
                  className="relative z-10"
                />
              </div>
              {/* One line, not two: the tagline was pure height. */}
              <span className="truncate text-xl font-bold tracking-tight group-data-[collapsible=icon]:hidden">
                {t('app.name')}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain />
      </SidebarContent>

      {/* The theme switch lives here; the user block moved to the header. */}
      <SidebarFooter>
        <ModeToggle />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
