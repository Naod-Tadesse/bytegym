import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import {
  FormComboboxField,
  FormDatePickerField,
  FormMultiSelectField,
  FormSelectField,
  FormTextField,
} from '@/components/form-fields';
import { FormPageHeader } from '@/components/form-page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useCurrentUser } from '@/features/auth/hooks/use-auth';
import { useBranchOptions } from '@/features/branches/hooks/use-branches';
import { useRoleOptions } from '@/features/roles/hooks/use-roles';
import { useDebounce } from '@/hooks/use-debounce';
import { createStaffSchema, orUndefined } from '../data/schema';
import { useDataScopeOptions } from '../hooks/use-data-scope-options';
import { useGenderOptions } from '../hooks/use-gender-options';
import { useCreateStaff } from '../hooks/use-staff';

export function CreateStaff() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createStaff, isPending } = useCreateStaff();

  // Branches are paginated, so the picker searches and pages server-side.
  const [branchSearch, setBranchSearch] = useState('');
  const {
    options: branchOptions,
    fetchNextPage: fetchMoreBranches,
    hasNextPage: hasMoreBranches,
    isLoading: isLoadingBranches,
  } = useBranchOptions(useDebounce(branchSearch));

  const { options: roleOptions, isLoading: isLoadingRoles } = useRoleOptions();
  const genderOptions = useGenderOptions();
  const dataScopeOptions = useDataScopeOptions();

  // A branch-scoped creator can only staff their own branch, and cannot hand
  // out all-branch access — the API refuses both, so don't offer them.
  const { data: currentUser } = useCurrentUser();
  const canChooseBranch = currentUser?.dataScope === 'all';

  const goToList = () => navigate({ to: '/staff' });

  const form = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      password: '',
      confirmPassword: '',
      dateOfBirth: '',
      gender: '' as '' | 'male' | 'female',
      staffCode: '',
      // Pre-filled and hidden for a scoped creator — it is the only branch
      // they could pick, and the API would reject anything else.
      primaryBranchId: canChooseBranch ? '' : (currentUser?.branchId ?? ''),
      jobTitle: '',
      hiredOn: '',
      // A scoped creator can only ever produce branch-scoped staff at their
      // own branch, so both fields are pre-set and hidden below.
      dataScope: 'branch' as 'branch' | 'all',
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
        dataScope: value.dataScope,
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
          {/* Typo guard only — the API never receives this. */}
          <FormTextField
            form={form}
            name="confirmPassword"
            label={t('staff.fields.confirmPassword')}
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
          {canChooseBranch && (
            <>
              <FormComboboxField
                form={form}
                name="primaryBranchId"
                label={t('staff.fields.branch')}
                placeholder={t('staff.placeholders.branch')}
                searchPlaceholder={t('staff.placeholders.searchBranch')}
                options={branchOptions}
                onSearch={setBranchSearch}
                onScroll={fetchMoreBranches}
                hasNext={hasMoreBranches}
                isLoading={isLoadingBranches}
                required
              />
              <FormSelectField
                form={form}
                name="dataScope"
                label={t('staff.fields.dataScope')}
                options={dataScopeOptions}
                required
              />
            </>
          )}
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
