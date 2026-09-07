import { useLocation } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon } from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { isNavActive } from '../is-nav-active';
import { navGroups } from '../sidebar-data';
import { HeaderUserNav } from './header-user-nav';

/** Resolves the current page's nav entry so the header is never empty. */
function useCurrentPage() {
  const { pathname } = useLocation();

  for (const group of navGroups) {
    for (const item of group.items) {
      if (isNavActive(pathname, item.url)) return { group, item };
    }
  }
  return null;
}

export function AppHeader() {
  const { t } = useTranslation();
  const current = useCurrentPage();

  return (
    // The bar is a card floating on the page background, per ekos — hence the
    // padded sticky wrapper rather than a full-bleed bordered strip.
    <div className="sticky top-0 z-10 bg-background px-2 py-2">
      {/* h-16, not ekos's h-20: same shape, less of the page given to chrome.
          Shrinks again once the sidebar collapses to icons. */}
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 rounded-lg border bg-sidebar px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-14 sm:px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="data-[orientation=vertical]:h-6"
          />

          {current && (
            // The group is context, the page is the subject.
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5">
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {t(current.group.titleKey)}
              </span>
              <span
                aria-hidden
                className="hidden text-sm text-muted-foreground/50 sm:inline"
              >
                /
              </span>
              <span className="text-base font-semibold">
                {t(current.item.titleKey)}
              </span>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-muted-foreground"
          >
            <HugeiconsIcon icon={Search01Icon} data-icon="inline-start" />
            <span className="hidden sm:inline">{t('actions.search')}</span>
            <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
          </Button>

          <HeaderUserNav />
        </div>
      </header>
    </div>
  );
}
