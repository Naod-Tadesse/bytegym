import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import {
  FormDatePickerField,
  FormMultiSelectField,
  FormSelectField,
  FormTextField,
} from '@/components/form-fields';
import { FormPageHeader } from '@/components/form-page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useBranchOptions } from '@/features/branches/hooks/use-branches';
import { useRoleOptions } from '@/features/roles/hooks/use-roles';
import { createStaffSchema, orUndefined } from '../data/schema';
import { useGenderOptions } from '../hooks/use-gender-options';
import { useCreateStaff } from '../hooks/use-staff';

export function CreateStaff() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createStaff, isPending } = useCreateStaff();
  const { options: branchOptions, isLoading: isLoadingBranches } =
    useBranchOptions();
  const { options: roleOptions, isLoading: isLoadingRoles } = useRoleOptions();
  const genderOptions = useGenderOptions();

  const goToList = () => navigate({ to: '/staff' });

  const form = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      password: '',
      dateOfBirth: '',
      gender: '' as '' | 'male' | 'female',
      staffCode: '',
      primaryBranchId: '',
      jobTitle: '',
      hiredOn: '',
      roleIds: [] as string[],
    },
    validators: { onSubmit: createStaffSchema },
    onSubmit: ({ value }) =>
      createStaff({
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
        phone: value.phone.trim(),
        password: value.password,
        // The API rejects '' for these, so send nothing instead.
        dateOfBirth: orUndefined(value.dateOfBirth),
        gender: orUndefined(value.gender),
        staffCode: value.staffCode.trim(),
        primaryBranchId: value.primaryBranchId,
        jobTitle: value.jobTitle.trim(),
        hiredOn: value.hiredOn,
        roleIds: value.roleIds,
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
        title={t('staff.create.title')}
        subtitle={t('staff.create.subtitle')}
        onBack={goToList}
      >
        <Button type="button" variant="outline" onClick={goToList}>
          {t('actions.cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Spinner data-icon="inline-start" />}
          {t('actions.create')}
        </Button>
      </FormPageHeader>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormTextField
            form={form}
            name="firstName"
            label={t('staff.fields.firstName')}
            required
          />
          <FormTextField
            form={form}
            name="lastName"
            label={t('staff.fields.lastName')}
            required
          />
          {/* Local format, matching what staff will type to sign in. */}
          <FormTextField
            form={form}
            name="phone"
            label={t('staff.fields.phone')}
            placeholder="0912345678"
            inputMode="numeric"
            maxLength={10}
            autoComplete="tel"
            required
          />
          <FormTextField
            form={form}
            name="password"
            label={t('staff.fields.password')}
            type="password"
            autoComplete="new-password"
            required
          />
          <FormDatePickerField
            form={form}
            name="dateOfBirth"
            label={t('staff.fields.dateOfBirth')}
            placeholder={t('staff.placeholders.pickDate')}
            disableFuture
          />
          <FormSelectField
            form={form}
            name="gender"
            label={t('staff.fields.gender')}
            placeholder={t('staff.placeholders.gender')}
            options={genderOptions}
          />
          <FormTextField
            form={form}
            name="staffCode"
            label={t('staff.fields.staffCode')}
            placeholder="STF-001"
            required
          />
          <FormTextField
            form={form}
            name="jobTitle"
            label={t('staff.fields.jobTitle')}
            placeholder={t('staff.placeholders.jobTitle')}
            required
          />
          <FormSelectField
            form={form}
            name="primaryBranchId"
            label={t('staff.fields.branch')}
            placeholder={t('staff.placeholders.branch')}
            options={branchOptions}
            disabled={isLoadingBranches}
            required
          />
          <FormDatePickerField
            form={form}
            name="hiredOn"
            label={t('staff.fields.hiredOn')}
            placeholder={t('staff.placeholders.pickDate')}
            required
          />
          <FormMultiSelectField
            form={form}
            name="roleIds"
            label={t('staff.fields.roles')}
            placeholder={t('staff.placeholders.roles')}
            options={roleOptions}
            disabled={isLoadingRoles}
            className="sm:col-span-2"
          />
        </CardContent>
      </Card>
    </form>
  );
}
