import type { Api } from './api-client';
import { gymToday, addDays } from './env';
import { record } from './manifest';
import { insertMembership } from './db';
import { uniqueName, uniquePhone } from './unique';

export interface Branch {
  id: string;
  name: string;
  isActive: boolean;
}
export interface Plan {
  id: string;
  name: string;
  durationDays: number;
  price: string;
  registrationFee: string;
  isActive: boolean;
}
export interface Member {
  id: string;
  memberCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  branchId: string;
}
export interface Staff {
  id: string;
  staffCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  password?: string;
}
export interface Role {
  id: string;
  name: string;
}
export interface Membership {
  id: string;
  memberId: string;
  planId: string;
  planName: string;
  startsOn: string;
  endsOn: string;
  price: string;
  registrationFee: string;
  /** price + registrationFee — what it was worth, even for a comp. */
  amountDue: string;
  paidTotal: string;
  /** What is still owed; always 0 for a complimentary membership. */
  balance: string;
  isComplimentary: boolean;
  soldByStaffId: string | null;
}
export interface Payment {
  id: string;
  amount: string;
}

export interface JobTitle {
  id: string;
  code: string;
  name: string;
  canHaveAccount: boolean;
}
export interface Permission {
  id: string;
  name: string;
  group: string;
}

/**
 * Arrange helpers. Every record is named with the worker's scope so nothing
 * collides across workers, and every id is written to the run manifest so
 * teardown can delete it in SQL — the API cannot, because branches and plans
 * have no delete route and memberships, payments and check-ins have none at all.
 */
export class Factories {
  private jobTitleCache?: JobTitle[];
  private permissionCache?: Permission[];
  private mainBranchCache?: Branch;

  constructor(
    private readonly api: Api,
    readonly scope: string,
  ) {}

  private name(kind: string) {
    return uniqueName(this.scope, kind);
  }

  async jobTitles(): Promise<JobTitle[]> {
    this.jobTitleCache ??= (
      await this.api.json<{ data: JobTitle[] }>(
        this.api.get('/job-titles', { limit: 100 }),
      )
    ).data;
    return this.jobTitleCache;
  }

  async jobTitle(code: string): Promise<JobTitle> {
    const found = (await this.jobTitles()).find((j) => j.code === code);
    if (!found) throw new Error(`no job title with code ${code}`);
    return found;
  }

  async permissions(): Promise<Permission[]> {
    // GET /api/permissions is NOT paginated — it returns a plain array.
    this.permissionCache ??= await this.api.json<Permission[]>(
      this.api.get('/permissions'),
    );
    return this.permissionCache;
  }

  async permissionIds(names: string[]): Promise<string[]> {
    const all = await this.permissions();
    return names.map((n) => {
      const hit = all.find((p) => p.name === n);
      if (!hit) throw new Error(`unknown permission ${n}`);
      return hit.id;
    });
  }

  /** The branch the seed creates. Never modified, only referenced. */
  async mainBranch(): Promise<Branch> {
    this.mainBranchCache ??= await (async () => {
      const page = await this.api.json<{ data: Branch[] }>(
        this.api.get('/branches', { search: 'Main Branch', limit: 100 }),
      );
      const hit = page.data.find((b) => b.name === 'Main Branch');
      if (!hit) throw new Error('seeded "Main Branch" not found — run db-seed');
      return hit;
    })();
    return this.mainBranchCache;
  }

  async branch(over: Partial<{ city: string; isActive: boolean }> = {}) {
    const b = await this.api.json<Branch>(
      this.api.post('/branches', {
        name: this.name('branch'),
        city: over.city ?? 'Addis Ababa',
      }),
    );
    record('branches', b.id);
    if (over.isActive === false) {
      await this.api.patch(`/branches/${b.id}`, { isActive: false });
      b.isActive = false;
    }
    return b;
  }

  async plan(
    over: Partial<{
      durationDays: number;
      price: string;
      registrationFee: string;
      isActive: boolean;
    }> = {},
  ) {
    const p = await this.api.json<Plan>(
      this.api.post('/membership-plans', {
        name: this.name('plan'),
        durationDays: over.durationDays ?? 30,
        price: over.price ?? '1000.00',
        registrationFee: over.registrationFee ?? '0',
      }),
    );
    record('membership_plans', p.id);
    if (over.isActive === false) {
      await this.api.patch(`/membership-plans/${p.id}`, { isActive: false });
      p.isActive = false;
    }
    return p;
  }

