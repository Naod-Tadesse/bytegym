<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# bytegym

Gym management system. Two apps in an Nx monorepo: `@org/backend` (NestJS 11 + Drizzle +
Postgres) and `@org/frontend` (React 19 + Vite + TanStack).

## Commands

```bash
npx nx run @org/backend:db-up        # start postgres
npx nx run @org/backend:db-generate  # after editing schema
npx nx run @org/backend:db-migrate
npx nx run @org/backend:db-seed
npx nx run @org/backend:db-studio    # browse data
npx nx run @org/backend:serve

npx nx run-many -t lint typecheck build test
npx nx format:write
```

**`typecheck` is the only target that type-checks.** The backend build is webpack + ts-loader in
`transpileOnly` mode and Jest runs through `@swc/jest`, so a type error fails neither. Never
conclude "it builds, so it's fine".

---

# Backend — `apps/backend`

## Layout

One module per feature at `src/<feature>/`, each with `<feature>.module.ts`, `.controller.ts`,
`.service.ts` and `dto/`. Cross-cutting helpers live in `src/common/` — keep it **flat**, and it
must never import from `src/auth/` (that is the one way to create a cycle).

The hooks-vs-repository split does not exist here: controllers are thin, services own all data
access, and there is no repository layer.

## Database

- **Drizzle is pinned to `1.0.0-rc.4` on purpose.** The v1 API differs from 0.x — `drizzle({ client: pool })`,
  not `drizzle(pool, { schema })`. Do not "upgrade" it to a 0.x latest.
- Schema files in `src/database/schema/`, one per table, re-exported from `index.ts`.
- **Soft delete everywhere** (`deletedAt`) and every read filters `isNull(deletedAt)`. Branches are
  the exception: they have no `deletedAt` and are retired via `isActive`.
- Uniqueness on a soft-deleting table needs a **partial unique index**, so a deleted row does not
  hold its name forever:
  ```ts
  uniqueIndex('roles_name_active_uniq')
    .on(table.name)
    .where(sql`${table.deletedAt} is null`);
  ```
- **Case-insensitive comparison uses `lower(x) = lower(?)`, never `ilike`** — `_` and `%` are LIKE
  wildcards, so `ilike` would make `role_a` collide with `roleXa`. Throw `ConflictException`.
- `group` is a reserved SQL word. Drizzle quotes it; hand-written psql must too.

## Transactions

**Any write touching more than one table goes in `db.transaction(...)`.** A single-statement write
is already atomic — wrapping it adds nothing. Creating a staff member (person → accounts → staff →
account_roles) is the canonical example, and note the second step is conditional: no password means
no `accounts` row, which is how an employee with no login is created.

Three rules that are easy to get wrong, and have been:

**1. Every read and write inside a transaction must use the `tx` handle.** Calling a sibling method
that closes over `this.db` silently runs on a _different pooled connection_, outside the
transaction, where it cannot see the uncommitted writes. The symptom is a mutation endpoint that
returns pre-update data:

```ts
// WRONG — findOne uses this.db, so it reads the row as it was before the update
return this.db.transaction(async (tx) => {
  await tx.update(schema.users).set(...).where(...);
  return this.findOne(userId);
});

// RIGHT — the read joins the transaction
private async findOneWith(db: Database | Transaction, userId: string) { … }

return this.db.transaction(async (tx) => {
  await tx.update(schema.users).set(...).where(...);
  return this.findOneWith(tx, userId);
});
```

**2. Read the data a transaction depends on _inside_ it.** `roles.remove` selects the staff holding
a role, then opens a transaction to detach grants and revoke their sessions. Anyone granted the role
in that gap keeps a live token carrying a deleted role's permissions — exactly what the transaction
was written to prevent. Move the select inside.

