import { sql, type SQLWrapper } from 'drizzle-orm';

import type { MembershipStatus } from '../common/enums';
import { GYM_TODAY_SQL } from '../common/gym-day';
import * as schema from './schema';

/**
 * `active` | `expired` | `never` — computed on every read, **never stored**.
 *
 * A column would need a nightly job to flip members to expired, and the morning
 * that job fails the column lies while the front desk trusts it. This cannot go
 * stale: it is the gym's today against the rows themselves.
 *
 * A factory rather than a constant because each caller keys on a different
 * column — `member.person_id` on the members list, `check_ins.member_id` on
 * the door, and the same again in reporting. Three hand-copied CASE blocks is
 * how the door and the members page end up disagreeing about who may train,
 * which is the one thing they must never do.
 *
 * Three states, and why each is its own answer:
 *
 * - `never` — registered, never bought. Not missing data; the next step is to
 *   sell them one, which is different from chasing a lapse.
 * - `active` — a membership covers today.
 * - `expired` — had one, it ran out.
 *
 * There is deliberately no fourth state for a membership that has not started
 * yet: a sale begins the day it is made, `SellMembershipDto` has no start date
 * to set, so no member can be holding only future cover. There is no `frozen`
 * and no session-pack state either — both were left out of the design.
 *
 * @param memberId the column holding the member's person id, in the query this
 *   expression is being embedded into.
 */
export const membershipStatusOf = (memberId: SQLWrapper) =>
  sql<MembershipStatus>`
  case
    when not exists (select 1 from ${schema.memberships} m
                     where m.member_id = ${memberId}
                       and m.deleted_at is null) then 'never'
    when exists (select 1 from ${schema.memberships} m
                 where m.member_id = ${memberId}
                   and m.deleted_at is null
                   and ${GYM_TODAY_SQL} between m.starts_on and m.ends_on) then 'active'
    else 'expired'
  end`;
