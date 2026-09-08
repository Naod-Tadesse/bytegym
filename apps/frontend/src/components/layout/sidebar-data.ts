import {
  Building03Icon,
  Calendar03Icon,
  Home09Icon,
  Invoice03Icon,
  Message01Icon,
  ShieldKeyIcon,
  ShieldUserIcon,
  Ticket01Icon,
  UserCheck01Icon,
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
  | 'nav.checkIns'
  | 'nav.attendance'
  | 'nav.members'
  | 'nav.payments'
  | 'nav.membershipPlans'
  | 'nav.sms'
  | 'nav.staff'
  | 'nav.users'
  | 'nav.roles'
  | 'nav.branches';

type NavGroupTitleKey = 'nav.groups.overview' | 'nav.groups.admin';

export interface NavItem {
  titleKey: NavTitleKey;
  url: string;
  icon: IconType;
  /** Hidden unless the signed-in user holds this permission. */
  requiredPermission?: string;
}

export interface NavGroup {
  titleKey: NavGroupTitleKey;
  items: NavItem[];
}

/**
 * Only routes that exist. Classes and reports are not built yet — add them back
 * here as each ships, together with their `nav.*` keys and a
 * `requiredPermission`, rather than linking to a 404.
 *
 * Groups no longer render as headings (the sidebar is a flat list), but they
 * still drive the header breadcrumb — "Admin / Branches".
 */
export const navGroups: NavGroup[] = [
  {
    titleKey: 'nav.groups.overview',
    items: [{ titleKey: 'nav.dashboard', url: '/', icon: Home09Icon }],
  },
  {
    titleKey: 'nav.groups.admin',
    items: [
      // First in the group: this is the screen the desk lives on all day, and
      // every other admin screen is something you go to occasionally.
      {
        titleKey: 'nav.checkIns',
        url: '/check-ins',
        icon: UserCheck01Icon,
        requiredPermission: 'checkin.list',
      },
      // Directly after Check-ins, because it is the record that screen
      // produces: the desk admits people, this answers who came in. Same
      // permission, opposite direction. `/attendance` shares no segment prefix
      // with anything else here, so `isNavActive` has nothing to disambiguate.
      {
        titleKey: 'nav.attendance',
        url: '/attendance',
        icon: Calendar03Icon,
        requiredPermission: 'checkin.list',
      },
      // Above Staff: the roster answers "who works here", but Members is the
      // screen the front desk actually lives on.
      {
        titleKey: 'nav.members',
        url: '/members',
        icon: UserGroupIcon,
        requiredPermission: 'member.list',
      },
      // The money half of the same front-desk story, so it follows Members
      // directly. `isNavActive` matches on segment boundaries, so this cannot
      // light up for a future `/payment-methods`.
      {
        titleKey: 'nav.payments',
        url: '/payments',
        icon: Invoice03Icon,
        requiredPermission: 'payment.list',
      },
      // The catalogue a membership is sold from, so it sits beside Members
      // rather than down with the access-control screens.
      {
        titleKey: 'nav.membershipPlans',
        url: '/membership-plans',
        icon: Ticket01Icon,
        requiredPermission: 'plan.list',
      },
      // After the front-desk screens and before the admin ones: messaging is
      // something the desk does about members, not a settings page. Gated on
      // sms.list, the weakest of the four — the page's cards gate themselves,
      // so somebody who may only read the log still has a screen worth opening.
      {
        titleKey: 'nav.sms',
        url: '/sms',
        icon: Message01Icon,
        requiredPermission: 'sms.list',
      },
      {
        titleKey: 'nav.staff',
        url: '/staff',
        icon: UserIcon,
        requiredPermission: 'staff.list',
      },
      // Users sits beside Roles, not beside Staff: it answers "who can sign
      // in and as what", which is the access half of the same admin story.
      {
        titleKey: 'nav.users',
        url: '/users',
        icon: ShieldUserIcon,
        requiredPermission: 'user.list',
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