**3. Uniqueness is enforced by the index, not by a pre-check — and a transaction does not fix
that.** `assertNameUnique`-style checks are a TOCTOU race: two concurrent requests both see "no
duplicate", both insert, and the unique index rejects the second with a raw Postgres error (a 500,
not a 409). Wrapping check-and-insert in a transaction changes nothing, because under READ COMMITTED
both transactions still see no duplicate. Keep the pre-check for the friendly common-case message,
and **also catch Postgres error `23505` and translate it to `ConflictException`**. Data integrity is
never at risk here — the index does its job either way; this is about returning the right status.

Sessions are part of the authorisation state: revoking a role or changing a staff member's roles
must revoke their sessions **in the same transaction** as the grant change.

## Pagination

Every list endpoint takes `PaginationDto` and returns **exactly** `{ data, meta: { total, page,
limit, totalPages } }` — the frontend `DataTable` reads `meta`. Use the existing helpers in
`src/common/paginate.ts` (`toOffset`, `paginated`, `countOf`); do not re-derive the offset maths
per service.

## Auth and authorisation

**Credentials live in `accounts`, not on `users`.** One row per human (`user_id` unique), holding
`password_hash` and `last_login_at` — nothing else. The *existence* of the row is the right to
authenticate: a cleaner is a full employee with **no** `accounts` row, so there is no nullable
column to forget to check. A member's row has a null `password_hash` and signs in by SMS code.
Revoking access is **deleting** the row, not soft-deleting — a revoked credential should stop
existing. There is deliberately no `provider` or `identifier` column: the endpoint already knows
the method, and login looks people up by `person.phone`, which is why that stays unique.

**Disable and revoke are different things.** `accounts.status` (`active` | `disabled`) switches a
login off while **keeping the password**, so re-enabling hands back the credential they already
know — that is the suspension you intend to lift, `PATCH /api/staff/:id/access`. Revoking
(`DELETE`) deletes the account row and cascades away their role grants. Both revoke live staff
sessions. It is an enum rather than a boolean because `locked` is coming, for automatic lockout
after failed sign-ins, which wants a different message and a different way back in.

**Status lives with the thing it describes — there is no `person.status`.** Every state anyone
reaches for belongs somewhere more specific, and a column on `person` would only duplicate one and
then drift:

| Question | Column |
| --- | --- |
| Can they sign in? | `accounts.status` |
| Barred from the premises? | `member.is_suspended` (when that table lands) |
| Still employed? | `staff.employment_status` |

And note what is **not** stored: whether a member is active, expired or has never joined is
**derived** from `memberships` at query time. Storing it would need a nightly job, and the day that
job fails the column lies — the same trap as the old `membership_periods.left_on`. Only `suspended`
is stored, because a human decided it.

**There is no membership freeze, and that is deliberate.** A freeze solves the recurring-contract
problem — a gym that auto-bills monthly has to let you skip one. Membership here is prepaid, so a
member who travels simply doesn't renew and buys again on their return; it's the same reasoning
that keeps dunning and proration out of this schema. The consequence is that `memberships.ends_on`
is set at sale and never moves, so there is no goodwill-extension mechanism. If that ever needs
solving, it's a permissioned edit of `ends_on` with an audit entry — not a freeze table.

**Two audiences, two signing secrets.** `/auth/login` (staff, password) signs with `JWT_SECRET`;
`/app/auth/login` (member, SMS code) signs with `JWT_APP_SECRET`. A member token therefore fails
*verification* on the admin API rather than merely failing authorisation — which is what closes the
hole under "a route with no `@Permissions()` is authenticated-only". Never collapse this to a claim
the guard has to remember to check. Audience comes from **which profile row exists**, never from
the credential type.

Two global guards in `app.module.ts`, and **the order matters**: `JwtAuthGuard` (authenticate)
then `PermissionsGuard` (authorise). Both honour `@Public()`.

| Decorator             | Meaning                                                             |
| --------------------- | ------------------------------------------------------------------- |
| `@Public()`           | No token required                                                   |
| `@Permissions('x.y')` | Requires that permission — **and emits the OpenAPI bearer/401/403** |
| `@Authenticated()`    | Docs only: token required but no specific permission                |
| `@CurrentUser()`      | The authenticated user                                              |

