import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import {
  FormComboboxField,
  FormDatePickerField,
  FormSelectField,
  FormTextField,
} from '@/components/form-fields';
import { FormPageHeader } from '@/components/form-page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useCurrentUser } from '@/features/auth/hooks/use-auth';
import { useBranchOptions } from '@/features/branches/hooks/use-branches';
import { useDebounce } from '@/hooks/use-debounce';
import { useEmploymentStatusOptions } from '../components/employment-status-badge';
import { editStaffSchema, orUndefined } from '../data/schema';
import type { StaffDetail } from '../data/types';
import { useGenderOptions } from '../hooks/use-gender-options';
import { useJobTitleOptions } from '../hooks/use-job-title-options';
import { useStaffMember, useUpdateStaff } from '../hooks/use-staff';

/** Outer half resolves the record; the inner half only renders with it. */
export function EditStaff({ staffId }: { staffId: string }) {
  const { staffMember, isLoading } = useStaffMember(staffId);

  if (isLoading) return <EditStaffSkeleton />;
  if (!staffMember) return null;

  return <EditStaffForm staffMember={staffMember} />;
}

function EditStaffForm({ staffMember }: { staffMember: StaffDetail }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { updateStaff, isPending } = useUpdateStaff();
  // Branches are paginated, so the picker searches and pages server-side.
  const [branchSearch, setBranchSearch] = useState('');
  const {
    options: branchOptions,
    fetchNextPage: fetchMoreBranches,
    hasNextPage: hasMoreBranches,
    isLoading: isLoadingBranches,
  } = useBranchOptions(useDebounce(branchSearch));

  // Job titles are paginated too, so the same server-side picker.
  const [jobTitleSearch, setJobTitleSearch] = useState('');
  const {
    options: jobTitleOptions,
    fetchNextPage: fetchMoreJobTitles,
    hasNextPage: hasMoreJobTitles,
    isLoading: isLoadingJobTitles,
  } = useJobTitleOptions(useDebounce(jobTitleSearch));

  const genderOptions = useGenderOptions();
  const statusOptions = useEmploymentStatusOptions();

  // Same rule as create: a scoped editor cannot move someone to another
  // branch, so the control is not offered.
  const { data: currentUser } = useCurrentUser();
  const canChooseBranch = currentUser?.dataScope === 'all';

  const goToDetail = () =>
    navigate({
      to: '/staff/$staffId',
      params: { staffId: staffMember.personId },
    });

  const form = useForm({
    defaultValues: {
      firstName: staffMember.firstName,
      lastName: staffMember.lastName,
      dateOfBirth: staffMember.dateOfBirth ?? '',
      gender: (staffMember.gender ?? '') as '' | 'male' | 'female',
      primaryBranchId: staffMember.branchId,
      jobTitleId: staffMember.jobTitleId,
      employmentStatus: staffMember.employmentStatus,
    },
    validators: { onSubmit: editStaffSchema },
    onSubmit: ({ value }) =>
      updateStaff({
        staffId: staffMember.personId,
        data: {
          firstName: value.firstName.trim(),
          lastName: value.lastName.trim(),
          dateOfBirth: orUndefined(value.dateOfBirth),
          gender: orUndefined(value.gender),
          primaryBranchId: value.primaryBranchId,
          jobTitleId: value.jobTitleId,
          employmentStatus: value.employmentStatus,
          // No `dataScope` and no `roleIds`: both are access decisions, made
          // on the users screen. Sending either from here would silently
          // reissue someone's permissions from an HR form.
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
        title={t('staff.edit.title')}
        subtitle={`${staffMember.firstName} ${staffMember.lastName} · ${staffMember.staffCode}`}
        onBack={goToDetail}
      >
        <Button type="button" variant="outline" onClick={goToDetail}>
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
          {/* Phone, password and staff code are deliberately absent: the API
              does not accept them here, and a password change is its own flow. */}
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
          <FormComboboxField
            form={form}
            name="jobTitleId"
            label={t('staff.fields.jobTitle')}
            placeholder={t('staff.placeholders.jobTitle')}
            searchPlaceholder={t('staff.placeholders.searchJobTitle')}
            options={jobTitleOptions}
            // The saved title may sit on a page that was never loaded, or be
            // filtered out by a search — without this the trigger renders
            // empty and the field looks unset.
            selectedOption={{
              value: staffMember.jobTitleId,
              label: staffMember.jobTitle,
            }}
            onSearch={setJobTitleSearch}
            onScroll={fetchMoreJobTitles}
            hasNext={hasMoreJobTitles}
            isLoading={isLoadingJobTitles}
            required
          />
          {canChooseBranch && (
            <FormComboboxField
              form={form}
              name="primaryBranchId"
              label={t('staff.fields.branch')}
              placeholder={t('staff.placeholders.branch')}
              searchPlaceholder={t('staff.placeholders.searchBranch')}
              options={branchOptions}
              // The saved branch may sit on a page that was never loaded, or
              // be filtered out by a search — without this the trigger
              // renders empty.
              selectedOption={{
                value: staffMember.branchId,
                label: staffMember.branchName,
              }}
              onSearch={setBranchSearch}
              onScroll={fetchMoreBranches}
              hasNext={hasMoreBranches}
              isLoading={isLoadingBranches}
              required
            />
          )}
          <FormSelectField
            form={form}
            name="employmentStatus"
            label={t('staff.fields.employmentStatus')}
            options={statusOptions}
            required
          />
          {/* Roles and data scope are not here on purpose: they decide what
              this person may reach, not what they do for a living. Both are
              edited from the users screen. */}
          <p className="text-sm text-muted-foreground sm:col-span-2">
            {t('staff.edit.accessHint')}
          </p>
        </CardContent>
      </Card>
    </form>
  );
}

function EditStaffSkeleton() {
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
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
