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
  Dumbbell01Icon,
  Login03Icon,
  MoreHorizontalIcon,
  Search01Icon,
  SnowIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { useTranslation } from 'react-i18next';

import { ModeToggle } from '@/components/mode-toggle';
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
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

const MEMBERS: Array<{
  name: string;
  plan: string;
  status: MembershipStatus;
  lastVisit: string;
}> = [
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

function Dashboard() {
  const { t } = useTranslation();

  // Depends on `t`, so it is built per render rather than at module scope.
  const chartConfig = {
    morning: { label: t('traffic.morning'), color: 'var(--chart-1)' },
    evening: { label: t('traffic.evening'), color: 'var(--chart-2)' },
  } satisfies ChartConfig;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <HugeiconsIcon icon={Dumbbell01Icon} />
            </div>
            <span className="text-lg font-semibold tracking-tight">
              {t('app.name')}
            </span>
          </div>

          <InputGroup className="ml-auto max-w-xs">
            <InputGroupAddon>
              <HugeiconsIcon icon={Search01Icon} />
            </InputGroupAddon>
            <InputGroupInput placeholder={t('actions.searchMembers')} />
          </InputGroup>

          <Button>
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />
            {t('actions.addMember')}
          </Button>

          <ModeToggle />
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
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
                  <HugeiconsIcon
                    icon={ArrowUp01Icon}
                    data-icon="inline-start"
                  />
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
                  <Bar
                    dataKey="morning"
                    fill="var(--color-morning)"
                    radius={4}
                  />
                  <Bar
                    dataKey="evening"
                    fill="var(--color-evening)"
                    radius={4}
                  />
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('members.columns.member')}</TableHead>
                      <TableHead>{t('members.columns.plan')}</TableHead>
                      <TableHead>{t('members.columns.status')}</TableHead>
                      <TableHead>{t('members.columns.lastVisit')}</TableHead>
                      <TableHead className="w-px" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MEMBERS.map((member) => (
                      <TableRow key={member.name}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>
                                {initials(member.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{member.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {member.plan}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={member.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {member.lastVisit}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon">
                            <HugeiconsIcon icon={MoreHorizontalIcon} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                      <span className="text-sm font-medium">
                        {session.name}
                      </span>
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
      </main>
    </div>
  );
}

export const Route = createFileRoute('/')({
  component: Dashboard,
});
