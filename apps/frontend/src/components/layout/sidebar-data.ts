import {
  Building03Icon,
  Home09Icon,
  ShieldKeyIcon,
  ShieldUserIcon,
  UserIcon,
} from '@hugeicons/core-free-icons';

type IconType = typeof Home09Icon;

/**
 * Full i18n keys, not fragments. `strictKeyChecks` rejects keys built with
 * template literals, so `t(item.titleKey)` needs the whole key up front.
 */
type NavTitleKey =
  'nav.dashboard' | 'nav.staff' | 'nav.users' | 'nav.roles' | 'nav.branches';

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
 * Only routes that exist. Members, check-ins, classes and reports are not
 * built yet — add them back here as each ships, together with their
 * `nav.*` keys and a `requiredPermission`, rather than linking to a 404.
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
