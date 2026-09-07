import { useForm } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';

import { FormSelectField, FormTextField } from '@/components/form-fields';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { usePaymentMethodOptions } from '@/features/payments/components/payment-badges';
import {
  recordPaymentSchema,
  type RecordPaymentFormData,
} from '@/features/payments/data/schema';
import { useRecordPayment } from '@/features/payments/hooks/use-payments';
import { formatBirr } from '@/lib/format';
import { settle } from '@/lib/settle';
import { orUndefined } from '../data/schema';
import type { MemberDetail, Membership } from '../data/types';

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Pick<MemberDetail, 'personId' | 'firstName' | 'lastName'>;
  /**
   * The membership being paid off. **Required** — `POST /payments` now demands
   * a `membershipId`, because a registration fee is part of a membership's
   * `amountDue` rather than a payment standing on its own. There is no
   * standalone form here any more; the dialog opens from a membership row.
   */
  membership: Membership;
}

/**
 * The instalment path: a membership sold with part of the money handed over —
 * or none of it — is settled from here. The sale itself takes the first
 * payment, so this is what "the rest on Friday" opens.
 *
 * Three inputs, so a dialog rather than a page — and it opens from the member's
 * own record, which is the only place a payment is ever taken from.
 *
 * Mount it with a `key` that includes the membership id: the defaults below are
 * read once, so retargeting the dialog at a different row without remounting
 * would carry the previous balance over.
 */
export function RecordPaymentDialog({
  open,
  onOpenChange,
  member,
  membership,
}: RecordPaymentDialogProps) {
  const { t } = useTranslation();

  const close = () => onOpenChange(false);
  const { recordPaymentAsync, isPending } = useRecordPayment(close);

  // A static enum, so a Select is the correct control here — the combobox rule
  // is about lists that come from a paginated endpoint and can outgrow a page.
  const methodOptions = usePaymentMethodOptions();

  // Annotated, not inferred: without it `method` narrows to the one literal
  // seeded here and the Select's other options no longer typecheck.
  const defaultValues: RecordPaymentFormData = {
    // The outstanding balance is what is about to be handed over in nearly
    // every case — carried across as the string the API returned, never
    // re-derived by arithmetic here. It stays editable, because a part payment
    // is the whole reason this dialog exists.
    amount: membership.balance,
    // Cash is what the front desk takes most of.
    method: 'cash',
    reference: '',
  };

  const form = useForm({
    defaultValues,
    validators: { onSubmit: recordPaymentSchema },
    onSubmit: async ({ value }) => {
      // Settled, not rethrown: the interceptor has already toasted whatever
      // failed, and an unhandled rejection would tear down the dialog showing
      // it — with the amount that still needs correcting inside.
      await settle(
        recordPaymentAsync({
          memberId: member.personId,
          membershipId: membership.id,
          amount: value.amount,
          method: value.method,
          reference: orUndefined(value.reference),
        }),
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('payments.record.title')}</DialogTitle>
            <DialogDescription>
              {t('payments.record.descriptionForMembership', {
                name: `${member.firstName} ${member.lastName}`,
                plan: membership.planName,
                balance: formatBirr(membership.balance),
              })}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="my-4">
            {/* Not type="number": a decimal string must survive round-tripping
                unparsed, exactly as the plan price does. */}
            <FormTextField
              form={form}
              name="amount"
              label={t('payments.fields.amount')}
              placeholder={t('payments.placeholders.amount')}
              inputMode="decimal"
              required
            />
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
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={close}
              disabled={isPending}
            >
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner data-icon="inline-start" />}
              {t('payments.record.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