- A route with **no** `@Permissions()` is authenticated-only. If it is also missing
  `@Authenticated()`, it will render as public in the spec — add one or the other.
- **Identity comes from the token, never the request body.** Pass `user.staffId` into the service;
  do not accept an actor id as a parameter.
- Revoking access means revoking sessions. Deleting a role, or changing a staff member's roles,
  must revoke their sessions in the same transaction — otherwise a live JWT keeps permissions that
  no longer exist. Filter by `sessions.audience = 'staff'`: roles, `data_scope` and branch are
  baked into a *staff* token only, so a grant change must not sign the same human out of the
  member app, where none of it applies.
- Guard self-destructive actions (`ForbiddenException` when `id === currentUser.staffId`).
- Phone numbers are stored and validated in **local Ethiopian form**, `/^0[79]\d{8}$/`. Never
  `+251`. `normalisePhone()` in `src/auth/phone.ts` strips a pasted `+251`/`251` first.
- Refresh tokens are single-use and rotate; a replay revokes every session. The signing payload
  carries a `jti` — without it, two logins in the same second produce identical JWTs and collide on
  `sessions.refresh_token_hash`.

## OpenAPI / Swagger

UI at `/api/docs`, spec at `/api/docs-json`, env-gated off in production.

- **No CLI plugin.** Every DTO property carries an explicit `@ApiProperty` / `@ApiPropertyOptional`
  mirroring its class-validator constraints (`maxLength`, `minLength`, `pattern`, `format`). The
  plugin would need a TS transformer in `webpack.config.js`, which flips ts-loader out of
  `transpileOnly` and slows every build.
- Response shapes get real DTO classes in `<feature>/dto/<feature>-response.dto.ts`. They are
  **documentation only** — nothing binds them to what the service actually selects, so change both
  together.
- **Nullable columns are `@ApiProperty({ nullable: true })`, never `@ApiPropertyOptional`.** The key
  is always present carrying `null`; `Optional` would generate `field?: string` instead of
  `field: string | null`.
- Enums come from the Drizzle `pgEnum`s via `src/common/enums.ts` and **must** pass `enumName` —
  without it each usage emits a duplicate anonymous enum and codegen produces unrelated types.
- Paginated endpoints use `ApiPaginatedResponse(Model)` from `src/common/`.
- Error responses use `ApiNotFoundError` / `ApiConflictError` / `ApiBadRequestError`.
- `ErrorResponseDto.message` is a `oneOf` on purpose: `ValidationPipe` returns `string[]`,
  `ParseUUIDPipe` and hand-thrown exceptions return `string`.
- Never use a TS mapped type (`Partial<T>`) as a `@Body()` type — it reflects as `Object`, which
  Swagger cannot see **and `ValidationPipe` skips entirely**, silently disabling validation.

---

# Roles and permissions

Spans both apps — the backend enforces, the frontend only hides.

## The model

```
person ─── accounts ──< account_roles >── roles ──< role_permissions >── permissions
   └────── staff ──── job_titles (can_have_account)
```

An **account** holds roles; roles hold permissions; a permission is a string. Roles hang off the
account, not the staff row, so the FK enforces that only someone who can actually sign in can hold
one — a cleaner has no account, so there is nothing to attach a role to. Sending `roleIds` for
someone with no account is a 400, not a silent no-op.

There is **no `member` role** — being a member is the existence of a profile row, not a role. Roles
carry no fields of their own beyond name/description/isActive.

Permission names are `resource.action`, and the string in `@Permissions('staff.list')` is the same
string stored in `permissions.name`. Nothing maps or namespaces them — a typo is a permission that
silently never matches.

## The catalogue

Defined in `src/database/permissions.data.ts` and applied by the seed. 25 permissions in 7 groups;
`group` only buckets them in the admin UI.

