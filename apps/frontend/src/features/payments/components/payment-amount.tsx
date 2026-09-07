import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { formatBirr } from '@/lib/format';
import type { Payment } from '../data/types';

/**
 * A payment's amount, and whether it still counts.
 *
 * A voided row is shown, not hidden: reads deliberately include it so a shift
 * reconciliation can account for the cancellation, and only `totals.received`
 * leaves it out. Struck through *and* badged, so it never rests on a single
 * visual cue.
 *
 * `tabular-nums` is what makes a money column line up — without it the digits
 * are proportionally spaced and every row's decimal point sits somewhere else.
 */
export function PaymentAmount({
  payment,
}: {
  payment: Pick<Payment, 'amount' | 'voidedAt' | 'voidReason' | 'voidedByName'>;
}) {
  const { t } = useTranslation();

  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-2 whitespace-nowrap">
        <span
          className={cn(
            'tabular-nums',
            payment.voidedAt && 'line-through opacity-60',
          )}
        >
          {formatBirr(payment.amount)}
        </span>
        {payment.voidedAt && (
          <Badge variant="destructive">{t('payments.voided')}</Badge>
        )}
      </span>
      {/* On the row rather than behind a hover: the reason and the name are the
          whole point of keeping a cancelled payment on the reconciliation, and
          a `title` attribute is invisible to anyone reading down the column. */}
      {payment.voidedAt && payment.voidReason && (
        <span className="text-xs text-muted-foreground">
          {payment.voidedByName
            ? t('payments.voidedByReason', {
                name: payment.voidedByName,
                reason: payment.voidReason,
              })
            : payment.voidReason}
        </span>
      )}
    </span>
  );
}
