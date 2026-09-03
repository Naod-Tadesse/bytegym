import {
  Analytics01Icon,
  Building03Icon,
  Calendar03Icon,
  Home09Icon,
  Login03Icon,
  ShieldKeyIcon,
  UserGroupIcon,
  UserIcon,
} from '@hugeicons/core-free-icons';

type IconType = typeof Home09Icon;

/**
 * Full i18n keys, not fragments. `strictKeyChecks` rejects keys built with
 * template literals, so `t(item.titleKey)` needs the whole key up front.
 */
type NavTitleKey =
  | 'nav.dashboard'
  | 'nav.members'
  | 'nav.checkIns'
  | 'nav.classes'
  | 'nav.reports'
  | 'nav.staff'
  | 'nav.roles'
  | 'nav.branches';

type NavGroupTitleKey =
  | 'nav.groups.overview'
  | 'nav.groups.members'
  | 'nav.groups.operations'
  | 'nav.groups.admin';

export interface NavItem {
  titleKey: NavTitleKey;
  url: string;
  icon: IconType;
  /** Hidden unless the signed-in user holds this permission. */
  requiredPermission?: string;
  /** Marks the row that shows the live check-in badge. */
  showCheckInBadge?: boolean;
}

export interface NavGroup {
  titleKey: NavGroupTitleKey;
  items: NavItem[];
}

/**
 * Grouped rather than one flat list, so the sidebar stays legible as the gym
 * domain grows. Groups whose items are all permission-filtered away are not
 * rendered at all.
 */
export const navGroups: NavGroup[] = [
  {
    titleKey: 'nav.groups.overview',
    items: [{ titleKey: 'nav.dashboard', url: '/', icon: Home09Icon }],
  },
  {
    titleKey: 'nav.groups.members',
    items: [
      {
        titleKey: 'nav.members',
        url: '/members',
        icon: UserGroupIcon,
        requiredPermission: 'member.list',
      },
      {
        titleKey: 'nav.checkIns',
        url: '/check-ins',
        icon: Login03Icon,
        requiredPermission: 'checkin.list',
        showCheckInBadge: true,
      },
    ],
  },
  {
    titleKey: 'nav.groups.operations',
    items: [
      {
        titleKey: 'nav.classes',
        url: '/classes',
        icon: Calendar03Icon,
      },
      {
        titleKey: 'nav.reports',
        url: '/reports',
        icon: Analytics01Icon,
        requiredPermission: 'report.view',
      },
    ],
  },
  {
    titleKey: 'nav.groups.admin',
    items: [
      {
        titleKey: 'nav.staff',
        url: '/staff',
        icon: UserIcon,
        requiredPermission: 'staff.list',
      },
      {
        titleKey: 'nav.roles',
        url: '/roles',
        icon: ShieldKeyIcon,
        requiredPermission: 'role.list',
      },
      {
        titleKey: 'nav.branches',
        url: '/branches',
        icon: Building03Icon,
        requiredPermission: 'branch.list',
      },
    ],
  },
];
