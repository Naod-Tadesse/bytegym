import { createHash, randomUUID } from 'node:crypto';

import {
  Inject,
  Injectable,
  UnauthorizedException,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { and, eq, isNull } from 'drizzle-orm';

import type { DataScope } from '../common/enums';
import type { Database } from '../database/database.client';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import type { AuthenticatedUser, JwtPayload, TokenPair } from './auth.types';
import { parseDurationToSeconds } from './duration';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 10;

/** Refresh tokens are high-entropy, so sha256 (compared by equality) not bcrypt. */
const hashRefreshToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService implements OnModuleInit {
  private refreshSecret!: string;
  private refreshExpirationSeconds!: number;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    // Fail at boot, not on the first refresh request.
    this.refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.refreshExpirationSeconds = parseDurationToSeconds(
      this.config.get<string>('JWT_REFRESH_EXPIRATION') ?? '7d',
    );
  }

  async login({ phone, password }: LoginDto): Promise<TokenPair> {
    // The account row is the credential. Its ABSENCE is what stops a cleaner
    // signing in — there is no nullable column to forget to check, because
    // there is no row to check at all.
    const [row] = await this.db
      .select({ person: schema.person, account: schema.accounts })
      .from(schema.person)
      .leftJoin(
        schema.accounts,
        eq(schema.accounts.personId, schema.person.id),
      )
      .where(
        and(eq(schema.person.phone, phone), isNull(schema.person.deletedAt)),
      );

    // One message for every failure mode, so this cannot be used to discover
    // which phone numbers are registered — or which staff have a login.
    const invalid = () => new UnauthorizedException('Invalid credentials');

    if (!row?.account?.passwordHash) {
      throw invalid();
    }
    if (!(await bcrypt.compare(password, row.account.passwordHash))) {
      throw invalid();
    }
    // Disabled keeps the credential but refuses it — the temporary lock-out,
    // as opposed to revoking, which deletes the row.
    if (row.account.status !== 'active') {
      throw new UnauthorizedException('This account is not active');
    }

    // Members have no staff row, so a member account cannot reach the admin API
    // even once member sign-in exists.
    const [staff] = await this.db
      .select()
      .from(schema.staff)
      .where(eq(schema.staff.personId, row.person.id));

    if (!staff) {
      throw new UnauthorizedException('This account cannot sign in');
    }
    if (staff.employmentStatus === 'terminated') {
      throw new UnauthorizedException('This account cannot sign in');
    }

    await this.db
      .update(schema.accounts)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.accounts.id, row.account.id));

    return this.issueTokens(row.person.id, staff.personId, row.account.id);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = hashRefreshToken(refreshToken);
    const [session] = await this.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.refreshTokenHash, tokenHash));

    // A valid signature with no live session means the token was already
    // rotated — i.e. someone replayed it. Kill every session for that user.
    if (
      !session ||
      session.revokedAt ||
      session.refreshTokenExpiresAt <= new Date()
    ) {
      await this.revokeAllSessions(payload.sub);
      throw new UnauthorizedException('Refresh token has been used or expired');
    }

    await this.db
      .update(schema.sessions)
      .set({ revokedAt: new Date() })
      .where(eq(schema.sessions.id, session.id));

    return this.issueTokens(payload.sub, payload.staffId, payload.accountId);
  }

  async logout(personId: string, refreshToken?: string): Promise<void> {
    // With a token, drop just that device. Without, drop everything.
    if (refreshToken) {
      await this.db
        .update(schema.sessions)
        .set({ revokedAt: new Date() })
        .where(
          eq(schema.sessions.refreshTokenHash, hashRefreshToken(refreshToken)),
        );
      return;
    }
    await this.revokeAllSessions(personId);
  }

  async me(user: AuthenticatedUser) {
    const [row] = await this.db
      .select({
        id: schema.person.id,
        firstName: schema.person.firstName,
        lastName: schema.person.lastName,
        phone: schema.person.phone,
        status: schema.accounts.status,
        staffCode: schema.staff.staffCode,
        jobTitle: schema.jobTitles.name,
        employmentStatus: schema.staff.employmentStatus,
        dataScope: schema.staff.dataScope,
        branchId: schema.branches.id,
        branchName: schema.branches.name,
      })
      .from(schema.person)
      .innerJoin(schema.staff, eq(schema.staff.personId, schema.person.id))
      // Inner, not left: you cannot be asking this without an account.
      .innerJoin(schema.accounts, eq(schema.accounts.id, user.accountId))
      .innerJoin(
        schema.jobTitles,
        eq(schema.jobTitles.id, schema.staff.jobTitleId),
      )
      .innerJoin(
        schema.branches,
        eq(schema.branches.id, schema.staff.primaryBranchId),
      )
      .where(eq(schema.person.id, user.personId));

    if (!row) {
      throw new UnauthorizedException();
    }

    const roles = await this.db
      .select({ name: schema.roles.name })
      .from(schema.accountRoles)
      .innerJoin(schema.roles, eq(schema.roles.id, schema.accountRoles.roleId))
      .where(eq(schema.accountRoles.accountId, user.accountId));

    // Read live rather than echoing the token, so a revoked permission shows up
    // in the UI before the token expires.
    return {
      ...row,
      roles: roles.map((role) => role.name),
      permissions: await this.resolvePermissions(user.accountId, row.dataScope),
    };
  }

  async changePassword(
    user: AuthenticatedUser,
    { currentPassword, newPassword }: ChangePasswordDto,
  ): Promise<void> {
    const [row] = await this.db
      .select({ passwordHash: schema.accounts.passwordHash })
      .from(schema.accounts)
      .where(eq(schema.accounts.id, user.accountId));

    // No account, or an account with no password (a member signing in by SMS),
    // cannot change a password it does not have. This is also why the endpoint
    // can never be used to set a FIRST password — granting access is a
    // deliberate, permissioned act on the staff module.
    if (!row?.passwordHash) {
      throw new UnauthorizedException();
    }
    if (!(await bcrypt.compare(currentPassword, row.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.db
      .update(schema.accounts)
      .set({ passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) })
      .where(eq(schema.accounts.id, user.accountId));

    // Changing a password logs out every other device.
    await this.revokeAllSessions(user.personId);
  }

  // ----- internals ------------------------------------------------------

  private async issueTokens(
    personId: string,
    staffId: string,
    accountId: string,
  ): Promise<TokenPair> {
    const { branchId, dataScope } = await this.loadScope(staffId);
    const permissions = await this.resolvePermissions(accountId, dataScope);
    const payload: JwtPayload = {
      sub: personId,
      staffId,
      accountId,
      branchId,
      dataScope,
      permissions,
    };

    const accessToken = this.jwt.sign(payload);

    // `jti` is what makes each refresh token unique. Without it two logins in
    // the same second produce byte-identical JWTs — same claims, same `iat`
    // (second resolution) — and therefore the same sha256, which collides on
    // sessions.refresh_token_hash. Two devices signing in at once is enough.
    const refreshToken = this.jwt.sign(
      { ...payload, jti: randomUUID() },
      {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpirationSeconds,
      },
    );

    const decodedRefresh = this.jwt.decode(refreshToken) as { exp: number };
    const decodedAccess = this.jwt.decode(accessToken) as { exp?: number };

    await this.db.insert(schema.sessions).values({
      personId,
      // Every session minted here is for the admin API. Member sessions will
      // come from a separate endpoint signed with a different secret.
      audience: 'staff',
      accessTokenHash: hashRefreshToken(accessToken),
      accessTokenExpiresAt: decodedAccess?.exp
        ? new Date(decodedAccess.exp * 1000)
        : null,
      refreshTokenHash: hashRefreshToken(refreshToken),
      refreshTokenExpiresAt: new Date(decodedRefresh.exp * 1000),
    });

    return { accessToken, refreshToken };
  }

  /** The staff member's branch and how far their queries reach. */
  private async loadScope(
    staffId: string,
  ): Promise<{ branchId: string; dataScope: DataScope }> {
    const [row] = await this.db
      .select({
        branchId: schema.staff.primaryBranchId,
        dataScope: schema.staff.dataScope,
      })
      .from(schema.staff)
      .where(eq(schema.staff.personId, staffId));

    if (!row) {
      throw new UnauthorizedException('This account cannot sign in');
    }
    return row;
  }

  private async resolvePermissions(
    accountId: string,
    dataScope: DataScope,
  ): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ name: schema.permissions.name })
      .from(schema.accountRoles)
      .innerJoin(schema.roles, eq(schema.roles.id, schema.accountRoles.roleId))
      .innerJoin(
        schema.rolePermissions,
        eq(schema.rolePermissions.roleId, schema.roles.id),
      )
      .innerJoin(
        schema.permissions,
        eq(schema.permissions.id, schema.rolePermissions.permissionId),
      )
      .where(
        and(
          eq(schema.accountRoles.accountId, accountId),
          eq(schema.roles.isActive, true),
          isNull(schema.roles.deletedAt),
        ),
      );

    const names = rows.map((row) => row.name);

    // Branch-scoped staff have no business administering branches — they can
    // only ever see one. Filtering here rather than in the roles means a single
    // "Manager" role works at either scope, and it lands on both the token
    // (so the guard 403s) and GET /auth/me (so the sidebar and route guards
    // hide the page) without either of them knowing about data_scope.
    return dataScope === 'all'
      ? names
      : names.filter((name) => !name.startsWith('branch.'));
  }

  /**
   * Staff sessions only. Roles, branch and data_scope are baked into a STAFF
   * access token, so a grant change must not also sign the same human out of
   * the member app, where none of it applies.
   */
  private async revokeAllSessions(personId: string): Promise<void> {
    await this.db
      .update(schema.sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.sessions.personId, personId),
          eq(schema.sessions.audience, 'staff'),
          isNull(schema.sessions.revokedAt),
        ),
      );
  }
}