| Group          | Permissions                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Members        | `member.list` `member.read` `member.create` `member.update` `member.delete`                                                                     |
| Attendance     | `checkin.record` `checkin.list`                                                                                                                 |
| Staff          | `staff.list` `staff.read` `staff.create` `staff.update` `staff.terminate` `staff.resetPassword` `staff.grantAccess` `staff.revokeAccess`         |
| Job titles     | `jobTitle.list` — read only, the catalogue is code                                                                                              |
| Branches       | `branch.list` `branch.create` `branch.update`                                                                                                   |
| Access control | `role.list` `role.create` `role.update` `role.delete` `role.assign`                                                                             |
| Reporting      | `report.view`                                                                                                                                   |

**To add one:** append it to `permissions.data.ts` and re-run `db-seed`. The seed is idempotent
(`onConflictDoNothing` on `permissions.name`) and re-links the Owner role to everything, so a new
permission is picked up without a migration. There is no API to create permissions — the catalogue
is code.

Note the gaps, they are deliberate: there is no `branch.delete` (deactivating a branch requires
`branch.update`), and `staff.list` and `staff.read` are separate so a role can see the roster
without opening individual records.

The three staff-access permissions are deliberately distinct, because they are three different
acts: `staff.resetPassword` helps someone locked out of an account they already have,
`staff.grantAccess` hands someone a login for the first time, and `staff.revokeAccess` takes one
away. A receptionist might reasonably hold the first and none of the others.

## Job titles are a second code catalogue

`src/database/job-titles.data.ts`, applied by the seed, exactly like the permission catalogue —
**there is no API to create or edit one**, only `GET /api/job-titles`. The reason is the same:
application logic branches on these, so a user-typed "Senior Trainer" or "Trainner" would silently
get none of the behaviour attached to trainers, with no error anywhere.

Two rules for anything built on top:

1. **Branch on `code`, never on `name`.** `name` is a display label a gym may want to change;
   `code` is the stable join point and never changes. `JOB_TITLE_CODES` in that file holds them.
2. **Prefer a capability flag over a code comparison.** `canHaveAccount` is the pattern — when
   trainers gain meal plans, add `canTrainMembers` rather than scattering `code === 'trainer'`
   through the codebase, so a gym that calls them Coaches still works. Permissions answer *may they
   do X*; these flags answer *what are they*.

To add a title: append it to `job-titles.data.ts` and re-run `db-seed`. Idempotent on `code`, so no
migration is needed.

## Two sources of truth — this is the part that bites

|                                          | Source                                                                 | Freshness                         |
| ---------------------------------------- | ---------------------------------------------------------------------- | --------------------------------- |
| **API enforcement** (`PermissionsGuard`) | the `permissions[]` array baked into the **access token** at sign time | stale until the token is reissued |
| **UI gating** (`usePermissions`)         | `GET /auth/me`, which re-resolves from the database on every call      | live                              |

So changing a role's permissions does **not** affect anyone holding a live access token. That is
why every grant change must revoke the affected sessions in the same transaction — forcing a
re-login that mints a token with the correct claims. Deleting a role, and changing a staff member's
`roleIds`, both already do this; anything new that touches grants must too.

`resolvePermissions()` ignores roles that are inactive or soft-deleted, so flipping a role to
`isActive: false` strips its permissions from the next token issued — but again, not from live ones.

## Data scope — which rows, as opposed to which operations

Permissions answer _what can you do_. `staff_profiles.data_scope` answers _over which rows_, and
the two are independent.

| `data_scope`       | Effect                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `branch` (default) | Every query is filtered to their `primary_branch_id`, and `branch.*` permissions are stripped — no Branches page |
| `all`              | No branch filter; owners and general managers                                                                    |

`primary_branch_id` stays **NOT NULL** at either scope — an owner is still _based_ somewhere, the
flag just turns the filter off. "Sees everything" is declared explicitly and defaults to the
narrower value: inferring it from a null branch would mean a bug that fails to set the branch
grants global access, whereas this way the same bug grants too little.

