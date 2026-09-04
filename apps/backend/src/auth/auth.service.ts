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
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(
        and(eq(schema.users.phone, phone), isNull(schema.users.deletedAt)),
      );

    // One message for every failure mode, so this cannot be used to discover
    // which phone numbers are registered.
    const invalid = () => new UnauthorizedException('Invalid credentials');

    if (!user || !user.passwordHash) {
      throw invalid();
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw invalid();
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException('This account is not active');
    }

    // Members have no staff_profiles row, so they cannot log in even if someone
    // sets a password on them.
    const [staff] = await this.db
      .select()
      .from(schema.staffProfiles)
      .where(eq(schema.staffProfiles.userId, user.id));

    if (!staff) {
      throw new UnauthorizedException('This account cannot sign in');
    }
    if (staff.employmentStatus === 'terminated') {
      throw new UnauthorizedException('This account cannot sign in');
    }

    await this.db
      .update(schema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.users.id, user.id));

    return this.issueTokens(user.id, staff.userId);
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
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      await this.revokeAllSessions(payload.sub);
      throw new UnauthorizedException('Refresh token has been used or expired');
    }

    await this.db
      .update(schema.sessions)
      .set({ revokedAt: new Date() })
      .where(eq(schema.sessions.id, session.id));

    return this.issueTokens(payload.sub, payload.staffId);
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
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
    await this.revokeAllSessions(userId);
  }

  async me(user: AuthenticatedUser) {
    const [row] = await this.db
      .select({
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        phone: schema.users.phone,
        status: schema.users.status,
        staffCode: schema.staffProfiles.staffCode,
        jobTitle: schema.staffProfiles.jobTitle,
        employmentStatus: schema.staffProfiles.employmentStatus,
        dataScope: schema.staffProfiles.dataScope,
        branchId: schema.branches.id,
        branchName: schema.branches.name,
      })
      .from(schema.users)
      .innerJoin(
        schema.staffProfiles,
        eq(schema.staffProfiles.userId, schema.users.id),
      )
      .innerJoin(
        schema.branches,
        eq(schema.branches.id, schema.staffProfiles.primaryBranchId),
      )
      .where(eq(schema.users.id, user.userId));

    if (!row) {
      throw new UnauthorizedException();
    }

    const roles = await this.db
      .select({ name: schema.roles.name })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
      .where(eq(schema.userRoles.staffId, user.staffId));

    // Read live rather than echoing the token, so a revoked permission shows up
    // in the UI before the token expires.
    return {
      ...row,
      roles: roles.map((role) => role.name),
      permissions: await this.resolvePermissions(user.staffId, row.dataScope),
    };
  }

  async changePassword(
    user: AuthenticatedUser,
    { currentPassword, newPassword }: ChangePasswordDto,
  ): Promise<void> {
    const [row] = await this.db
      .select({ passwordHash: schema.users.passwordHash })
      .from(schema.users)
      .where(eq(schema.users.id, user.userId));

    if (!row?.passwordHash) {
      throw new UnauthorizedException();
    }
    if (!(await bcrypt.compare(currentPassword, row.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.db
      .update(schema.users)
      .set({ passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) })
      .where(eq(schema.users.id, user.userId));

    // Changing a password logs out every other device.
    await this.revokeAllSessions(user.userId);
  }

  // ----- internals ------------------------------------------------------

  private async issueTokens(
    userId: string,
    staffId: string,
  ): Promise<TokenPair> {
    const { branchId, dataScope } = await this.loadScope(staffId);
    const permissions = await this.resolvePermissions(staffId, dataScope);
    const payload: JwtPayload = {
      sub: userId,
      staffId,
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

    const decoded = this.jwt.decode(refreshToken) as { exp: number };

    await this.db.insert(schema.sessions).values({
      userId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(decoded.exp * 1000),
    });

    return { accessToken, refreshToken };
  }

  /** The staff member's branch and how far their queries reach. */
  private async loadScope(
    staffId: string,
  ): Promise<{ branchId: string; dataScope: DataScope }> {
    const [row] = await this.db
      .select({
        branchId: schema.staffProfiles.primaryBranchId,
        dataScope: schema.staffProfiles.dataScope,
      })
      .from(schema.staffProfiles)
      .where(eq(schema.staffProfiles.userId, staffId));

    if (!row) {
      throw new UnauthorizedException('This account cannot sign in');
    }
    return row;
  }

  private async resolvePermissions(
    staffId: string,
    dataScope: DataScope,
  ): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ name: schema.permissions.name })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
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
          eq(schema.userRoles.staffId, staffId),
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

  private async revokeAllSessions(userId: string): Promise<void> {
    await this.db
      .update(schema.sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.sessions.userId, userId),
          isNull(schema.sessions.revokedAt),
        ),
      );
  }
}
