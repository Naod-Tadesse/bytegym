import { useForm } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';

import {
  FormSwitchField,
  FormTextareaField,
  FormTextField,
} from '@/components/form-fields';
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
import { editRoleSchema } from '../data/schema';
import type { Role } from '../data/types';
import { useCreateRole, useUpdateRole } from '../hooks/use-roles';

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present means edit. Absent means create. */
  role?: Role | null;
}

/**
 * One dialog for both modes. The caller keys it by row, so switching target
 * remounts it and `defaultValues` are always right on first render.
 */
export function RoleFormDialog({
  open,
  onOpenChange,
  role,
}: RoleFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = !!role;

  const close = () => onOpenChange(false);
  const { createRoleAsync, isPending: isCreating } = useCreateRole(close);
  const { updateRoleAsync, isPending: isUpdating } = useUpdateRole(close);
  const isPending = isCreating || isUpdating;

  const form = useForm({
    defaultValues: {
      name: role?.name ?? '',
      description: role?.description ?? '',
      isActive: role?.isActive ?? true,
    },
    // Always the wider schema: `isActive` is in form state either way, it is
    // just not shown — and only sent — when creating.
    validators: { onSubmit: editRoleSchema },
    onSubmit: async ({ value }) => {
      const payload = {
        name: value.name.trim(),
        description: value.description.trim(),
      };

      // Settled, not rethrown: a 409 already surfaced through the interceptor,
      // and the dialog stays open so the name can be corrected.
      if (role) {
        await settle(
          updateRoleAsync({
            roleId: role.id,
            data: { ...payload, isActive: value.isActive },
          }),
        );
      } else {
        await settle(createRoleAsync(payload));
      }
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
            <DialogTitle>
              {isEdit ? t('roles.edit.title') : t('roles.create.title')}
            </DialogTitle>
            <DialogDescription>
              {isEdit ? t('roles.edit.subtitle') : t('roles.create.subtitle')}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="my-4">
            <FormTextField
              form={form}
              name="name"
              label={t('roles.fields.name')}
              placeholder={t('roles.placeholders.name')}
              required
            />
            <FormTextareaField
              form={form}
              name="description"
              label={t('roles.fields.description')}
              placeholder={t('roles.placeholders.description')}
            />
            {isEdit && (
              <FormSwitchField
                form={form}
                name="isActive"
                label={t('roles.fields.isActive')}
                description={t('roles.fields.isActiveHint')}
              />
            )}
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
              {isEdit ? t('actions.save') : t('actions.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
