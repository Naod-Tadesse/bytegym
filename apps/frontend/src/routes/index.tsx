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
  active: { label: 'Active', variant: 'default', icon: CheckmarkCircle02Icon },
  expiring: { label: 'Expiring', variant: 'outline', icon: Alert02Icon },
  lapsed: { label: 'Lapsed', variant: 'destructive', icon: Cancel01Icon },
  frozen: { label: 'Frozen', variant: 'secondary', icon: SnowIcon },
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

const CHART_CONFIG = {
  morning: { label: 'Morning', color: 'var(--chart-1)' },
  evening: { label: 'Evening', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const STATS = [
  {
    label: 'Active members',
    value: '1,284',
    delta: '+3.2%',
    icon: UserGroupIcon,
  },
  { label: 'Check-ins today', value: '317', delta: '+8.1%', icon: Login03Icon },
  {
    label: 'Monthly revenue',
    value: '$48,290',
    delta: '+2.4%',
    icon: Dollar01Icon,
  },
  { label: 'Classes today', value: '12', delta: '+1', icon: Calendar03Icon },
];

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('');
}

function StatusBadge({ status }: { status: MembershipStatus }) {
  const { label, variant, icon } = MEMBERSHIP_STATUS[status];

  return (
    <Badge variant={variant}>
      <HugeiconsIcon icon={icon} data-icon="inline-start" />
      {label}
    </Badge>
  );
}

function Dashboard() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <HugeiconsIcon icon={Dumbbell01Icon} />
            </div>
            <span className="text-lg font-semibold tracking-tight">
              bytegym
            </span>
          </div>

          <InputGroup className="ml-auto max-w-xs">
            <InputGroupAddon>
              <HugeiconsIcon icon={Search01Icon} />
            </InputGroupAddon>
            <InputGroupInput placeholder="Search members…" />
          </InputGroup>

          <Button>
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />
            Add member
          </Button>

          <ModeToggle />
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <Card key={stat.label}>
              <CardHeader>
                <CardDescription>{stat.label}</CardDescription>
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
              <CardTitle>Gym traffic</CardTitle>
              <CardDescription>
                Check-ins per session, last 7 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={CHART_CONFIG} className="h-64 w-full">
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
              <CardTitle>Recent check-ins</CardTitle>
              <CardDescription>Live from the front desk</CardDescription>
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
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="classes">Classes</TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            <Card>
              <CardHeader>
                <CardTitle>Members</CardTitle>
                <CardDescription>
                  Every membership state pairs a colour with an icon, never
                  colour alone
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last visit</TableHead>
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
                <CardTitle>Today’s schedule</CardTitle>
                <CardDescription>Bookings against capacity</CardDescription>
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
