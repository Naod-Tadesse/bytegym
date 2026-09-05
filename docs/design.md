// ============================================================
// GYM MANAGEMENT
// Single gym per deployment. Multi branch. Paste into dbdiagram.io
// ============================================================

Project gym {
database_type: 'PostgreSQL'
}

// ---------------- ENUMS ----------------

Enum account_status {
active
disabled
}

Enum gender_type {
male
female
}

Enum employment_status {
active
on_leave
terminated
}

Enum data_scope {
branch
all
}

Enum session_audience {
staff
member
}

Enum verification_purpose {
login_otp
phone_change
}

Enum payment_method {
cash
telebirr
cbe_birr
bank_transfer
card
}

Enum payment_kind {
membership
registration
other
}

// ---------------- BRANCHES ----------------

Table branches {
id uuid [pk, default: `gen_random_uuid()`]
name varchar(120) [not null, unique]
address_line varchar(255)
city varchar(80)
phone varchar(30)
is_active boolean [not null, default: true]
created_at timestamptz [not null, default: `now()`]
updated_at timestamptz [not null, default: `now()`]
}

// ---------------- IDENTITY ----------------

Table person {
id uuid [pk, default: `gen_random_uuid()`]
first_name varchar(80) [not null]
last_name varchar(80) [not null]
phone varchar(30) [not null, unique]
date_of_birth date
gender gender_type
registered_by_person_id uuid
created_at timestamptz [not null, default: `now()`]
updated_at timestamptz [not null, default: `now()`]
deleted_at timestamptz
}

Table job_titles {
id uuid [pk, default: `gen_random_uuid()`]
code varchar(40) [not null, unique]
name varchar(80) [not null, unique]
can_have_account boolean [not null, default: false]
is_active boolean [not null, default: true]
created_at timestamptz [not null, default: `now()`]
updated_at timestamptz [not null, default: `now()`]
}

Table staff {
person_id uuid [pk]
staff_code varchar(24) [not null, unique]
primary_branch_id uuid [not null]
job_title_id uuid [not null]
data_scope data_scope [not null, default: 'branch']
employment_status employment_status [not null, default: 'active']
hired_on date [not null]
terminated_on date
created_at timestamptz [not null, default: `now()`]
updated_at timestamptz [not null, default: `now()`]
}

Table member {
person_id uuid [pk]
member_code varchar(24) [not null, unique]
branch_id uuid [not null]
is_suspended boolean [not null, default: false]
suspension_reason varchar(255)
emergency_contact_name varchar(120)
emergency_contact_phone varchar(30)
created_at timestamptz [not null, default: `now()`]
updated_at timestamptz [not null, default: `now()`]

indexes {
branch_id
}
}

// ---------------- AUTHENTICATION ----------------

Table accounts {
id uuid [pk, default: `gen_random_uuid()`]
person_id uuid [not null, unique]
status account_status [not null, default: 'active']
password_hash text
last_login_at timestamptz
created_at timestamptz [not null, default: `now()`]
updated_at timestamptz [not null, default: `now()`]
}

Table verification {
id uuid [pk, default: `gen_random_uuid()`]
identifier varchar(30) [not null]
purpose verification_purpose [not null]
code_hash char(64) [not null]
expires_at timestamptz [not null]
consumed_at timestamptz
attempts int [not null, default: 0]
created_at timestamptz [not null, default: `now()`]

indexes {
(identifier, purpose)
expires_at
}
}

Table sessions {
id uuid [pk, default: `gen_random_uuid()`]
person_id uuid [not null]
audience session_audience [not null]
access_token_hash char(64) [unique]
access_token_expires_at timestamptz
refresh_token_hash char(64) [not null, unique]
refresh_token_expires_at timestamptz [not null]
revoked_at timestamptz
created_at timestamptz [not null, default: `now()`]

indexes {
(person_id, revoked_at)
(person_id, audience, revoked_at)
}
}

// ---------------- MEMBERSHIP ----------------

