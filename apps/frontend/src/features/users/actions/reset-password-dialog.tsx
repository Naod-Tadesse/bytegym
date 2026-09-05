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
import type { UserListItem } from '../data/types';
import { useResetPassword } from '../hooks/use-users';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: Pick<UserListItem, 'personId' | 'firstName' | 'lastName'>;
}

/** Two inputs, so a dialog rather than a page. */
export function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
}: ResetPasswordDialogProps) {
  const { t } = useTranslation();
  const close = () => onOpenChange(false);
  const { resetPasswordAsync, isPending } = useResetPassword(close);

  const form = useForm({
    defaultValues: { newPassword: '', confirmPassword: '' },
    validators: { onSubmit: resetPasswordSchema },
    onSubmit: async ({ value }) => {
      // Settled, not rethrown: the interceptor has already toasted anything
      // that failed, and an unhandled rejection would tear down the dialog
      // showing it.
      await settle(
        resetPasswordAsync({
          staffId: user.personId,
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
            <DialogTitle>{t('users.resetPassword.title')}</DialogTitle>
            <DialogDescription>
              {t('users.resetPassword.description', {
                name: `${user.firstName} ${user.lastName}`,
              })}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="my-4">
            <FormTextField
              form={form}
              name="newPassword"
              label={t('users.fields.newPassword')}
              type="password"
              autoComplete="new-password"
              required
            />
            <FormTextField
              form={form}
              name="confirmPassword"
              label={t('users.fields.confirmPassword')}
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
              {t('users.resetPassword.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
