import { createFileRoute } from '@tanstack/react-router';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  Alert02Icon,
  ArrowUp01Icon,
  Calendar03Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Dollar01Icon,
  Login03Icon,
  MoreHorizontalIcon,
  SnowIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { useMemo, useState } from 'react';
import { createColumnHelper } from '@tanstack/react-table';

import { DataTable } from '@/components/table/data-table';
import { DataTableColumnHeader } from '@/components/table/column-header';
import type { DataTableFeatures } from '@/components/table/data-table-features';
import { rowNumberColumn } from '@/components/table/row-number-column';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Membership states. Each pairs a Badge variant with an icon so status is never
 * carried by colour alone. `expiring` uses `outline` because the theme has no
 * amber/warning token yet.
 */
const MEMBERSHIP_STATUS = {
  active: {
    labelKey: 'status.active',
    variant: 'default',
    icon: CheckmarkCircle02Icon,
  },
  expiring: {
    labelKey: 'status.expiring',
    variant: 'outline',
    icon: Alert02Icon,
  },
  lapsed: {
    labelKey: 'status.lapsed',
    variant: 'destructive',
    icon: Cancel01Icon,
  },
  frozen: { labelKey: 'status.frozen', variant: 'secondary', icon: SnowIcon },
} as const;

type MembershipStatus = keyof typeof MEMBERSHIP_STATUS;

type Member = {
  name: string;
  plan: string;
  status: MembershipStatus;
  lastVisit: string;
};

const MEMBERS: Member[] = [
  {
    name: 'Amara Osei',
    plan: 'Unlimited',
    status: 'active',
    lastVisit: 'Today',
  },
  {
    name: 'Ben Halvorsen',
    plan: 'Off-peak',
    status: 'active',
    lastVisit: 'Today',
  },
  {
    name: 'Chidi Nwosu',
    plan: 'Unlimited',
    status: 'expiring',
    lastVisit: '2 days ago',
  },
  {
    name: 'Dana Ricci',
    plan: 'Class pass',
    status: 'frozen',
    lastVisit: '3 weeks ago',
  },
  {
    name: 'Eli Zimmerman',
    plan: 'Off-peak',
    status: 'lapsed',
    lastVisit: '2 months ago',
  },
  {
    name: 'Farah Haddad',
    plan: 'Unlimited',
    status: 'active',
    lastVisit: 'Yesterday',
  },
  {
    name: 'Gabriel Moreau',
    plan: 'Class pass',
    status: 'active',
    lastVisit: 'Today',
  },
  {
    name: 'Hana Kobayashi',
    plan: 'Unlimited',
    status: 'expiring',
    lastVisit: '4 days ago',
  },
  {
    name: 'Ivan Petrov',
    plan: 'Off-peak',
    status: 'active',
    lastVisit: 'Yesterday',
  },
  {
    name: 'Jelena Marković',
    plan: 'Unlimited',
    status: 'frozen',
    lastVisit: '1 month ago',
  },
  {
    name: 'Kwame Mensah',
    plan: 'Class pass',
    status: 'active',
    lastVisit: 'Today',
  },
  {
    name: 'Lena Fischer',
    plan: 'Unlimited',
    status: 'lapsed',
    lastVisit: '3 months ago',
  },
  {
    name: 'Mateo Silva',
    plan: 'Off-peak',
    status: 'active',
    lastVisit: '2 days ago',
  },
  {
    name: 'Nadia Rahman',
    plan: 'Unlimited',
    status: 'expiring',
    lastVisit: 'Yesterday',
  },
  {
    name: 'Oscar Lindqvist',
    plan: 'Class pass',
    status: 'active',
    lastVisit: 'Today',
  },
  {
    name: 'Priya Raman',
    plan: 'Unlimited',
    status: 'active',
    lastVisit: 'Today',
  },
  {
    name: 'Quentin Blake',
    plan: 'Off-peak',
    status: 'frozen',
    lastVisit: '5 weeks ago',
  },
  {
    name: 'Rosa Delgado',
    plan: 'Unlimited',
    status: 'active',
    lastVisit: 'Yesterday',
  },
  {
    name: 'Sana Iqbal',
    plan: 'Class pass',
    status: 'expiring',
    lastVisit: '6 days ago',
  },
  {
    name: 'Tobias Lund',
    plan: 'Unlimited',
    status: 'active',
    lastVisit: 'Today',
  },
  {
    name: 'Ursula Novak',
    plan: 'Off-peak',
    status: 'lapsed',
    lastVisit: '4 months ago',
  },
  {
    name: 'Viktor Andersen',
    plan: 'Unlimited',
    status: 'active',
    lastVisit: '3 days ago',
  },
  {
    name: 'Wei Zhang',
    plan: 'Class pass',
    status: 'active',
    lastVisit: 'Today',
  },
];

