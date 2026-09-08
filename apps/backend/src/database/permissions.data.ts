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
  {
    name: 'checkin.override',
    displayName: 'Admit members without a membership',
    description:
      'Let someone train when nothing covers today — expired, not yet ' +
      'started, or never bought one. The check-in is recorded with no ' +
      'membership and the override is stamped with who allowed it.\n\n' +
      'It deliberately does NOT lift a suspension. Being barred from the ' +
      'premises is a manager’s decision about the person, not a billing ' +
      'state, and it can only be lifted on the member record itself.',
    group: 'Attendance',
  },

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

  // Membership plans — the products the gym sells. No plan.delete, the same
  // deliberate gap as branch.delete: every membership ever sold points at a
  // plan, so retiring one is an isActive flip and therefore plan.update.
  {
    name: 'plan.list',
    displayName: 'View membership plans',
    group: 'Membership plans',
  },
  {
    name: 'plan.create',
    displayName: 'Create membership plans',
    group: 'Membership plans',
  },
  {
    name: 'plan.update',
    displayName: 'Edit and retire membership plans',
    description:
      'Also what retiring a plan needs: plans are never deleted, they are ' +
      'flipped to inactive so sold memberships still resolve.',
    group: 'Membership plans',
  },

  // Memberships — the periods of cover sold to members. No update and no
  // delete, the same deliberate gap as plans: a mistaken sale is voided with
  // its payment, never edited, so there is nothing for those to gate.
  {
    name: 'membership.list',
    displayName: 'View memberships',
    description:
      'See a member’s history of periods sold. Separate from member.read: the ' +
      'front desk needs the identity of a member without necessarily seeing ' +
      'what they have paid for.',
    group: 'Memberships',
  },
  {
    name: 'membership.sell',
    displayName: 'Sell memberships',
    description:
      'Sell a period of cover. The price is snapshotted from the plan, and ' +
      'the seller is taken from the signed-in user.',
    group: 'Memberships',
  },

  // Payments — money received. No payment.update and no payment.delete: a
  // mistaken payment is voided, which keeps the row and its reason on the
  // record, so there is nothing for either to gate.
  {
    name: 'payment.list',
    displayName: 'View payments',
    description:
      'See payments and the shift total. Includes voided ones — a reversal ' +
      'is part of what a reconciliation has to add up.',
    group: 'Payments',
  },
  {
    name: 'payment.record',
    displayName: 'Record payments',
    description:
      'Take money at the desk. The cashier is taken from the signed-in user ' +
      'and the branch from the member’s home gym.',
    group: 'Payments',
  },
  {
    name: 'payment.void',
    displayName: 'Void payments',
    description:
      'Reverse a payment taken by mistake. Deliberately separate from ' +
      'recording one: taking money and unwinding it are different acts, and ' +
      'the second is the one worth restricting.',
    group: 'Payments',
  },

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

  // Messaging. Three permissions rather than one, because they are three
  // different sizes of mistake: a wrong number costs one message, a wrong bulk
  // send costs one per member and reaches all of them, and a wrong reminder
  // setting quietly texts every expiring member every day until someone
  // notices the bill.
  {
    name: 'sms.send',
    displayName: 'Send a message',
    description: 'Text one number — a member, or anybody else.',
    group: 'Messaging',
  },
  {
    name: 'sms.broadcast',
    displayName: 'Send to many',
    description:
      'Text every member, or every member on one plan. Separate from ' +
      'sms.send because the cost and the reach are of a different order.',
    group: 'Messaging',
  },
  {
    name: 'sms.settings',
    displayName: 'Manage automatic reminders',
    description:
      'Turn expiry reminders on or off and set how many days ahead they ' +
      'start. Nobody presses send for these, which is why they are gated ' +
      'apart from the two above.',
    group: 'Messaging',
  },
  {
    name: 'sms.list',
    displayName: 'View message history',
    description: 'Read what has been sent, to whom, and whether it arrived.',
    group: 'Messaging',
  },
];
