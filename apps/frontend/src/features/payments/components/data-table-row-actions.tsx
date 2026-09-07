import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { MoneyRemove01Icon, ViewIcon } from '@hugeicons/core-free-icons';

import { RowActions, type RowAction } from '@/components/table/row-actions';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { usePaymentContext } from '../context/payment-context';
import type { Payment } from '../data/types';

export function PaymentRowActions({ payment }: { payment: Payment }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setOpen, setCurrentRow } = usePaymentContext();
  const { hasPermission } = usePermissions();

  // Gated on the permission each endpoint actually enforces: opening the member
  // is `member.read`, not the `payment.list` that got the caller onto this
  // screen.
  const actions: RowAction[] = [
    ...(hasPermission('member.read')
      ? [
          {
            key: 'openMember',
            label: t('payments.actions.openMember'),
            icon: ViewIcon,
            onSelect: () =>
              navigate({
                to: '/members/$memberId',
                params: { memberId: payment.memberId },
              }),
          },
        ]
      : []),
    ...(hasPermission('payment.void')
      ? [
          {
            key: 'void',
            label: t('payments.actions.void'),
            icon: MoneyRemove01Icon,
            destructive: true,
            // Voiding twice is a 409. The entry stays put and says so, which
            // is also the fastest way to read that this row is already void.
            disabled: payment.voidedAt !== null,
            disabledReason: t('payments.actions.alreadyVoided'),
            onSelect: () => {
              setCurrentRow(payment);
              setOpen('void');
            },
          },
        ]
      : []),
  ];

  return <RowActions actions={actions} />;
}
