import { useForm } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';

import { FormTextareaField } from '@/components/form-fields';
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
import { formatBirr } from '@/lib/format';
import { settle } from '@/lib/settle';
import { voidPaymentSchema } from '../data/schema';
import type { Payment } from '../data/types';
import { useVoidPayment } from '../hooks/use-payments';

interface VoidPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment;
}

/**
 * A form dialog, not a `ConfirmDialog`: the reason is required, and it is the
 * only account of why a cancelled payment is sitting on the record that anyone
 * reconciling a shift will ever get.
 */
export function VoidPaymentDialog({
  open,
  onOpenChange,
  payment,
}: VoidPaymentDialogProps) {
  const { t } = useTranslation();

  const close = () => onOpenChange(false);
  const { voidPaymentAsync, isPending } = useVoidPayment(close);

  const form = useForm({
    defaultValues: { reason: '' },
    validators: { onSubmit: voidPaymentSchema },
    onSubmit: async ({ value }) => {
      // Settled, not rethrown: voiding a payment someone else already voided
      // comes back 409 and the interceptor has toasted it. Rethrowing would
      // unmount the dialog showing the message.
      await settle(
        voidPaymentAsync({ paymentId: payment.id, reason: value.reason }),
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
            <DialogTitle>{t('payments.void.title')}</DialogTitle>
            {/* Says plainly that the row survives — someone expecting a delete
                would otherwise void it twice looking for the disappearance. */}
            <DialogDescription>
              {t('payments.void.description', {
                amount: formatBirr(payment.amount),
                name: payment.memberName,
              })}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="my-4">
            <FormTextareaField
              form={form}
              name="reason"
              label={t('payments.fields.reason')}
              placeholder={t('payments.placeholders.reason')}
              rows={3}
              required
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
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending && <Spinner data-icon="inline-start" />}
              {t('payments.void.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
