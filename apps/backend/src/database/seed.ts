import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { SEED_PERMISSIONS } from './permissions.data';
import * as schema from './schema';

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

    // ---- 5. admin user -------------------------------------------------
    let [adminUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.phone, ADMIN.phone));
    if (!adminUser) {
      const passwordHash = await bcrypt.hash(ADMIN.password, BCRYPT_ROUNDS);
      [adminUser] = await db
        .insert(schema.users)
        .values({
          firstName: ADMIN.firstName,
          lastName: ADMIN.lastName,
          phone: ADMIN.phone,
          passwordHash,
          status: 'active',
        })
        .returning();
      console.log(`admin user created: ${ADMIN.phone}`);
    } else {
      console.log(`admin user exists: ${ADMIN.phone}`);
    }

    // ---- 6. staff profile ----------------------------------------------
    let [adminStaff] = await db
      .select()
      .from(schema.staffProfiles)
      .where(eq(schema.staffProfiles.userId, adminUser.id));
    if (!adminStaff) {
      [adminStaff] = await db
        .insert(schema.staffProfiles)
        .values({
          userId: adminUser.id,
          staffCode: 'STF-000001',
          primaryBranchId: branch.id,
          dataScope: 'all',
          jobTitle: 'Owner',
          hiredOn: new Date().toISOString().slice(0, 10),
        })
        .returning();
      console.log('admin staff profile created');
    } else if (adminStaff.dataScope !== 'all') {
      // Repairs an existing database: the data_scope column defaults to
      // 'branch', which would otherwise lock the owner out of branch admin.
      [adminStaff] = await db
        .update(schema.staffProfiles)
        .set({ dataScope: 'all' })
        .where(eq(schema.staffProfiles.userId, adminUser.id))
        .returning();
      console.log('admin staff profile updated: dataScope -> all');
    } else {
      console.log('admin staff profile exists');
    }

    // ---- 7. role assignment --------------------------------------------
    await db
      .insert(schema.userRoles)
      .values({ staffId: adminStaff.userId, roleId: ownerRole.id })
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
