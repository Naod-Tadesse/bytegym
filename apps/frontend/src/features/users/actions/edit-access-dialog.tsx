import { useForm } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';

import { FormMultiSelectField, FormSelectField } from '@/components/form-fields';
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
import { useCurrentUser } from '@/features/auth/hooks/use-auth';
import { useRoleOptions } from '@/features/roles/hooks/use-roles';
import { useDataScopeOptions } from '@/features/staff/hooks/use-data-scope-options';
import type { DataScope } from '@/features/staff/data/types';
import { settle } from '@/lib/settle';
import { editAccessSchema } from '../data/schema';
import type { UserListItem } from '../data/types';
import { useSetAuthorization } from '../hooks/use-users';

interface EditAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserListItem;
}

/**
 * What this person may reach once signed in — as opposed to whether they can
 * sign in at all, which is every other dialog here.
 *
 * Lives on Users rather than the staff edit form because it is an access
 * decision, and the endpoint behind it answers to `role.assign` rather than
 * `staff.update`: someone can manage access without also being able to rename
 * people or change their job title.
 *
 * Two inputs, so a dialog.
 */
export function EditAccessDialog({
  open,
  onOpenChange,
  user,
}: EditAccessDialogProps) {
  const { t } = useTranslation();
  const close = () => onOpenChange(false);
  const { setAuthorizationAsync, isPending } = useSetAuthorization(close);
  const { options: roleOptions, isLoading: isLoadingRoles } = useRoleOptions();
  const dataScopeOptions = useDataScopeOptions();
  const { data: currentUser } = useCurrentUser();

  // A branch-scoped caller cannot grant `all` — the API 403s — so the field is
  // hidden rather than shown and rejected. Same rule as the staff forms.
  const canChooseScope = currentUser?.dataScope === 'all';

  const form = useForm({
    defaultValues: {
      roleIds: user.roles.map((role) => role.id),
      dataScope: user.dataScope as DataScope,
    },
    validators: { onSubmit: editAccessSchema },
    onSubmit: async ({ value }) =>
      // Settled, not rethrown: the interceptor has already toasted anything
      // that failed, and an unhandled rejection would tear down the dialog
      // showing it.
      settle(
        setAuthorizationAsync({
          staffId: user.personId,
          roleIds: value.roleIds,
          // Only send it when it was actually offered, so a branch-scoped
          // caller cannot echo back a value they never saw.
          ...(canChooseScope ? { dataScope: value.dataScope } : {}),
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
            <DialogTitle>{t('users.editAccess.title')}</DialogTitle>
            <DialogDescription>
              {t('users.editAccess.description', {
                name: `${user.firstName} ${user.lastName}`,
              })}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <FormMultiSelectField
              form={form}
              name="roleIds"
              label={t('users.fields.roles')}
              placeholder={t('users.placeholders.roles')}
              options={roleOptions}
              disabled={isLoadingRoles}
            />
            {canChooseScope && (
              <FormSelectField
                form={form}
                name="dataScope"
                label={t('users.fields.dataScope')}
                options={dataScopeOptions}
              />
            )}
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner />}
              {t('users.editAccess.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
