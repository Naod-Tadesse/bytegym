import { useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  GiftIcon,
  MoneyAdd01Icon,
  PencilEdit02Icon,
  SaleTag01Icon,
} from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import { FormPageHeader } from '@/components/form-page-header';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { PaymentAmount } from '@/features/payments/components/payment-amount';
import { PaymentMethodBadge } from '@/features/payments/components/payment-badges';
import { useMemberPayments } from '@/features/payments/hooks/use-payments';
import {
  formatBirr,
  formatDate,
  isAmountOwed,
  isZeroAmount,
} from '@/lib/format';
import { RecordPaymentDialog } from '../actions/record-payment-dialog';
import { hasLiveMembership } from '../data/membership-state';
import { MembershipStatusBadge } from '../components/membership-status-badge';
import type {
  MemberDetail as MemberDetailType,
  Membership,
} from '../data/types';
import { useMember } from '../hooks/use-members';
import { useMemberships } from '../hooks/use-memberships';

/**
 * The member's record, read-only.
 *
 * This is the page the rest of the member half hangs off: **phase 3** added the
 * memberships history table and the Sell membership action beneath the identity
 * card, and **phase 4** added the balance on each membership row and the
 * payments section under it — sections below, not a restructure of what is
 * here.
 */
export function MemberDetail({ memberId }: { memberId: string }) {
  const { member, isLoading } = useMember(memberId);

  if (isLoading) return <MemberDetailSkeleton />;
  if (!member) return null;

  return <MemberDetailView member={member} />;
}