**Build the filter from the helper, never from `user.branchId` directly:**

```ts
const scope = branchScopeOf(user); // null = every branch
if (scope) conditions.push(eq(table.branchId, scope));
```

One place to change when scope grows beyond a single branch — a `staff_branches` assignment table
would make it return `string[] | null` and everything else follows.

Four rules:

- **The filter column differs per table** — `check_ins.branch_id`, `payments.branch_id`,
  `staff_profiles.primary_branch_id`. The helper takes it as an argument. `memberships` has no
  branch column of its own: it scopes through `member_profiles.branch_id`, a join the list query
  already pays for. Do not denormalise a copy onto it — a member's branch never moves, so the copy
  could only ever drift.
- **Writes need it too, or read-scoping is theatre.** `findOne`/`update`/`remove` all call
  `assertInScope`; without it a branch manager can PATCH another branch's staff by guessing an id.
- **Out-of-scope records 404, not 403** — a 403 turns the endpoint into an existence oracle for
  other branches' ids. `assertCanWriteToBranch` is the exception and throws Forbidden, because the
  caller supplied that branch id themselves so there is nothing to conceal.
- **Escalation guards on every write that names a scope or branch.** `assertCanGrantScope` stops a
  branch-scoped user minting an `all` colleague — otherwise the limit is one POST away from being
  escaped.

`branch.*` stripping happens in `resolvePermissions()`, which feeds both the token and
`/auth/me` — so the guard 403s, the sidebar hides Branches, and `PermissionGuard` redirects, all
without any of them knowing `data_scope` exists. Roles keep their `branch.*` grants, so one
"Manager" role works at either scope.

**Changing `data_scope`, `primary_branch_id` or `roleIds` must revoke that user's sessions** in the
same transaction — the access token is a snapshot of all three.

## Enforcing (backend)

`@Permissions('a.b', 'c.d')` requires **all** listed permissions. It also emits the OpenAPI
bearer/401/403 metadata, so the documented 403 always names the permission actually enforced.

## Gating (frontend)

Never treat this as security — it only avoids showing a screen the API will refuse.

```tsx
const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();
```

Three places it is applied, all already wired:

- **Routes** — `<PermissionGuard permission="staff.list">` in `src/routes/`, redirects to `/`
- **Sidebar** — `requiredPermission` on a `NavItem` in `layout/sidebar-data.ts`; a group whose
  every item is filtered away renders nothing
- **Row actions and buttons** — return `null` from the row-actions menu when nothing is permitted,
  rather than rendering an empty dropdown

Gate on the permission the endpoint requires, not an approximation: the staff row's View entry
checks `staff.read`, not `staff.list`.

## Editing a role's permissions

`PUT /api/roles/:id/permissions` is a **full replace** — send the entire desired set; anything
omitted is revoked. The backend diffs it (`added`/`removed`) so untouched rows keep their
`created_at`. The UI is `features/roles/pages/manage-permissions.tsx`: permissions grouped into an
accordion with a tri-state group checkbox, selection held as a local `Set<string>` seeded from the
loaded role, and Save disabled until the set actually differs.

---

# Frontend — `apps/frontend`

## Layout

Feature-based, following the ekos pattern. Everything for one entity lives together:

```
src/features/<entity>/
├── actions/            dialogs that perform a mutation (delete/terminate/form dialog)
├── components/         columns, row actions, badges
├── context/            <entity>-context.tsx (dialog state) + <entity>-dialogs.tsx (mount point)
├── data/               schema.ts (zod), types.ts
├── hooks/              use-<entity>.ts — queries AND mutations
├── pages/              create / edit / detail
└── index.tsx           the list page
```

**The hooks file is the API layer** — there is no separate `api/` folder. Mutations own their own
`invalidateQueries`, toast, and navigation.

