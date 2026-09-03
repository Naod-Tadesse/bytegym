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
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useBranchOptions } from '@/features/branches/hooks/use-branches';
import { useRoleOptions } from '@/features/roles/hooks/use-roles';
import { useEmploymentStatusOptions } from '../components/employment-status-badge';
import { editStaffSchema, orUndefined } from '../data/schema';
import type { StaffDetail } from '../data/types';
import { useGenderOptions } from '../hooks/use-gender-options';
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
  const { options: branchOptions, isLoading: isLoadingBranches } =
    useBranchOptions();
  const { options: roleOptions, isLoading: isLoadingRoles } = useRoleOptions();
  const genderOptions = useGenderOptions();
  const statusOptions = useEmploymentStatusOptions();

  const goToDetail = () =>
    navigate({
      to: '/staff/$staffId',
      params: { staffId: staffMember.userId },
    });

  const form = useForm({
    defaultValues: {
      firstName: staffMember.firstName,
      lastName: staffMember.lastName,
      dateOfBirth: staffMember.dateOfBirth ?? '',
      gender: (staffMember.gender ?? '') as '' | 'male' | 'female',
      primaryBranchId: staffMember.branchId,
      jobTitle: staffMember.jobTitle,
      employmentStatus: staffMember.employmentStatus,
      roleIds: staffMember.roles.map((role) => role.id),
    },
    validators: { onSubmit: editStaffSchema },
    onSubmit: ({ value }) =>
      updateStaff({
        staffId: staffMember.userId,
        data: {
          firstName: value.firstName.trim(),
          lastName: value.lastName.trim(),
          dateOfBirth: orUndefined(value.dateOfBirth),
          gender: orUndefined(value.gender),
          primaryBranchId: value.primaryBranchId,
          jobTitle: value.jobTitle.trim(),
          employmentStatus: value.employmentStatus,
          roleIds: value.roleIds,
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
          <FormTextField
            form={form}
            name="jobTitle"
            label={t('staff.fields.jobTitle')}
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
          <FormSelectField
            form={form}
            name="employmentStatus"
            label={t('staff.fields.employmentStatus')}
            options={statusOptions}
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
