import type { NewPermission } from './schema';

/**
 * Every permission the app knows about. `name` is the key checked in code
 * (`resource.action`); `group` only buckets them in the admin UI.
 *
 * Adding one here and re-running the seed is safe — the seed is idempotent.
 */
export const SEED_PERMISSIONS: NewPermission[] = [
  // Members
  { name: 'member.list', displayName: 'View members', group: 'Members' },
  { name: 'member.read', displayName: 'View member detail', group: 'Members' },
  { name: 'member.create', displayName: 'Register members', group: 'Members' },
  { name: 'member.update', displayName: 'Edit members', group: 'Members' },
  { name: 'member.delete', displayName: 'Remove members', group: 'Members' },

  // Attendance
  {
    name: 'checkin.record',
    displayName: 'Record check-ins',
    group: 'Attendance',
  },
  { name: 'checkin.list', displayName: 'View check-ins', group: 'Attendance' },

  // Staff
  { name: 'staff.list', displayName: 'View staff', group: 'Staff' },
  { name: 'staff.read', displayName: 'View staff detail', group: 'Staff' },
  { name: 'staff.create', displayName: 'Add staff', group: 'Staff' },
  { name: 'staff.update', displayName: 'Edit staff', group: 'Staff' },
  { name: 'staff.terminate', displayName: 'Terminate staff', group: 'Staff' },
  {
    name: 'staff.resetPassword',
    displayName: 'Reset staff passwords',
    description:
      'Set a new password for another staff member without knowing their old ' +
      'one, for when they are locked out. Signs them out everywhere.',
    group: 'Staff',
  },

  // Access control
  { name: 'role.list', displayName: 'View roles', group: 'Access control' },
  { name: 'role.create', displayName: 'Create roles', group: 'Access control' },
  { name: 'role.update', displayName: 'Edit roles', group: 'Access control' },
  { name: 'role.delete', displayName: 'Delete roles', group: 'Access control' },
  {
    name: 'role.assign',
    displayName: 'Assign roles to staff',
    group: 'Access control',
  },

  // Branches
  { name: 'branch.list', displayName: 'View branches', group: 'Branches' },
  { name: 'branch.create', displayName: 'Create branches', group: 'Branches' },
  { name: 'branch.update', displayName: 'Edit branches', group: 'Branches' },

  // Reporting
  { name: 'report.view', displayName: 'View reports', group: 'Reporting' },
];
