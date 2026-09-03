import type { ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft02Icon } from '@hugeicons/core-free-icons';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

interface FormPageHeaderProps {
  title: string;
  subtitle?: string;
  /**
   * Must navigate to a concrete route. Never `history.back()` — a page reached
   * by a deep link or a redirect has nowhere sensible to go back to.
   */
  onBack: () => void;
  /** Cancel / Submit live here, in the header row, not in a card footer. */
  children?: ReactNode;
}

export function FormPageHeader({
  title,
  subtitle,
  onBack,
  children,
}: FormPageHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="ghost" size="icon" onClick={onBack}>
        <HugeiconsIcon icon={ArrowLeft02Icon} />
        <span className="sr-only">{t('actions.back')}</span>
      </Button>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children && <div className="ml-auto flex gap-2">{children}</div>}
    </div>
  );
}