const CLASSES = [
  {
    name: 'Strength Foundations',
    trainer: 'Ivo Petrov',
    time: '06:00',
    booked: 14,
    capacity: 16,
  },
  {
    name: 'HIIT 45',
    trainer: 'Nadia Reyes',
    time: '07:30',
    booked: 22,
    capacity: 24,
  },
  {
    name: 'Olympic Lifting',
    trainer: 'Marc Dubois',
    time: '12:00',
    booked: 6,
    capacity: 12,
  },
  {
    name: 'Mobility & Recovery',
    trainer: 'Sana Iqbal',
    time: '18:15',
    booked: 18,
    capacity: 20,
  },
];

const CHECK_INS = [
  { name: 'Amara Osei', at: '2 min ago' },
  { name: 'Ben Halvorsen', at: '11 min ago' },
  { name: 'Farah Haddad', at: '24 min ago' },
  { name: 'Tobias Lund', at: '38 min ago' },
  { name: 'Priya Raman', at: '52 min ago' },
];

const TRAFFIC = [
  { day: 'Mon', morning: 82, evening: 120 },
  { day: 'Tue', morning: 74, evening: 138 },
  { day: 'Wed', morning: 96, evening: 142 },
  { day: 'Thu', morning: 68, evening: 129 },
  { day: 'Fri', morning: 91, evening: 156 },
  { day: 'Sat', morning: 134, evening: 88 },
  { day: 'Sun', morning: 112, evening: 61 },
];

const STATS = [
  {
    labelKey: 'stats.activeMembers',
    value: '1,284',
    delta: '+3.2%',
    icon: UserGroupIcon,
  },
  {
    labelKey: 'stats.checkInsToday',
    value: '317',
    delta: '+8.1%',
    icon: Login03Icon,
  },
  {
    labelKey: 'stats.monthlyRevenue',
    value: '$48,290',
    delta: '+2.4%',
    icon: Dollar01Icon,
  },
  {
    labelKey: 'stats.classesToday',
    value: '12',
    delta: '+1',
    icon: Calendar03Icon,
  },
] as const;

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('');
}

function StatusBadge({ status }: { status: MembershipStatus }) {
  const { t } = useTranslation();
  const { labelKey, variant, icon } = MEMBERSHIP_STATUS[status];

  return (
    <Badge variant={variant}>
      <HugeiconsIcon icon={icon} data-icon="inline-start" />
      {t(labelKey)}
    </Badge>
  );
}

const columnHelper = createColumnHelper<DataTableFeatures, Member>();

/** A factory, not a constant: the row number depends on the current page. */
const buildMemberColumns = (pagination: { page: number; limit: number }) =>
  columnHelper.columns([
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={
            table.getIsSomePageRowsSelected() &&
            !table.getIsAllPageRowsSelected()
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    }),
    rowNumberColumn(columnHelper, pagination),
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Member" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>{initials(row.original.name)}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{row.original.name}</span>
        </div>
      ),
    }),
    columnHelper.accessor('plan', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Plan" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.plan}</span>
      ),
    }),
    columnHelper.accessor('status', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    }),
    columnHelper.accessor('lastVisit', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last visit" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.lastVisit}</span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      cell: () => (
        <Button variant="ghost" size="icon-sm">
          <HugeiconsIcon icon={MoreHorizontalIcon} />
          <span className="sr-only">Open row actions</span>
        </Button>
      ),
    }),
  ]);

