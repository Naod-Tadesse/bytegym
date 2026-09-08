import type { ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  Add01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Login03Icon,
  MinusSignCircleIcon,
  MoneyBag02Icon,
  UserGroupIcon,
  UserRemove01Icon,
} from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { formatBirr } from '@/lib/format';
import type { DashboardMembers } from './data/types';
import { useDashboard } from './hooks/use-dashboard';

/**
 * What the gym looks like right now.
 *
 * Every figure comes from `GET /api/reports/dashboard`, aggregated in SQL over
 * the whole population — not counted from a page, which would report "however
 * many members fit on screen". Nothing here is a placeholder: if a number
 * cannot be derived from data this system actually stores, it is not on the
 * page. That is why there is no revenue trend, no class schedule and no
 * attendance chart — none of those exist yet.
 */
export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  // The figures need `report.view`; the page itself is the landing route and
  // must render for everyone, so the query is gated rather than the route.
  const canViewReports = hasPermission('report.view');
  const { dashboard, isLoading } = useDashboard(canViewReports);

  return (
    <div className="m-2 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-2xl font-bold tracking-tight">
            {t('nav.dashboard')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.subtitle')}
          </p>
        </div>
        {hasPermission('member.create') && (
          <Button onClick={() => navigate({ to: '/members/new' })}>
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />
            {t('members.actions.create')}
          </Button>
        )}
      </div>

      {!canViewReports ? (
        // Said plainly rather than left blank. A page that renders nothing
        // reads as broken; this reads as "not yours", which is the truth.
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.noAccess.title')}</CardTitle>
            <CardDescription>{t('dashboard.noAccess.body')}</CardDescription>
          </CardHeader>
        </Card>
      ) : isLoading || !dashboard ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t('dashboard.stats.activeMembers')}
              hint={t('dashboard.stats.activeMembersHint')}
              value={dashboard.members.active}
              icon={UserGroupIcon}
            />
            {/* The counterpart the gym acts on: these are the people to
                call. */}
            <StatCard
              label={t('dashboard.stats.inactiveMembers')}
              hint={t('dashboard.stats.inactiveMembersHint')}
              value={dashboard.members.inactive}
              icon={UserRemove01Icon}
            />
            <StatCard
              label={t('dashboard.stats.checkInsToday')}
              hint={t('dashboard.stats.checkInsTodayHint')}
              value={dashboard.checkInsToday}
              icon={Login03Icon}
            />
            {/* Money is a string end to end — formatted, never parsed. */}
            <StatCard
              label={t('dashboard.stats.takenToday')}
              hint={t('dashboard.stats.takenTodayHint', {
                count: dashboard.paymentsToday.count,
              })}
              value={formatBirr(dashboard.paymentsToday.received)}
              icon={MoneyBag02Icon}
            />
          </div>

          <MembersByStatus members={dashboard.members} />
        </>
      )}
    </div>
  );
}

/**
 * One figure, its label, and one line saying what it counts.
 *
 * No trend badge. A percentage change needs yesterday's number to compare
 * against, and nothing stores one — a "+3.2%" here would be decoration that
 * looks like information.
 */
function StatCard({
  label,
  hint,
  value,
  icon,
}: {
  label: string;
  hint: string;
  value: ReactNode;
  icon: IconSvgElement;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        <CardAction>
          <HugeiconsIcon icon={icon} className="text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

/**
 * The four membership states in full, so the two headline cards add up to
 * something the reader can check rather than being asserted.
 *
 * Suspension sits below a separator because it is a different axis: a suspended
 * member is still counted in whichever state above their membership puts them,
 * so adding this row to the others would double-count people.
 */
function MembersByStatus({ members }: { members: DashboardMembers }) {
  const { t } = useTranslation();

  const rows = [
    {
      key: 'active',
      label: t('members.status.active'),
      value: members.active,
      icon: CheckmarkCircle02Icon,
    },
    {
      key: 'expired',
      label: t('members.status.expired'),
      value: members.expired,
      icon: Cancel01Icon,
    },
    {
      key: 'never',
      label: t('members.status.never'),
      value: members.never,
      icon: MinusSignCircleIcon,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.byStatus.title')}</CardTitle>
        <CardDescription>
          {t('dashboard.byStatus.subtitle', { total: members.total })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.map((row) => (
          <StatusRow
            key={row.key}
            label={row.label}
            value={row.value}
            icon={row.icon}
          />
        ))}
        <Separator />
        <StatusRow
          label={t('dashboard.byStatus.suspended')}
          hint={t('dashboard.byStatus.suspendedHint')}
          value={members.suspended}
          icon={Cancel01Icon}
        />
      </CardContent>
    </Card>
  );
}

function StatusRow({
  label,
  hint,
  value,
  icon,
}: {
  label: string;
  hint?: string;
  value: number;
  icon: IconSvgElement;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <HugeiconsIcon icon={icon} className="size-4 text-muted-foreground" />
      <span>{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      <span className="ml-auto font-medium tabular-nums">{value}</span>
    </div>
  );
}

/** Mirrors the real layout so the page does not jump when the figures land. */
function DashboardSkeleton() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-8 w-16" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-5 w-full" />
          ))}
        </CardContent>
      </Card>
    </>
  );
}
