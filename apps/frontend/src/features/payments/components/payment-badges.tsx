import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import type { PaymentMethod } from '../data/types';
import { PAYMENT_METHODS } from '../data/types';

/**
 * Full literal i18n keys, never built from the enum value — `strictKeyChecks`
 * rejects a template-literal key. The map is also where `cbe_birr` becomes
 * `cbeBirr`, the same way `on_leave` becomes `onLeave` for staff.
 */
const METHOD_LABEL = {
  cash: 'payments.method.cash',
  telebirr: 'payments.method.telebirr',
  cbe_birr: 'payments.method.cbeBirr',
  bank_transfer: 'payments.method.bankTransfer',
  card: 'payments.method.card',
} as const;

/** How it was taken — cash reconciles against the drawer, the rest do not. */
export function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  const { t } = useTranslation();
  return (
    <Badge variant={method === 'cash' ? 'default' : 'secondary'}>
      {t(METHOD_LABEL[method])}
    </Badge>
  );
}

/** A static enum, so a `Select` is the right control — not a combobox. */
export function usePaymentMethodOptions() {
  const { t } = useTranslation();
  return PAYMENT_METHODS.map((method) => ({
    value: method,
    label: t(METHOD_LABEL[method]),
  }));
}
