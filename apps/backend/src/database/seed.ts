import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { JOB_TITLE_CODES, SEED_JOB_TITLES } from './job-titles.data';
import { SEED_PERMISSIONS } from './permissions.data';
import * as schema from './schema';
import { nextStaffCode } from './staff-code';

/**
 * Standalone seed — plain pg + Drizzle, deliberately not a Nest context so it
 * can run from an Nx target without booting the app.
 *
 * Idempotent: every step checks before it writes, so re-running is safe.
 */

const ADMIN = {
  phone: process.env['ADMIN_PHONE'] ?? '0911000000',
  password: process.env['ADMIN_PASSWORD'] ?? 'Admin@123',
  firstName: process.env['ADMIN_FIRST_NAME'] ?? 'System',
  lastName: process.env['ADMIN_LAST_NAME'] ?? 'Admin',
};

const OWNER_ROLE = 'Owner';
const MAIN_BRANCH = 'Main Branch';
const BCRYPT_ROUNDS = 10;


async function main() {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env first.',
    );
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle({ client: pool });

  try {
    // ---- 1. permissions ------------------------------------------------
    await db
      .insert(schema.permissions)
      .values(SEED_PERMISSIONS)
      .onConflictDoNothing({ target: schema.permissions.name });
    const allPermissions = await db.select().from(schema.permissions);
    console.log(`permissions: ${allPermissions.length}`);

    // ---- 2. branch -----------------------------------------------------
    let [branch] = await db
      .select()
      .from(schema.branches)
      .where(eq(schema.branches.name, MAIN_BRANCH));
    if (!branch) {
      [branch] = await db
        .insert(schema.branches)
        .values({ name: MAIN_BRANCH, city: 'Addis Ababa' })
        .returning();
      console.log(`branch created: ${MAIN_BRANCH}`);
    } else {
      console.log(`branch exists: ${MAIN_BRANCH}`);
    }

    // ---- 3. Owner role -------------------------------------------------
    let [ownerRole] = await db
      .select()
      .from(schema.roles)
      .where(eq(schema.roles.name, OWNER_ROLE));
    if (!ownerRole) {
      [ownerRole] = await db
        .insert(schema.roles)
        .values({
          name: OWNER_ROLE,
          description: 'Full access to everything. Created by the seed.',
        })
        .returning();
      console.log(`role created: ${OWNER_ROLE}`);
    } else {
      console.log(`role exists: ${OWNER_ROLE}`);
    }

    // ---- 4. Owner gets every permission --------------------------------
    // Re-run picks up permissions added to permissions.data.ts since last time.
    await db
      .insert(schema.rolePermissions)
      .values(
        allPermissions.map((permission) => ({
          roleId: ownerRole.id,
          permissionId: permission.id,
        })),
      )
      .onConflictDoNothing();
    console.log(`${OWNER_ROLE} linked to ${allPermissions.length} permissions`);

    // ---- 5. job titles ---------------------------------------------------
    // Same shape as permissions: a code catalogue, applied idempotently.
    await db
      .insert(schema.jobTitles)
      .values(SEED_JOB_TITLES)
      .onConflictDoNothing({ target: schema.jobTitles.code });
    const allJobTitles = await db.select().from(schema.jobTitles);
    // Looked up by CODE, not by name — the name is a label that may change.
    const ownerTitle = allJobTitles.find(
      (row) => row.code === JOB_TITLE_CODES.OWNER,
    );
    if (!ownerTitle) {
      throw new Error(
        `job title "${JOB_TITLE_CODES.OWNER}" missing after seed`,
      );
    }
    console.log(`job titles: ${allJobTitles.length}`);

    // ---- 6. admin person -----------------------------------------------
    let [adminPerson] = await db
      .select()
      .from(schema.person)
      .where(eq(schema.person.phone, ADMIN.phone));
    if (!adminPerson) {
      [adminPerson] = await db
        .insert(schema.person)
        .values({
          firstName: ADMIN.firstName,
          lastName: ADMIN.lastName,
          phone: ADMIN.phone,
        })
        .returning();
      console.log(`admin person created: ${ADMIN.phone}`);
    } else {
      console.log(`admin person exists: ${ADMIN.phone}`);
    }

    // ---- 7. admin account ------------------------------------------------
    // The credential is a separate row now: this is what makes the admin able
    // to sign in at all.
    let [adminAccount] = await db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.personId, adminPerson.id));
    if (!adminAccount) {
      [adminAccount] = await db
        .insert(schema.accounts)
        .values({
          personId: adminPerson.id,
          passwordHash: await bcrypt.hash(ADMIN.password, BCRYPT_ROUNDS),
        })
        .returning();
      console.log('admin account created');
    } else {
      console.log('admin account exists');
    }

    // ---- 8. staff row --------------------------------------------------
    let [adminStaff] = await db
      .select()
      .from(schema.staff)
      .where(eq(schema.staff.personId, adminPerson.id));
    if (!adminStaff) {
      [adminStaff] = await db
        .insert(schema.staff)
        .values({
          personId: adminPerson.id,
          // Same generator the API uses, so there is only ever one format.
          staffCode: await nextStaffCode(db),
          primaryBranchId: branch.id,
          dataScope: 'all',
          jobTitleId: ownerTitle.id,
          hiredOn: new Date().toISOString().slice(0, 10),
        })
        .returning();
      console.log('admin staff row created');
    } else if (adminStaff.dataScope !== 'all') {
      // Repairs an existing database: the data_scope column defaults to
      // 'branch', which would otherwise lock the owner out of branch admin.
      [adminStaff] = await db
        .update(schema.staff)
        .set({ dataScope: 'all' })
        .where(eq(schema.staff.personId, adminPerson.id))
        .returning();
      console.log('admin staff row updated: dataScope -> all');
    } else {
      console.log('admin staff row exists');
    }

    // ---- 9. role assignment --------------------------------------------
    // Grants hang off the account, not the staff row — only someone who can
    // sign in can hold a role.
    await db
      .insert(schema.accountRoles)
      .values({ accountId: adminAccount.id, roleId: ownerRole.id })
      .onConflictDoNothing();
    console.log(`admin granted ${OWNER_ROLE}`);

    console.log('\nseed complete');
    console.log(`  login with  ${ADMIN.phone}  /  ${ADMIN.password}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('seed failed:', error);
  process.exit(1);
});
