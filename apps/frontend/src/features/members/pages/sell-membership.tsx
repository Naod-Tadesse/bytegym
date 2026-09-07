import { useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import {
  FormComboboxField,
  FormDatePickerField,
  FormSelectField,
  FormSwitchField,
  FormTextField,
} from '@/components/form-fields';
import { FormPageHeader } from '@/components/form-page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import type { MembershipPlan } from '@/features/membership-plans/data/types';
import { usePlanOptions } from '@/features/membership-plans/hooks/use-membership-plans';
import { usePaymentMethodOptions } from '@/features/payments/components/payment-badges';
import { useDebounce } from '@/hooks/use-debounce';
import { addAmounts, formatBirr, isZeroAmount } from '@/lib/format';
import { settle } from '@/lib/settle';
import { cn } from '@/lib/utils';
import { orUndefined, sellMembershipSchema } from '../data/schema';
import type { MemberDetail } from '../data/types';
import { useMember } from '../hooks/use-members';
import { useSellMembership } from '../hooks/use-memberships';

/**
 * The joining fee this sale would charge — the plan's, but only for a member
 * who has never held a membership. Everyone else pays the plan price alone.
 */
const feeFor = (plan: MembershipPlan, isFirstMembership: boolean) =>
  isFirstMembership ? plan.registrationFee : '0.00';

/**
 * Whether this sale asks for nothing at all: a free plan with no joining fee.
 * `POST /memberships` refuses a `payment` against a zero amount due, so the
 * payment half of the form is not offered in that case.
 *
 * `false` for a plan that is not on a loaded page — the answer is unknown, and
 * assuming "free" would suppress the payment for an ordinary sale.
 */
const costsNothing = (
  plan: MembershipPlan | undefined,
  isFirstMembership: boolean,
) =>
  plan
    ? isZeroAmount(addAmounts(plan.price, feeFor(plan, isFirstMembership)))
    : false;

/**
 * Selling a membership and taking the money for it are one act at the front
 * desk, so they are one form: `POST /memberships` creates the payment too.
 *
 * A page rather than a dialog because the form is six fields across two
 * decisions — which cover to sell, and what was handed over for it — and the
 * house rule is four. It also means every sale starts from a fresh mount, so a
 * Telebirr reference left over from the previous member cannot be carried into
 * the next one.
 *
 * Split in two on purpose: the outer half resolves the member, the inner half
 * only ever renders with one, so `defaultValues` are right on first render and
 * no `reset()` effect is needed.
 */
export function SellMembership({ memberId }: { memberId: string }) {
  const { member, isLoading } = useMember(memberId);

  if (isLoading) return <SellMembershipSkeleton />;
  if (!member) return null;

  return <SellMembershipForm member={member} />;
}

function SellMembershipForm({ member }: { member: MemberDetail }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  // Back to the member, not the roster: a sale is made from someone's record
  // and the result — the new cover and what it left owing — is read there.
  // A concrete route, never `history.back()`; this page takes a deep link.
  const goToMember = () =>
    navigate({
      to: '/members/$memberId',
      params: { memberId: member.personId },
    });

  const { sellMembershipAsync, isPending } = useSellMembership(goToMember);

  // Plans are a paginated endpoint, so the picker searches and pages
  // server-side — a `FormSelectField` fed one big page works until the 101st
  // plan and then drops rows with nothing to show for it.
  const [planSearch, setPlanSearch] = useState('');
  const {
    options: planOptions,
    planById,
    fetchNextPage: fetchMorePlans,
    hasNextPage: hasMorePlans,
    isLoading: isLoadingPlans,
  } = usePlanOptions(useDebounce(planSearch));

  // A static enum, so a Select is the correct control — the combobox rule is
  // about lists that come from a paginated endpoint and can outgrow a page.
  const methodOptions = usePaymentMethodOptions();

  /**
   * Whether a registration fee applies at all. `membershipStatus === 'never'`
   * is the whole test: there is no separate "has joined" flag, being a
   * first-time buyer *is* having held no membership. The server decides it
   * again from its own data — this only drives what is displayed.
   */
  const isFirstMembership = member.membershipStatus === 'never';

  /**
   * Selling and taking the money are two permissions, and `POST /memberships`
   * enforces both: sending `payment` needs `payment.record` on top of
   * `membership.sell`, or the whole sale 403s. So someone who may sell but not
   * handle cash is offered the sale alone rather than a control that would
   * fail — the membership is still recorded, with the balance settled by
   * whoever holds the till.
   */
  const canTakePayment = hasPermission('payment.record');

  const form = useForm({
    defaultValues: {
      planId: '',
      // Empty means today; the server fills it in so the gym's date is used,
      // not the browser's.
      startsOn: '',
      isComplimentary: false,
      // On by default: money changing hands at the desk is the normal sale,
      // and an instalment is the exception that has to be chosen.
      takePaymentNow: canTakePayment,
      // Cash is what the front desk takes most of.
      method: 'cash' as
        'cash' | 'telebirr' | 'cbe_birr' | 'bank_transfer' | 'card',
      reference: '',
    },
    validators: { onSubmit: sellMembershipSchema },
    onSubmit: async ({ value }) => {
      // Settled, not rethrown: an overlapping sale comes back 409 and the
      // interceptor has already toasted it. Rethrowing would leave an
      // unhandled rejection, and the dates need correcting here — so the page
      // stays put and only `onSuccess` navigates away.
      await settle(
        sellMembershipAsync({
          memberId: member.personId,
          planId: value.planId,
          startsOn: orUndefined(value.startsOn),
          isComplimentary: value.isComplimentary,
          // Omitted for a comped sale and for a plan that costs nothing — the
          // API 400s on a payment against either — and omitted when nothing was
          // handed over, which is how "800 now, the rest on Friday" begins.
          // No amount: the server charges the full figure it computed.
          ...(value.takePaymentNow &&
          !value.isComplimentary &&
          !costsNothing(planById.get(value.planId), isFirstMembership)
            ? {
                payment: {
                  method: value.method,
                  reference: orUndefined(value.reference),
                },
              }
            : {}),
        }),
      );
    },
  });

  // Read from the store rather than held alongside it, so there is one answer,
  // not two that can drift.
  const planId = useStore(form.store, (state) => state.values.planId);
  const isComplimentary = useStore(
    form.store,
    (state) => state.values.isComplimentary,
  );
  const takePaymentNow = useStore(
    form.store,
    (state) => state.values.takePaymentNow,
  );

  // Only plans on a loaded page are in the map, so a search that pages the
  // chosen row away leaves this undefined and the breakdown simply does not
  // render — it never guesses a price.
  const plan = planById.get(planId);
  const hasNothingToPay = costsNothing(plan, isFirstMembership);

  return (
    <form
      className="m-2 flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <FormPageHeader
        title={t('members.sellMembership.title')}
        subtitle={`${member.firstName} ${member.lastName} · ${member.memberCode}`}
        onBack={goToMember}
      >
        <Button type="button" variant="outline" onClick={goToMember}>
          {t('actions.cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          {t('members.sellMembership.confirm')}
        </Button>
      </FormPageHeader>

      <Card>
        <CardHeader>
          <CardTitle>{t('members.sellMembership.coverTitle')}</CardTitle>
          <CardDescription>
            {t('members.sellMembership.coverSubtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormComboboxField
            form={form}
            name="planId"
            label={t('members.fields.plan')}
            placeholder={t('members.placeholders.plan')}
            searchPlaceholder={t('members.placeholders.searchPlan')}
            options={planOptions}
            onSearch={setPlanSearch}
            onScroll={fetchMorePlans}
            hasNext={hasMorePlans}
            isLoading={isLoadingPlans}
            required
          />
          {/* No `disableFuture`: dating a membership forward is how an early
              renewal is sold — this month runs to its end, the new one picks
              up the day after, and cover is unbroken. */}
          <FormDatePickerField
            form={form}
            name="startsOn"
            label={t('members.fields.startsOn')}
            placeholder={t('members.placeholders.startsToday')}
          />
          <FormSwitchField
            form={form}
            name="isComplimentary"
            label={t('members.fields.isComplimentary')}
            description={t('members.fields.isComplimentaryHint')}
            className="sm:col-span-2"
          />
        </CardContent>
      </Card>

      {/* Nothing is owed on a comped membership and the API refuses a payment
          alongside one, so the whole card goes rather than being disabled — a
          disabled control still implies a choice. */}
      {!isComplimentary && (
        <Card>
          <CardHeader>
            <CardTitle>{t('members.sellMembership.paymentTitle')}</CardTitle>
            <CardDescription>
              {t('members.sellMembership.paymentSubtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {plan ? (
              <AmountBreakdown
                price={plan.price}
                registrationFee={feeFor(plan, isFirstMembership)}
                className="sm:col-span-2"
              />
            ) : (
              // Said outright rather than left as blank space: on a page the
              // gap between the heading and the controls is large enough to
              // read as something failing to load.
              <p className="text-sm text-muted-foreground sm:col-span-2">
                {t('members.sellMembership.pickPlanFirst')}
              </p>
            )}

            {/* A free plan with no joining fee has nothing to take, and a
                payment against a zero amount due is another 400. The breakdown
                above already reads `0.00`, so the controls just go rather than
                needing an explanation of their own. */}
            {!hasNothingToPay && canTakePayment && (
              <>
                <FormSwitchField
                  form={form}
                  name="takePaymentNow"
                  label={t('members.sellMembership.takePaymentNow')}
                  description={t('members.sellMembership.takePaymentNowHint')}
                  className="sm:col-span-2"
                />
                {takePaymentNow && (
                  <>
                    <FormSelectField
                      form={form}
                      name="method"
                      label={t('payments.fields.method')}
                      placeholder={t('payments.placeholders.method')}
                      options={methodOptions}
                      required
                    />
                    <FormTextField
                      form={form}
                      name="reference"
                      label={t('payments.fields.reference')}
                      placeholder={t('payments.placeholders.reference')}
                    />
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </form>
  );
}

/**
 * What the member is about to be asked for, and why it is that number.
 *
 * Read-only by design: there is no `amount` on the wire, so an input here would
 * be a lie about who decides. The registration line only appears when a fee is
 * actually being charged — a `0.00 ETB` row reads as a mistake, and on a
 * renewal it would be one.
 */
function AmountBreakdown({
  price,
  registrationFee,
  className,
}: {
  price: string;
  registrationFee: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const hasRegistrationFee = !isZeroAmount(registrationFee);

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md bg-muted/50 p-3 text-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">
          {t('members.sellMembership.planPrice')}
        </span>
        <span className="tabular-nums">{formatBirr(price)}</span>
      </div>
      {hasRegistrationFee && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">
            {t('members.sellMembership.registrationFee')}
          </span>
          <span className="tabular-nums">{formatBirr(registrationFee)}</span>
        </div>
      )}
      {/* The line the desk actually reads out, so it is the emphasised one. */}
      <div className="flex items-center justify-between gap-4 text-base font-medium">
        <span>{t('members.sellMembership.amountDue')}</span>
        <span className="tabular-nums">
          {formatBirr(addAmounts(price, registrationFee))}
        </span>
      </div>
      {hasRegistrationFee && (
        <p className="text-xs text-muted-foreground">
          {t('members.sellMembership.registrationFeeHint')}
        </p>
      )}
    </div>
  );
}

/** Mirrors the real layout so the page does not jump when the member lands. */
function SellMembershipSkeleton() {
  return (
    <div className="m-2 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-8 w-48" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