Table membership_plans {
id uuid [pk, default: `gen_random_uuid()`]
name varchar(120) [not null, unique]
description varchar(500)
duration_days int [not null]
price numeric(12,2) [not null]
session_quota int
is_active boolean [not null, default: true]
created_at timestamptz [not null, default: `now()`]
updated_at timestamptz [not null, default: `now()`]
}

Table memberships {
id uuid [pk, default: `gen_random_uuid()`]
member_id uuid [not null]
plan_id uuid [not null]
starts_on date [not null, default: `current_date`]
ends_on date [not null]
price numeric(12,2) [not null]
session_quota int
sessions_used int [not null, default: 0]
is_complimentary boolean [not null, default: false]
sold_by_staff_id uuid
created_at timestamptz [not null, default: `now()`]
updated_at timestamptz [not null, default: `now()`]
deleted_at timestamptz

indexes {
(member_id, ends_on)
ends_on
}
}

Table payments {
id uuid [pk, default: `gen_random_uuid()`]
member_id uuid [not null]
membership_id uuid
branch_id uuid [not null]
kind payment_kind [not null, default: 'membership']
amount numeric(12,2) [not null]
method payment_method [not null]
reference varchar(80)
received_by_staff_id uuid [not null]
received_at timestamptz [not null, default: `now()`]
note varchar(255)
voided_at timestamptz
voided_by_staff_id uuid
void_reason varchar(255)
created_at timestamptz [not null, default: `now()`]

indexes {
membership_id
(member_id, received_at)
(branch_id, received_at)
}
}

Table membership_freezes {
id uuid [pk, default: `gen_random_uuid()`]
membership_id uuid [not null]
starts_on date [not null]
ends_on date [not null]
reason varchar(255)
created_by_staff_id uuid [not null]
created_at timestamptz [not null, default: `now()`]
cancelled_at timestamptz

indexes {
(membership_id, starts_on)
}
}

// ---------------- AUTHORIZATION ----------------

Table roles {
id uuid [pk, default: `gen_random_uuid()`]
name varchar(255) [not null]
description varchar(500)
is_active boolean [not null, default: true]
deleted_at timestamptz
created_at timestamptz [not null, default: `now()`]
updated_at timestamptz [not null, default: `now()`]
}

Table permissions {
id uuid [pk, default: `gen_random_uuid()`]
name varchar(255) [not null, unique]
display_name varchar(255) [not null]
description varchar(500)
group varchar(100) [not null]
created_at timestamptz [not null, default: `now()`]
}

Table role_permissions {
role_id uuid [not null]
permission_id uuid [not null]

indexes {
(role_id, permission_id) [pk]
}
}

Table account_roles {
id uuid [pk, default: `gen_random_uuid()`]
account_id uuid [not null]
role_id uuid [not null]
created_at timestamptz [not null, default: `now()`]

indexes {
(account_id, role_id) [unique]
}
}

// ---------------- ATTENDANCE ----------------

Table check_ins {
id bigint [pk, increment]
member_id uuid [not null]
membership_id uuid
branch_id uuid [not null]
recorded_by_person_id uuid
override_by_staff_id uuid
checked_in_at timestamptz [not null, default: `now()`]
checked_out_at timestamptz

indexes {
(member_id, checked_in_at)
(branch_id, checked_in_at)
membership_id
}
}

// ---------------- AUDIT ----------------

Table audit_logs {
id bigint [pk, increment]
actor_person_id uuid
action varchar(80) [not null]
entity_type varchar(60) [not null]
entity_id varchar(64) [not null]
changes jsonb
ip_address inet
created_at timestamptz [not null, default: `now()`]

indexes {
(entity_type, entity_id)
created_at
}
}

// ---------------- RELATIONSHIPS ----------------

Ref: person.registered_by_person_id > person.id

Ref: member.person_id - person.id
Ref: member.branch_id > branches.id
Ref: staff.person_id - person.id
Ref: staff.primary_branch_id > branches.id
Ref: staff.job_title_id > job_titles.id