  async member(
    over: Partial<{ branchId: string; isSuspended: boolean; phone: string }> = {},
  ): Promise<Member> {
    const branchId = over.branchId ?? (await this.mainBranch()).id;
    const phone = over.phone ?? uniquePhone();
    const lastName = this.name('member');
    // The API returns `personId`, not `id` — member and staff are both keyed on
    // person.id. Normalise to `id` so every factory reads the same way.
    const m = await this.api.json<{ personId: string; memberCode: string }>(
      this.api.post('/members', {
        firstName: 'E2E',
        lastName,
        phone,
        branchId,
      }),
    );
    record('member', m.personId);
    record('person', m.personId);
    if (over.isSuspended) {
      await this.api.patch(`/members/${m.personId}/suspension`, {
        isSuspended: true,
      });
    }
    return {
      id: m.personId,
      memberCode: m.memberCode,
      firstName: 'E2E',
      lastName,
      phone,
      branchId,
    };
  }

  async role(permissionNames: string[] = []): Promise<Role> {
    const r = await this.api.json<Role>(
      this.api.post('/roles', {
        name: this.name('role'),
        description: 'Created by the e2e suite.',
      }),
    );
    record('roles', r.id);
    if (permissionNames.length) {
      await this.api.json(
        this.api.put(`/roles/${r.id}/permissions`, {
          permissionIds: await this.permissionIds(permissionNames),
        }),
      );
    }
    return r;
  }

  async staff(
    over: Partial<{
      branchId: string;
      jobTitleCode: string;
      password: string;
      roleIds: string[];
      dataScope: 'branch' | 'all';
      phone: string;
    }> = {},
  ): Promise<Staff> {
    const branchId = over.branchId ?? (await this.mainBranch()).id;
    const jt = await this.jobTitle(over.jobTitleCode ?? 'receptionist');
    const phone = over.phone ?? uniquePhone();
    const lastName = this.name('staff');
    const body: Record<string, unknown> = {
      firstName: 'E2E',
      lastName,
      phone,
      primaryBranchId: branchId,
      jobTitleId: jt.id,
      hiredOn: gymToday(),
    };
    if (over.password) body.password = over.password;
    if (over.roleIds) body.roleIds = over.roleIds;
    if (over.dataScope) body.dataScope = over.dataScope;

    // POST /staff returns the narrow StaffProfileDto: personId and staffCode,
    // but no name or phone. Carry those forward from what we sent.
    const s = await this.api.json<{ personId: string; staffCode: string }>(
      this.api.post('/staff', body),
    );
    record('staff', s.personId);
    record('person', s.personId);
    return {
      id: s.personId,
      staffCode: s.staffCode,
      firstName: 'E2E',
      lastName,
      phone,
      password: over.password,
    };
  }

  /** Sells through the API: startsOn is always the gym's today. */
  async membership(opts: {
    memberId: string;
    planId: string;
    isComplimentary?: boolean;
    payment?: { method: string; reference?: string };
  }): Promise<Membership> {
    const body: Record<string, unknown> = {
      memberId: opts.memberId,
      planId: opts.planId,
    };
    if (opts.isComplimentary) body.isComplimentary = true;
    if (opts.payment) body.payment = opts.payment;

    const m = await this.api.json<Membership>(
      this.api.post('/memberships', body),
    );
    record('memberships', m.id);
    return m;
  }

  /**
   * A membership in the past. Only reachable by direct insert — SellMembershipDto
   * has no startsOn and the service always uses the gym's today.
   */
  async expiredMembership(opts: {
    memberId: string;
    planId: string;
    endedDaysAgo?: number;
  }) {
    const ago = opts.endedDaysAgo ?? 1;
    const endsOn = addDays(gymToday(), -ago);
    return insertMembership({
      memberId: opts.memberId,
      planId: opts.planId,
      startsOn: addDays(endsOn, -29),
      endsOn,
    });
  }

  async payment(opts: {
    memberId: string;
    membershipId: string;
    amount: string;
    method?: string;
    reference?: string;
  }): Promise<Payment> {
    const p = await this.api.json<Payment>(
      this.api.post('/payments', {
        memberId: opts.memberId,
        membershipId: opts.membershipId,
        amount: opts.amount,
        method: opts.method ?? 'cash',
        reference: opts.reference,
      }),
    );
    record('payments', p.id);
    return p;
  }

  async checkIn(memberId: string, override = false) {
    const res = await this.api.post('/check-ins', { memberId, override });
    const body = await res.json();
    if (body?.id) record('check_ins', String(body.id));
    return { status: res.status(), body };
  }

  /** A member with live cover — the common starting point for check-in tests. */
  async activeMember(over: { branchId?: string } = {}) {
    const member = await this.member({ branchId: over.branchId });
    const plan = await this.plan({ durationDays: 30 });
    const membership = await this.membership({
      memberId: member.id,
      planId: plan.id,
    });
    return { member, plan, membership };
  }

  /** A member whose cover ran out yesterday. */
  async expiredMember(over: { branchId?: string } = {}) {
    const member = await this.member({ branchId: over.branchId });
    const plan = await this.plan({ durationDays: 30 });
    const membership = await this.expiredMembership({
      memberId: member.id,
      planId: plan.id,
    });
    return { member, plan, membership };
  }
}