Shared code: `src/components/{ui,table,form-fields,layout}`, `src/services/` (axios client,
pagination helpers), `src/lib/`, `src/hooks/`, `src/i18n/`.

## Dialog vs page

**≤ 4 inputs → dialog. More → full page.** Count the fields the _edit_ form shows, not just create.

## Component library

shadcn/ui built on **Base UI**, not Radix. The differences bite constantly:

| Base UI                    | Not                       |
| -------------------------- | ------------------------- |
| `render={<Button />}`      | `asChild`                 |
| `data-active:`             | `data-[active=true]:`     |
| `<Checkbox indeterminate>` | `checked="indeterminate"` |
| `<Accordion multiple>`     | `type="multiple"`         |

- `DropdownMenuLabel` is `Menu.GroupLabel` — it **throws** unless wrapped in a `DropdownMenuGroup`.
- Icons are **hugeicons** (`@hugeicons/react` + `@hugeicons/core-free-icons`). Never lucide.
- TanStack Table is **v9**: `createColumnHelper<Features, Data>()`, `table.getState()` is gone.
- Tailwind is a normal `dependency`, not a devDependency. Styles live in `index.css`
  (**exactly 232 lines** — change colour values, do not add or remove lines).

## Forms — use the existing fields, do not re-plumb

`src/components/form-fields/` already wraps every input for TanStack Form: label, `htmlFor`,
touched-and-invalid state, `aria-invalid`, and `FieldError` wiring. **Never hand-roll a
`<form.Field>` with an `<Input>` inside it** — that is how the label/error plumbing drifts.

```tsx
const form = useForm({
  defaultValues: { name: '', branchId: '', roleIds: [] as string[] },
  validators: { onSubmit: branchSchema }, // zod, from data/schema.ts
  onSubmit: ({ value }) => createBranch(value),
});

<FormTextField form={form} name="name" label={t('…')} required />;
```

Every field takes the same base props — `form`, `name`, `label`, `required?`, `placeholder?`,
`disabled?`, `className?` (use `className="sm:col-span-2"` to span the 2-column grid).

| Component                                          | For                                             | Notable extras                                               |
| -------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| `FormTextField`                                    | text, password, number, email                   | `type`, `inputMode`, `maxLength`, `prefix`, `format`/`parse` |
| `FormTextareaField`                                | long text                                       | `rows`                                                       |
| `FormPhoneField`                                   | phone with a `+251` addon                       | stores E.164 — **not** what this API wants, see below        |
| `FormSelectField`                                  | **static** list only — enums, hardcoded choices | `options: {value,label}[]`                                   |
| `FormComboboxField`                                | **anything from a paginated endpoint**          | see below                                                    |
| `FormMultiSelectField`                             | many-of-a-list                                  | `options`, `search`                                          |
| `FormDatePickerField`                              | a day                                           | `disableFuture`; stores `yyyy-MM-dd`                         |
| `FormSwitchField`                                  | boolean                                         | `description`                                                |
| `FormTagInputField`                                | free-form string list                           | —                                                            |
| `FormFileUploadField` / `FormMultiFileUploadField` | uploads                                         | `uploadFn`, `deleteFn`, `accept`, `maxSize`, `maxFiles`      |

**Phone is the exception.** `FormPhoneField` stores `+251912345678`, but this API stores and
validates local form (`0912345678`). Use a plain `FormTextField` with `maxLength={10}` and
`inputMode="numeric"` — see `features/staff/pages/create-staff.tsx`.

### Choosing a picker — `FormSelectField` vs `FormComboboxField`

**`FormSelectField` is only for a static list — one written in code, that cannot grow.** Gender,
employment status, anything from `common/enums.ts`. **Everything backed by a paginated endpoint
uses `FormComboboxField`**, so it searches and pages server-side.