Ref: accounts.person_id - person.id
Ref: sessions.person_id > person.id

Ref: memberships.member_id > member.person_id
Ref: memberships.plan_id > membership_plans.id
Ref: memberships.sold_by_staff_id > staff.person_id

Ref: payments.member_id > member.person_id
Ref: payments.membership_id > memberships.id
Ref: payments.branch_id > branches.id
Ref: payments.received_by_staff_id > staff.person_id
Ref: payments.voided_by_staff_id > staff.person_id

Ref: membership_freezes.membership_id > memberships.id
Ref: membership_freezes.created_by_staff_id > staff.person_id

Ref: role_permissions.role_id > roles.id
Ref: role_permissions.permission_id > permissions.id
Ref: account_roles.account_id > accounts.id
Ref: account_roles.role_id > roles.id

Ref: check_ins.member_id > member.person_id
Ref: check_ins.membership_id > memberships.id
Ref: check_ins.branch_id > branches.id
Ref: check_ins.recorded_by_person_id > person.id
Ref: check_ins.override_by_staff_id > staff.person_id

Ref: audit_logs.actor_person_id > person.id

// ---------------- STATUS LIVES WITH WHAT IT DESCRIBES ----------------
//
// There is deliberately NO person.status. Every state anyone reaches for
// belongs to something more specific, and a column on person would only
// duplicate one of them and then drift:
//
//   Can they sign in      accounts.status        active | disabled
//   Barred from the gym   member.is_suspended    + suspension_reason
//   Still employed        staff.employment_status
//
// accounts.status is an enum, not a boolean, because a third state is coming:
// `locked`, set automatically after repeated failed sign-ins. Admin-disabled
// and auto-locked want different messages and different ways back in.
//
// member.is_suspended is a boolean because it has exactly two states and always
// will. Note what it is NOT: whether a member is active, expired or frozen is
// DERIVED from memberships and membership_freezes, never stored. Storing it
// would need a nightly job, and the day that job fails the column lies — the
// same trap as the old membership_periods.left_on.
//
//   active / frozen / expired / never   computed, returned on the member
//                                       response, never a column
//   suspended                           stored, because a human decided it
//
// DISABLE vs REVOKE on a login: disabling keeps the password, so re-enabling
// hands back the credential they already know; revoking deletes the accounts
// row and the role grants cascade with it. Disable a suspension you mean to
// lift; revoke when access should stop existing.

// ---------------- CONSTRAINTS DBML CANNOT EXPRESS ----------------
//
// CREATE UNIQUE INDEX roles_name_active_uniq ON roles (name)
//   WHERE deleted_at IS NULL;
//
// CREATE EXTENSION IF NOT EXISTS btree_gist;
// ALTER TABLE memberships ADD CONSTRAINT memberships_no_overlap
//   EXCLUDE USING gist (
//     member_id WITH =,
//     daterange(starts_on, ends_on, '[]') WITH &&
//   ) WHERE (deleted_at IS NULL);
//
// job_titles is a CODE catalogue, like permissions — seeded from
// src/database/job-titles.data.ts, with no API to create or edit one. Anything
// the application branches on cannot be user-typed, or "Senior Trainer" and
// "Trainner" silently get none of the behaviour attached to trainers.
//
//   code          name          can_have_account
//   owner         Owner         true
//   manager       Manager       true
//   receptionist  Receptionist  true
//   trainer       Trainer       false
//   cleaner       Cleaner       false
//
// TWO RULES for anything built on this:
//   1. Branch on `code`, never on `name`. The name is a label a gym may rename;
//      the code never changes.
//   2. Prefer a capability FLAG over a code comparison. can_have_account is the
//      pattern — when trainers gain meal plans, add can_train_members rather
//      than scattering code = 'trainer' about, so a gym that calls them Coaches
//      still works. Permissions answer "may they do X"; these answer "what are
//      they".
