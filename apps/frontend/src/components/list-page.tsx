import type { ReactNode } from 'react';

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
} from '@/components/ui/card';

interface ListPageProps {
  title: string;
  subtitle?: string;
  /** Rendered right-aligned in the card header. */
  headerActions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Shared shell for every list screen, so they cannot drift apart. */
export function ListPage({
  title,
  subtitle,
  headerActions,
  children,
  className = 'm-2',
}: ListPageProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
        {headerActions && <CardAction>{headerActions}</CardAction>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}