The failure mode this rule exists to prevent: fetching `?limit=100` into a `Select` and calling it
done. It works until the 101st branch, then silently drops rows with no error and no empty state —
the user just cannot find the record. `useBranchOptions(search)` is the shape to copy: a
`useInfiniteQuery` returning `options`, `fetchNextPage`, `hasNextPage`, `isLoading`.

`FormMultiSelectField` is the exception — there is no multi-select combobox, so it still takes a
plain option list. Roles are few and bounded, which is the only reason that is acceptable.

### `DataCombobox` / `FormComboboxField`

`src/components/data-combobox.tsx` supports client-side filtering, server-side search, and infinite
scroll.

```tsx
// Simple: a fully-loaded list, filtered in the browser
<FormComboboxField
  form={form} name="branchId" label={t('…')} required
  options={branchOptions} internalSearch
/>

// Server-driven: search and paging handled by the API
<FormComboboxField
  form={form} name="branchId" label={t('…')} required
  options={options}
  onSearch={setSearch}          // raw term; disables client-side filtering
  onScroll={fetchNextPage}      // fires when the list bottom scrolls into view
  hasNext={hasNextPage}
  isLoading={isFetching}
  selectedOption={current}      // see below
/>
```

Two props that are easy to miss and matter on edit pages:

- **`selectedOption`** — when editing, the saved value's row may live on a page that was never
  loaded, so the trigger would render an empty box. Pass the known `{value,label}` and it is used
  for the label and pinned as the first list item.
- **`internalSearch`** — pass it when `options` holds the whole list. Omit it whenever `onSearch`
  is set, or the browser will filter the server's already-filtered page a second time.

`allowCustomValue` permits a value not in the list; leave it off unless the field genuinely accepts
free text.

## Page layout

| Element            | Markup                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Page container     | `<div className="m-2 flex flex-col gap-4">` — pairs with the sidebar's and header's own `p-2`/`py-2` to give an even 16px gap on every side |
| Create/edit header | `<FormPageHeader title subtitle onBack>`                                                                                                    |
| Header actions     | Cancel (`outline`) then Submit — **in the header row, never a card footer**                                                                 |
| Form card body     | `<CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">`                                                                           |
| Full-width field   | `className="sm:col-span-2"`                                                                                                                 |
| Detail card body   | `<CardContent className="flex flex-col gap-3">` + `DetailRow` + `<Separator/>`                                                              |
| List screen        | `<ListPage title subtitle headerActions>`                                                                                                   |

- **The back button navigates to a concrete route, never `history.back()`** — a page reached by a
  deep link has nowhere to go back to.
- Edit pages use a **two-component split**: an outer component resolves the record and branches on
  loading, an inner one receives it. `defaultValues` are then right on first render, with no
  `reset()` effect. Loading skeletons mirror the real layout.
- Tables: the actions column takes **no width class and no centering** — constraining it strands the
  button at the far right. Row numbers come from `rowNumberColumn(columnHelper, tableState)`.

## Other rules

- **i18n has `strictKeyChecks: true`** — every key must be a full literal. A template-literal key
  will not compile; declare a union of literal key strings instead (see `sidebar-data.ts`, where
  `NavTitleKey` lists `'nav.dashboard' | 'nav.members' | …` in full).
- Route components wrap in `<PermissionGuard permission="x.y">`. This is UI convenience only — the
  API enforces the same permission.
- `settle()` from `src/lib/settle.ts` wraps `mutateAsync` in dialogs: the axios interceptor already
  toasts the error, and an unhandled rejection would tear down the dialog showing it.
- Zustand for auth state only (persisted); TanStack Query owns all server state.
- The axios interceptor handles 401 refresh as a single flight across tabs via Web Locks. Do not
  add a second refresh path.

---

# Working style

- Follow existing patterns before inventing new ones; `apps/frontend/src/features/branches/` is the
  smallest complete reference.
- Do not install specific versions unless a peer conflict forces it — and say so when it does.
- Verify against the running system, not just the type-checker: start the server and make the
  request. Report what actually happened, including what you did not test.
