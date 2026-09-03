import { HugeiconsIcon } from '@hugeicons/react';
import { Moon02Icon, Sun03Icon } from '@hugeicons/core-free-icons';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

/**
 * Segmented light/dark pair for the sidebar footer, following ekos. A pair of
 * labelled buttons rather than a dropdown: the current mode is visible without
 * opening anything, which matters for the older users this app is aimed at.
 *
 * Renders inside <Sidebar>, so `useSidebar` always has its provider.
 */
export function ModeToggle() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { state } = useSidebar();

  // `system` has to be resolved to decide which half looks selected.
  const isLight =
    theme === 'light' ||
    (theme === 'system' &&
      !window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Two buttons will not fit an icon-collapsed rail, so it becomes one toggle.
  if (state === 'collapsed') {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="mx-auto"
        onClick={() => setTheme(isLight ? 'dark' : 'light')}
      >
        <HugeiconsIcon icon={isLight ? Sun03Icon : Moon02Icon} />
        <span className="sr-only">{t('theme.toggle')}</span>
      </Button>
    );
  }

  return (
    <div className="flex w-full gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setTheme('light')}
        className={cn(
          'flex-1 gap-2 bg-muted',
          isLight
            ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <HugeiconsIcon icon={Sun03Icon} data-icon="inline-start" />
        {t('theme.light')}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setTheme('dark')}
        className={cn(
          'flex-1 gap-2 bg-muted',
          isLight
            ? 'text-muted-foreground hover:text-foreground'
            : 'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground',
        )}
      >
        <HugeiconsIcon icon={Moon02Icon} data-icon="inline-start" />
        {t('theme.dark')}
      </Button>
    </div>
  );
}
