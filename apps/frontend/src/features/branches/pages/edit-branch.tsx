import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { FormPageHeader } from '@/components/form-page-header';
import { FormSwitchField, FormTextField } from '@/components/form-fields';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { editBranchSchema } from '../data/schema';
import type { Branch } from '../data/types';
import { useBranch, useUpdateBranch } from '../hooks/use-branches';

/**
 * Split in two on purpose: the outer half resolves the record, the inner half
 * only ever renders with it. That way `defaultValues` are correct on the very
 * first render and no `reset()` effect is needed.
 */
export function EditBranch({ branchId }: { branchId: string }) {
  const { branch, isLoading } = useBranch(branchId);

  if (isLoading) return <EditBranchSkeleton />;
  if (!branch) return null;

  return <EditBranchForm branch={branch} />;
}

function EditBranchForm({ branch }: { branch: Branch }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { updateBranch, isPending } = useUpdateBranch();

  const goToList = () => navigate({ to: '/branches' });

  const form = useForm({
    defaultValues: {
      name: branch.name,
      addressLine: branch.addressLine ?? '',
      city: branch.city ?? '',
      phone: branch.phone ?? '',
      isActive: branch.isActive,
    },
    validators: { onSubmit: editBranchSchema },
    onSubmit: ({ value }) =>
      updateBranch({
        branchId: branch.id,
        data: {
          name: value.name.trim(),
          addressLine: value.addressLine.trim(),
          city: value.city.trim(),
          phone: value.phone.trim(),
          isActive: value.isActive,
        },
      }),
  });

  return (
    <form
      className="m-2 flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <FormPageHeader
        title={t('branches.edit.title')}
        subtitle={branch.name}
        onBack={goToList}
      >
        <Button type="button" variant="outline" onClick={goToList}>
          {t('actions.cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          {t('actions.save')}
        </Button>
      </FormPageHeader>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormTextField
            form={form}
            name="name"
            label={t('branches.fields.name')}
            required
          />
          <FormTextField
            form={form}
            name="city"
            label={t('branches.fields.city')}
          />
          <FormTextField
            form={form}
            name="phone"
            label={t('branches.fields.phone')}
            inputMode="tel"
          />
          <FormTextField
            form={form}
            name="addressLine"
            label={t('branches.fields.addressLine')}
            className="sm:col-span-2"
          />
          <FormSwitchField
            form={form}
            name="isActive"
            label={t('branches.fields.isActive')}
            description={t('branches.fields.isActiveHint')}
            className="sm:col-span-2"
          />
        </CardContent>
      </Card>
    </form>
  );
}

/** Mirrors the real layout so the page does not jump when data lands. */
function EditBranchSkeleton() {
  return (
    <div className="m-2 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-8 w-48" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