function MemberDetailView({ member }: { member: MemberDetailType }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  /**
   * The membership the record-payment dialog is settling, or `undefined` when
   * it is closed. There is no standalone payment any more: `POST /payments`
   * requires a `membershipId`, because a registration fee is folded into its
   * membership's `amountDue` rather than being owed on its own.
   */
  const [payingFor, setPayingFor] = useState<Membership | undefined>(undefined);

  const fullName = `${member.firstName} ${member.lastName}`;
  // One live membership at a time: while theirs is still running there is
  // nothing to sell, and the API refuses it. See `hasLiveMembership`.
  const isActive = hasLiveMembership(member.membershipStatus);

  return (
    <div className="m-2 flex flex-col gap-4">
      <FormPageHeader
        title={fullName}
        subtitle={member.memberCode}
        // A concrete route, never `history.back()`: this page is reachable by
        // a deep link, which has nowhere to go back to.
        onBack={() => navigate({ to: '/members' })}
      >
        {hasPermission('member.update') && (
          <Button
            variant="outline"
            onClick={() =>
              navigate({
                to: '/members/$memberId/edit',
                params: { memberId: member.personId },
              })
            }
          >
            <HugeiconsIcon icon={PencilEdit02Icon} data-icon="inline-start" />
            {t('actions.edit')}
          </Button>
        )}
        {/* No page-level "Record payment": every payment settles a membership
            now, so it is only ever offered on the row that owes the money.
            A sale takes its own first payment. */}
        {/* The reason most people open this page, so it is the primary button
            and it sits last, where the page's actions end. */}
        {hasPermission('membership.sell') &&
          (isActive ? (
            // Disabled with the reason beside it, rather than hidden: the
            // button vanishing would read as "you may not sell", which is the
            // wrong lesson — they may, just not yet. The date is the whole
            // answer, so it is stated here and not left to a click and a 409.
            <span className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {t('members.sellMembership.activeUntil', {
                  date: formatDate(member.expiresOn ?? ''),
                })}
              </span>
              <Button disabled>
                <HugeiconsIcon icon={SaleTag01Icon} data-icon="inline-start" />
                {t('members.actions.sellMembership')}
              </Button>
            </span>
          ) : (
            <Button
              onClick={() =>
                navigate({
                  to: '/members/$memberId/sell',
                  params: { memberId: member.personId },
                })
              }
            >
              <HugeiconsIcon icon={SaleTag01Icon} data-icon="inline-start" />
              {t('members.actions.sellMembership')}
            </Button>
          ))}
      </FormPageHeader>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <Avatar className="size-12">
              <AvatarFallback>
                {`${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <span className="text-lg font-semibold">{fullName}</span>
              <span className="text-sm text-muted-foreground">
                {member.memberCode} · {member.branchName}
              </span>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {/* Both verdicts, side by side: unpaid and barred are different
                  refusals with different next steps, and someone can be one,
                  the other, or both. */}
              <MembershipStatusBadge
                status={member.membershipStatus}
                expiresOn={member.expiresOn}
              />
              {/* Stated either way, never left blank: not being suspended is a
                  fact the front desk reads, not the absence of one. */}
              {member.isSuspended ? (
                <Badge variant="destructive">
                  {t('members.suspension.suspended')}
                </Badge>
              ) : (
                <Badge variant="secondary">
                  {t('members.suspension.active')}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <DetailRow label={t('members.fields.phone')}>
            <span className="tabular-nums">{member.phone}</span>
          </DetailRow>
          <Separator />
          <DetailRow label={t('members.fields.memberCode')}>
            {member.memberCode}
          </DetailRow>
          <Separator />
          <DetailRow label={t('members.fields.branch')}>
            {member.branchName}
          </DetailRow>
          <Separator />
          <DetailRow label={t('members.fields.gender')}>
            {member.gender
              ? t(
                  member.gender === 'male'
                    ? 'staff.gender.male'
                    : 'staff.gender.female',
                )
              : '—'}
          </DetailRow>
          <Separator />
          <DetailRow label={t('members.fields.dateOfBirth')}>
            {member.dateOfBirth ? formatDate(member.dateOfBirth) : '—'}
          </DetailRow>
          <Separator />
          <DetailRow label={t('members.fields.emergencyContactName')}>
            {member.emergencyContactName || '—'}
          </DetailRow>
          <Separator />
          <DetailRow label={t('members.fields.emergencyContactPhone')}>
            {member.emergencyContactPhone ? (
              <span className="tabular-nums">
                {member.emergencyContactPhone}
              </span>
            ) : (
              '—'
            )}
          </DetailRow>
          <Separator />
          <DetailRow label={t('members.fields.joined')}>
            {formatDate(member.createdAt)}
          </DetailRow>
        </CardContent>
      </Card>

      {/* Its own component so the list query is never even issued without the
          permission the endpoint enforces — a 403 here would toast an error on
          a page the caller is otherwise allowed to read. */}
      {hasPermission('membership.list') && (
        <MembershipHistory
          memberId={member.personId}
          onRecordPayment={setPayingFor}
        />
      )}

      {hasPermission('payment.list') && (
        <PaymentHistory memberId={member.personId} />
      )}

      {/* Mounted only with a target, and keyed by it: the dialog reads its
          defaults once, so retargeting it at another membership without a
          remount would keep the first one's balance in the amount box. */}
      {payingFor && (
        <RecordPaymentDialog
          key={`payment-${payingFor.id}`}
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) setPayingFor(undefined);
          }}
          member={member}
          membership={payingFor}
        />
      )}
    </div>
  );
}

/** Every membership this member has held, newest first, and what each still owes. */
function MembershipHistory({
  memberId,
  onRecordPayment,
}: {
  memberId: string;
  onRecordPayment: (membership: Membership) => void;
}) {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const canRecordPayment = hasPermission('payment.record');
  const { memberships, total, isLoading, hasMore, showMore, isLoadingMore } =
    useMemberships(memberId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('members.memberships.title')}</CardTitle>
        <CardDescription>{t('members.memberships.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : memberships.length === 0 ? (
          // A member who has never bought one is the normal state right after
          // registration, so say what to do rather than showing an empty grid.
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('members.memberships.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('members.memberships.columns.plan')}</TableHead>
                  <TableHead>
                    {t('members.memberships.columns.dates')}
                  </TableHead>
                  {/* What was actually asked for, not the plan's list price:
                      a first sale adds the registration fee on top, and the
                      balance below is measured against this figure. */}
                  <TableHead>
                    {t('members.memberships.columns.amountDue')}
                  </TableHead>
                  {/* The thing a receptionist must notice, so it sits right
                      beside the price it is derived from. */}
                  <TableHead>
                    {t('members.memberships.columns.balance')}
                  </TableHead>
                  <TableHead>{t('members.memberships.columns.type')}</TableHead>
                  <TableHead>
                    {t('members.memberships.columns.soldBy')}
                  </TableHead>
                  {canRecordPayment && (
                    <TableHead>
                      <span className="sr-only">
                        {t('payments.actions.record')}
                      </span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberships.map((membership) => (
                  <TableRow key={membership.id}>
                    <TableCell className="font-medium">
                      {membership.planName}
                    </TableCell>
                    {/* Both ends inclusive — the last day is a day of cover,
                        not the day it lapses. */}
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                      {formatDate(membership.startsOn)} —{' '}
                      {formatDate(membership.endsOn)}
                    </TableCell>
                    {/* `tabular-nums`: without it the digits shift width and a
                        column of amounts will not line up. The snapshotted
                        string goes straight to `formatBirr`, never parsed.
                        The registration line is stated whenever there is one —
                        otherwise an amount above the plan's price reads as a
                        billing error to anyone who knows what the plan costs. */}
                    <TableCell className="tabular-nums">
                      <span className="flex flex-col gap-0.5">
                        <span>{formatBirr(membership.amountDue)}</span>
                        {!isZeroAmount(membership.registrationFee) && (
                          <span className="text-xs whitespace-nowrap text-muted-foreground">
                            {t('members.memberships.includesRegistration', {
                              amount: formatBirr(membership.registrationFee),
                            })}
                          </span>
                        )}
                      </span>
                    </TableCell>
                    {/* An unpaid balance is the one thing on this page that has
                        to be noticed, so it is the only figure in destructive
                        colour — and a comped membership owes nothing, so it
                        shows no figure at all rather than a red one. An
                        overpayment leaves a negative balance and stays plain:
                        it is a credit, not a debt. */}
                    <TableCell className="tabular-nums">
                      {membership.isComplimentary ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={cn(
                            isAmountOwed(membership.balance) &&
                              'font-medium text-destructive',
                          )}
                        >
                          {formatBirr(membership.balance)}
                        </span>
                      )}
                    </TableCell>
                    {/* Stated either way. A comped membership still carries the
                        plan's price, so without this badge the amount beside it
                        reads as money that was owed. */}
                    <TableCell>
                      {membership.isComplimentary ? (
                        <Badge variant="secondary">
                          <HugeiconsIcon
                            icon={GiftIcon}
                            data-icon="inline-start"
                          />
                          {t('members.memberships.complimentary')}
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {t('members.memberships.chargeable')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {membership.soldByName}
                    </TableCell>
                    {canRecordPayment && (
                      <TableCell>
                        {/* Only where money is actually outstanding: an offer
                            to pay a settled membership is a mistake waiting to
                            be made. */}
                        {!membership.isComplimentary &&
                          isAmountOwed(membership.balance) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onRecordPayment(membership)}
                            >
                              <HugeiconsIcon
                                icon={MoneyAdd01Icon}
                                data-icon="inline-start"
                              />
                              {t('payments.actions.record')}
                            </Button>
                          )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {hasMore && (
          <Button
            variant="outline"
            className="self-center"
            disabled={isLoadingMore}
            onClick={() => showMore()}
          >
            {isLoadingMore && <Spinner data-icon="inline-start" />}
            {t('members.memberships.showMore', {
              shown: memberships.length,
              total,
            })}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Every payment this member has made, newest first.
 *
 * Voided payments are listed, struck through, rather than filtered out — the
 * row and its reason are the record of what happened. The card's total is the
 * server's `SUM()` over non-voided rows, so it is right whether or not the
 * whole history has been paged in.
 */
function PaymentHistory({ memberId }: { memberId: string }) {
  const { t } = useTranslation();
  const {
    payments,
    total,
    totalReceived,
    isLoading,
    hasMore,
    showMore,
    isLoadingMore,
  } = useMemberPayments(memberId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('payments.member.title')}</CardTitle>
        <CardDescription>
          {t('payments.member.subtitle', {
            total: formatBirr(totalReceived),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('payments.member.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('payments.columns.date')}</TableHead>
                  <TableHead>{t('payments.columns.method')}</TableHead>
                  <TableHead>{t('payments.columns.amount')}</TableHead>
                  <TableHead>{t('payments.columns.reference')}</TableHead>
                  <TableHead>{t('payments.columns.receivedBy')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                      {formatDate(payment.receivedAt)}
                    </TableCell>
                    <TableCell>
                      <PaymentMethodBadge method={payment.method} />
                    </TableCell>
                    <TableCell>
                      <PaymentAmount payment={payment} />
                    </TableCell>
                    {/* The void reason is not repeated here — `PaymentAmount`
                        already carries it under the struck-through figure it
                        explains. */}
                    <TableCell className="text-muted-foreground">
                      {payment.reference ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {payment.receivedByName ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {hasMore && (
          <Button
            variant="outline"
            className="self-center"
            disabled={isLoadingMore}
            onClick={() => showMore()}
          >
            {isLoadingMore && <Spinner data-icon="inline-start" />}
            {t('payments.member.showMore', {
              shown: payments.length,
              total,
            })}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

/** Mirrors the real layout so the page does not jump when data lands. */
function MemberDetailSkeleton() {
  return (
    <div className="m-2 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-8 w-48" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-12 w-64" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-5 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
