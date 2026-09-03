import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon } from '@hugeicons/core-free-icons';

import { ModeToggle } from '@/components/mode-toggle';
import { Kbd } from '@/components/ui/kbd';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

export function AppHeader({ title }: { title?: string }) {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />

      {title && <span className="text-sm font-medium">{title}</span>}

      <Button
        variant="outline"
        size="sm"
        className="ml-auto gap-2 text-muted-foreground"
      >
        <HugeiconsIcon icon={Search01Icon} data-icon="inline-start" />
        <span className="hidden sm:inline">{t('actions.search')}</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </Button>

      <ModeToggle />
    </header>
  );
}
