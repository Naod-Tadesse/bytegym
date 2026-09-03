// ============================================================
// GYM MANAGEMENT — AUTH
// Single gym per deployment. Multi branch. Paste into dbdiagram.io
// One row per human. Staff and member are profiles, not a type column.
// ============================================================

Project gym_auth {
database_type: 'PostgreSQL'
Note: 'Staff log in with phone and password. Members do not log in. A person can be staff and member at the same time. Identity is permanent and separate from status: member_profiles says someone has ever been a member, membership_periods says whether they are one now.'
}

// ---------------- ENUMS ----------------

Enum user_status {
active
suspended [note: 'barred from the premises entirely, not the same as being fired']
deactivated
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

Table users {
id uuid [pk, default: `gen_random_uuid()`]
first_name varchar(80) [not null]
last_name varchar(80) [not null]
phone varchar(30) [not null, unique, note: 'login handle for staff, contact handle for members. store one normalised format']
password_hash text [note: 'bcrypt. NULL means this person cannot log in, which is every member']
date_of_birth date
gender gender_type
status user_status [not null, default: 'active']
last_login_at timestamptz
registered_by_user_id uuid [note: 'the staff member who created this record']
created_at timestamptz [not null, default: `now()`]
updated_at timestamptz [not null, default: `now()`]
deleted_at timestamptz [note: 'soft delete, history must survive']

indexes {
status
}

Note: 'One row per human, forever. There is NO user_type column. What a person is comes from which profile rows exist.'
}

Table member_profiles {
user_id uuid [pk]
member_code varchar(24) [not null, unique, note: 'e.g. MBR-000123. follows the human forever, across every join and rejoin']
emergency_contact_name varchar(120)
emergency_contact_phone varchar(30)
created_at timestamptz [not null, default: `now()`]
updated_at timestamptz [not null, default: `now()`]

Note: 'The existence of this row is what makes someone a member, ever. It is the stable identity and the FK target for check_ins. Whether they are a member RIGHT NOW is a question about membership_periods, not about this row.'
}

Table membership_periods {
id uuid [pk, default: `gen_random_uuid()`]
user_id uuid [not null]
home_branch_id uuid [not null]
all_branches_access boolean [not null, default: false]
is_complimentary boolean [not null, default: false, note: 'staff who train free. a fact about this stint, not about the job']
joined_on date [not null, default: `current_date`]
left_on date [note: 'set when they stop training here. never delete the row']
created_at timestamptz [not null, default: `now()`]
updated_at timestamptz [not null, default: `now()`]

indexes {
(user_id, joined_on)
left_on
}

Note: 'One row per stint. Lapse-and-return is normal gym behaviour, so a member who leaves in 2024 and rejoins in 2026 gets two rows and both are preserved. Enforce at most one OPEN period per member with a partial unique index, which DBML cannot express: CREATE UNIQUE INDEX ON membership_periods (user_id) WHERE left_on IS NULL. A member is active today when a row exists with left_on IS NULL. Home branch and complimentary status live here because they can differ between stints.'
}

Table staff_profiles {
user_id uuid [pk]
staff_code varchar(24) [not null, unique]
primary_branch_id uuid [not null]
job_title varchar(80) [not null, note: 'display label only, permissions come from roles']
employment_status employment_status [not null, default: 'active']
hired_on date [not null]
terminated_on date
created_at timestamptz [not null, default: `now()`]
updated_at timestamptz [not null, default: `now()`]

Note: 'The existence of this row is what makes someone staff. Terminated staff keep the row so history survives. Firing someone must not touch users.status.'
}

// ---------------- AUTHORIZATION ----------------

Table roles {
id uuid [pk, default: `gen_random_uuid()`]
name varchar(255) [not null, note: 'owner, manager, receptionist, trainer']
description varchar(500)
is_active boolean [not null, default: true]
deleted_at timestamptz
created_at timestamptz [not null, default: `now()`]
updated_at timestamptz [not null, default: `now()`]

Note: 'Roles carry no fields of their own, only permissions. No member role here, that is the profile row. name is NOT plainly unique because this table soft deletes: use a partial unique index so a deleted role does not squat the name forever. CREATE UNIQUE INDEX ON roles (name) WHERE deleted_at IS NULL.'
}

Table permissions {
id uuid [pk, default: `gen_random_uuid()`]
name varchar(255) [not null, unique, note: 'the key checked in code, e.g. member.create']
display_name varchar(255) [not null]
description varchar(500)
group varchar(100) [not null, note: 'how the permission is bucketed in the admin UI, e.g. Members, Billing']
created_at timestamptz [not null, default: `now()`]

Note: 'No soft delete here, so a plain unique on name is safe. WARNING: "group" is a reserved word in SQL and must be double quoted in raw queries. Drizzle quotes identifiers for you, so this only bites in hand written SQL and psql.'
}

Table role_permissions {
role_id uuid [not null]
permission_id uuid [not null]

indexes {
(role_id, permission_id) [pk]
}

Note: 'Composite PK, no surrogate id. Granting the same permission twice is meaningless, so the PK is the constraint.'
}

Table user_roles {
id uuid [pk, default: `gen_random_uuid()`]
staff_id uuid [not null, note: 'FK to staff_profiles, so only staff can hold a role at all']
role_id uuid [not null]
created_at timestamptz [not null, default: `now()`]

indexes {
(staff_id, role_id) [unique]
}

Note: 'Roles are gym wide. Branch scoping was deliberately dropped: a role applies everywhere the staff member works, and which branches those are comes from staff_profiles.primary_branch_id. Revoking is a delete. Pointing at staff_profiles rather than users means a member cannot be granted a role, enforced by the FK rather than by app code.'
}

Table sessions {
id uuid [pk, default: `gen_random_uuid()`]
user_id uuid [not null]
refresh_token_hash char(64) [not null, unique, note: 'store the hash, never the token']
expires_at timestamptz [not null]
revoked_at timestamptz
created_at timestamptz [not null, default: `now()`]

indexes {
(user_id, revoked_at)
}

Note: 'Only here so logout and force-logout work. Drop this table if you go with short lived stateless tokens.'
}

// ---------------- ATTENDANCE ----------------

Table check_ins {
id bigint [pk, increment]
member_user_id uuid [not null, note: 'FK points at member_profiles, so a non member physically cannot have a check in']
branch_id uuid [not null]
recorded_by_user_id uuid [note: 'the staff member who logged the entry']
checked_in_at timestamptz [not null, default: `now()`]
checked_out_at timestamptz

indexes {
(member_user_id, checked_in_at)
(branch_id, checked_in_at)
}

Note: 'Members only. Staff shifts are different data and belong in their own table if you ever need them. The FK still points at member_profiles rather than membership_periods on purpose: it must enforce is a member without breaking when someone checks in on the day a stint opens or closes. Which period a check in fell inside is derivable from checked_in_at. The FK enforces is a member, not is paid up, which is app logic once plans exist.'
}

// ---------------- AUDIT ----------------

Table audit_logs {
id bigint [pk, increment]
actor_user_id uuid
action varchar(80) [not null, note: 'user.created, role.granted, staff.terminated']
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

Ref: users.registered_by_user_id > users.id

Ref: member_profiles.user_id - users.id
Ref: membership_periods.user_id > member_profiles.user_id
Ref: membership_periods.home_branch_id > branches.id
Ref: staff_profiles.user_id - users.id
Ref: staff_profiles.primary_branch_id > branches.id

Ref: role_permissions.role_id > roles.id
Ref: role_permissions.permission_id > permissions.id
Ref: user_roles.staff_id > staff_profiles.user_id
Ref: user_roles.role_id > roles.id

Ref: sessions.user_id > users.id

Ref: check_ins.member_user_id > member_profiles.user_id
Ref: check_ins.branch_id > branches.id
Ref: check_ins.recorded_by_user_id > users.id

Ref: audit_logs.actor_user_id > users.id
