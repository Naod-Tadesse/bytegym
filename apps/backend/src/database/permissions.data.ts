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

  {
    name: 'staff.grantAccess',
    displayName: 'Grant system access',
    description:
      'Give an employee a login for the first time. Deliberately separate ' +
      'from resetting a password: helping someone locked out and handing ' +
      'someone access are different acts.',
    group: 'Staff',
  },
  {
    name: 'staff.revokeAccess',
    displayName: 'Revoke system access',
    description:
      'Delete an employee login. They stay on the roster; they just cannot ' +
      'sign in any more, and their role grants go with the account.',
    group: 'Staff',
  },

  // Access control
  {
    name: 'user.list',
    displayName: 'View system users',
    description:
      'See who can sign in. Distinct from staff.list: the roster includes ' +
      'people with no login, and who holds an account is an access-control ' +
      'question rather than an HR one.',
    group: 'Access control',
  },
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

  // Job titles — read only. The catalogue is code (job-titles.data.ts), so
  // there is nothing to create or edit through the API.
  {
    name: 'jobTitle.list',
    displayName: 'View job titles',
    description:
      'Needed to pick a title when adding or editing staff. There is no ' +
      'create or update permission: the catalogue lives in code.',
    group: 'Job titles',
  },

  // Reporting
  { name: 'report.view', displayName: 'View reports', group: 'Reporting' },
];