function Dashboard() {
  const { t } = useTranslation();
  const [tableState, setTableState] = useState<{
    page: number;
    limit: number;
    search: string;
    // Written by the faceted filter as a comma-joined string.
    status?: string;
  }>({ page: 1, limit: 5, search: '' });

  // DataTable is built for server-side paging, so the parent plays the part of
  // the server: filter first, then hand back only the current page.
  const filteredMembers = useMemo(() => {
    const query = tableState.search.trim().toLowerCase();
    const statuses = tableState.status
      ? new Set(tableState.status.split(','))
      : null;

    return MEMBERS.filter((member) => {
      const matchesQuery =
        !query ||
        member.name.toLowerCase().includes(query) ||
        member.plan.toLowerCase().includes(query);
      const matchesStatus = !statuses || statuses.has(member.status);
      return matchesQuery && matchesStatus;
    });
  }, [tableState.search, tableState.status]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMembers.length / tableState.limit),
  );
  // Guard against landing past the last page after a filter narrows results.
  const currentPage = Math.min(tableState.page, totalPages);
  const pagedMembers = useMemo(
    () =>
      filteredMembers.slice(
        (currentPage - 1) * tableState.limit,
        currentPage * tableState.limit,
      ),
    [filteredMembers, currentPage, tableState.limit],
  );

  const memberColumns = useMemo(
    () => buildMemberColumns({ page: currentPage, limit: tableState.limit }),
    [currentPage, tableState.limit],
  );

  // Depends on `t`, so it is built per render rather than at module scope.
  const chartConfig = {
    morning: { label: t('traffic.morning'), color: 'var(--chart-1)' },
    evening: { label: t('traffic.evening'), color: 'var(--chart-2)' },
  } satisfies ChartConfig;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Page heading — the app chrome (brand, search, theme, user) lives in
          AppHeader, so this route only owns its own content. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('nav.dashboard')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <Button>
          <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />
          {t('actions.addMember')}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => (
          <Card key={stat.labelKey}>
            <CardHeader>
              <CardDescription>{t(stat.labelKey)}</CardDescription>
              <CardTitle className="text-2xl">{stat.value}</CardTitle>
              <CardAction>
                <HugeiconsIcon
                  icon={stat.icon}
                  className="text-muted-foreground"
                />
              </CardAction>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">
                <HugeiconsIcon icon={ArrowUp01Icon} data-icon="inline-start" />
                {stat.delta}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('traffic.title')}</CardTitle>
            <CardDescription>{t('traffic.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <BarChart data={TRAFFIC}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="morning" fill="var(--color-morning)" radius={4} />
                <Bar dataKey="evening" fill="var(--color-evening)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('checkIns.title')}</CardTitle>
            <CardDescription>{t('checkIns.description')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {CHECK_INS.map((entry, index) => (
              <div key={entry.name} className="flex flex-col gap-4">
                {index > 0 && <Separator />}
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{initials(entry.name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{entry.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {entry.at}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">{t('tabs.members')}</TabsTrigger>
          <TabsTrigger value="classes">{t('tabs.classes')}</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>{t('members.title')}</CardTitle>
              <CardDescription>{t('members.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={memberColumns}
                data={pagedMembers}
                tableState={tableState}
                setTableState={setTableState}
                isLoading={false}
                searchPlaceholder={t('actions.searchMembers')}
                filters={[
                  {
                    field: 'status',
                    title: t('members.columns.status'),
                    multiple: true,
                    options: [
                      { label: t('status.active'), value: 'active' },
                      { label: t('status.expiring'), value: 'expiring' },
                      { label: t('status.lapsed'), value: 'lapsed' },
                      { label: t('status.frozen'), value: 'frozen' },
                    ],
                  },
                ]}
                paginationInfo={{
                  page: currentPage,
                  limit: tableState.limit,
                  total: filteredMembers.length,
                  totalPages,
                  hasNext: currentPage < totalPages,
                  hasPrev: currentPage > 1,
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="classes">
          <Card>
            <CardHeader>
              <CardTitle>{t('classes.title')}</CardTitle>
              <CardDescription>{t('classes.description')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {CLASSES.map((session) => (
                <div key={session.name} className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">
                      <HugeiconsIcon
                        icon={Clock01Icon}
                        data-icon="inline-start"
                      />
                      {session.time}
                    </Badge>
                    <span className="text-sm font-medium">{session.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {session.trainer}
                    </span>
                    <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                      {session.booked}/{session.capacity}
                    </span>
                  </div>
                  <Progress value={(session.booked / session.capacity) * 100}>
                    <ProgressTrack>
                      <ProgressIndicator />
                    </ProgressTrack>
                  </Progress>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export const Route = createFileRoute('/')({
  component: Dashboard,
});
