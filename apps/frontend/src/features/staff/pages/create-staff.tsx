import { useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
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
import { useJobTitleOptions } from '../hooks/use-job-title-options';
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

  // Job titles are paginated too, and the picked one decides whether this
  // person can hold a login at all.
  const [jobTitleSearch, setJobTitleSearch] = useState('');
  const {
    options: jobTitleOptions,
    canHaveAccountById,
    fetchNextPage: fetchMoreJobTitles,
    hasNextPage: hasMoreJobTitles,
    isLoading: isLoadingJobTitles,
  } = useJobTitleOptions(useDebounce(jobTitleSearch));

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
      // Pre-filled and hidden for a scoped creator — it is the only branch
      // they could pick, and the API would reject anything else.
      primaryBranchId: canChooseBranch ? '' : (currentUser?.branchId ?? ''),
      jobTitleId: '',
      hiredOn: '',
      // A scoped creator can only ever produce branch-scoped staff at their
      // own branch, so both fields are pre-set and hidden below.
      dataScope: 'branch' as 'branch' | 'all',
      roleIds: [] as string[],
      // Mirrors the picked job title. Never sent — it only decides whether the
      // credential half of this form exists.
      canHaveAccount: false,
    },
    validators: { onSubmit: createStaffSchema },
    onSubmit: ({ value }) =>
      createStaff({
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
        phone: value.phone.trim(),
        // Omitted entirely for a title that cannot hold a login: sending one
        // is a 400, and no account row should be created at all.
        ...(value.canHaveAccount ? { password: value.password } : {}),
        // The API rejects '' for these, so send nothing instead.
        dateOfBirth: orUndefined(value.dateOfBirth),
        gender: orUndefined(value.gender),
        primaryBranchId: value.primaryBranchId,
        jobTitleId: value.jobTitleId,
        hiredOn: value.hiredOn,
        dataScope: value.dataScope,
        // Roles are held by the account, so without one the API 400s on any
        // non-empty list — the picker is hidden in that case too.
        roleIds: value.canHaveAccount ? value.roleIds : [],
      }),
  });

  // Drives which half of the form exists. Read from the store rather than
  // held alongside it, so there is one answer, not two that can drift.
  const canHaveAccount = useStore(
    form.store,
    (state) => state.values.canHaveAccount,
  );

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
          {/* Chosen before the credentials, because it decides whether there
              are any: a title with `canHaveAccount: false` is a cleaner — a
              full employee the API will not hand a login to. */}
          <FormComboboxField
            form={form}
            name="jobTitleId"
            label={t('staff.fields.jobTitle')}
            placeholder={t('staff.placeholders.jobTitle')}
            searchPlaceholder={t('staff.placeholders.searchJobTitle')}
            options={jobTitleOptions}
            onValueChange={(value) =>
              // Read the flag once, at the moment of choosing: a later search
              // can page this row out of `options` and the answer must hold.
              form.setFieldValue(
                'canHaveAccount',
                canHaveAccountById.get(value) ?? false,
              )
            }
            onSearch={setJobTitleSearch}
            onScroll={fetchMoreJobTitles}
            hasNext={hasMoreJobTitles}
            isLoading={isLoadingJobTitles}
            required
          />
          {canHaveAccount ? (
            <>
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
            </>
          ) : (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              {t('staff.create.noAccountHint')}
            </p>
          )}
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
          {/* No staff code field — the server assigns it on save. */}
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
          {/* Roles are held by the account. Offering them to someone who will
              not have one is a guaranteed 400, not a soft warning. */}
          {canHaveAccount && (
            <FormMultiSelectField
              form={form}
              name="roleIds"
              label={t('staff.fields.roles')}
              placeholder={t('staff.placeholders.roles')}
              options={roleOptions}
              disabled={isLoadingRoles}
              className="sm:col-span-2"
            />
          )}
        </CardContent>
      </Card>
    </form>
  );
}
