import { useForm } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';

import { FormTextField } from '@/components/form-fields';
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
import { settle } from '@/lib/settle';
import { resetPasswordSchema } from '../data/schema';
import type { StaffListItem } from '../data/types';
import { useResetStaffPassword } from '../hooks/use-staff';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffMember: Pick<StaffListItem, 'userId' | 'firstName' | 'lastName'>;
}

/** Two inputs, so a dialog rather than a page. */
export function ResetPasswordDialog({
  open,
  onOpenChange,
  staffMember,
}: ResetPasswordDialogProps) {
  const { t } = useTranslation();
  const close = () => onOpenChange(false);
  const { resetPasswordAsync, isPending } = useResetStaffPassword(close);

  const form = useForm({
    defaultValues: { newPassword: '', confirmPassword: '' },
    validators: { onSubmit: resetPasswordSchema },
    onSubmit: async ({ value }) => {
      await settle(
        resetPasswordAsync({
          staffId: staffMember.userId,
          // confirmPassword is a typo guard for the form only.
          newPassword: value.newPassword,
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
            <DialogTitle>{t('staff.resetPassword.title')}</DialogTitle>
            <DialogDescription>
              {t('staff.resetPassword.description', {
                name: `${staffMember.firstName} ${staffMember.lastName}`,
              })}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="my-4">
            <FormTextField
              form={form}
              name="newPassword"
              label={t('staff.fields.newPassword')}
              type="password"
              autoComplete="new-password"
              required
            />
            <FormTextField
              form={form}
              name="confirmPassword"
              label={t('staff.fields.confirmPassword')}
              type="password"
              autoComplete="new-password"
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
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner data-icon="inline-start" />}
              {t('staff.resetPassword.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
