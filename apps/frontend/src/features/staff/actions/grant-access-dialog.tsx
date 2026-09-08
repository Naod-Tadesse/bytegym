import { useForm } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';

import { FormMultiSelectField, FormTextField } from '@/components/form-fields';
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
import { useRoleOptions } from '@/features/roles/hooks/use-roles';
import { settle } from '@/lib/settle';
import { grantAccessSchema } from '../data/schema';
import type { StaffListItem } from '../data/types';
import { useGrantStaffAccess } from '../hooks/use-staff';

interface GrantAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffMember: Pick<StaffListItem, 'personId' | 'firstName' | 'lastName'>;
}

/**
 * Creates the account that lets an existing employee sign in for the first
 * time — the one-time transition from someone on the roster to someone who
 * uses the system.
 *
 * It lives here rather than on Users because it is the only access action
 * whose subject is NOT already a user: everything else there operates on a row
 * that page can show. Ongoing credential management — reset, disable, revoke —
 * stays in `features/users`.
 */
export function GrantAccessDialog({
  open,
  onOpenChange,
  staffMember,
}: GrantAccessDialogProps) {
  const { t } = useTranslation();
  const close = () => onOpenChange(false);
  const { grantAccessAsync, isPending } = useGrantStaffAccess(close);
  const { options: roleOptions, isLoading: isLoadingRoles } = useRoleOptions();

  const form = useForm({
    defaultValues: {
      roleIds: [] as string[],
      password: '',
      confirmPassword: '',
    },
    validators: { onSubmit: grantAccessSchema },
    onSubmit: async ({ value }) =>
      // Settled, not rethrown: a 400 (the job title forbids a login — a
      // cleaner — or they are terminated) already surfaced through the
      // interceptor, and the dialog should stay open rather than unmount the
      // toast that says so.
      settle(
        grantAccessAsync({
          staffId: staffMember.personId,
          // confirmPassword is a typo guard for the form only.
          password: value.password,
          roleIds: value.roleIds,
        }),
      ),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('staff.grantAccess.title')}</DialogTitle>
            <DialogDescription>
              {t('staff.grantAccess.description', {
                name: `${staffMember.firstName} ${staffMember.lastName}`,
              })}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="my-4">
            <FormMultiSelectField
              form={form}
              name="roleIds"
              label={t('staff.fields.roles')}
              placeholder={t('staff.placeholders.roles')}
              options={roleOptions}
              disabled={isLoadingRoles}
            />
            <FormTextField
              form={form}
              name="password"
              label={t('staff.fields.password')}
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
              {t('staff.grantAccess.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
