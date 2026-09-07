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
import { useGenderOptions } from '@/features/staff/hooks/use-gender-options';
import { useDebounce } from '@/hooks/use-debounce';
import { editMemberSchema, orUndefined } from '../data/schema';
import type { MemberDetail } from '../data/types';
import { useMember, useUpdateMember } from '../hooks/use-members';

/**
 * Split in two on purpose: the outer half resolves the record, the inner half
 * only ever renders with it. That way `defaultValues` are correct on the very
 * first render and no `reset()` effect is needed.
 */
export function EditMember({ memberId }: { memberId: string }) {
  const { member, isLoading } = useMember(memberId);

  if (isLoading) return <EditMemberSkeleton />;
  if (!member) return null;

  return <EditMemberForm member={member} />;
}

function EditMemberForm({ member }: { member: MemberDetail }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { updateMember, isPending } = useUpdateMember();

  // Branches are paginated, so the picker searches and pages server-side.
  const [branchSearch, setBranchSearch] = useState('');
  const {
    options: branchOptions,
    fetchNextPage: fetchMoreBranches,
    hasNextPage: hasMoreBranches,
    isLoading: isLoadingBranches,
  } = useBranchOptions(useDebounce(branchSearch));

  const genderOptions = useGenderOptions();

  // Same rule as create: a scoped editor cannot move someone to another
  // branch, so the control is not offered.
  const { data: currentUser } = useCurrentUser();
  const canChooseBranch = currentUser?.dataScope === 'all';

  const goToList = () => navigate({ to: '/members' });

  const form = useForm({
    defaultValues: {
      firstName: member.firstName,
      lastName: member.lastName,
      dateOfBirth: member.dateOfBirth ?? '',
      gender: (member.gender ?? '') as '' | 'male' | 'female',
      branchId: member.branchId,
      emergencyContactName: member.emergencyContactName ?? '',
      emergencyContactPhone: member.emergencyContactPhone ?? '',
    },
    validators: { onSubmit: editMemberSchema },
    onSubmit: ({ value }) =>
      updateMember({
        memberId: member.personId,
        data: {
          firstName: value.firstName.trim(),
          lastName: value.lastName.trim(),
          dateOfBirth: orUndefined(value.dateOfBirth),
          gender: orUndefined(value.gender),
          branchId: value.branchId,
          emergencyContactName: orUndefined(value.emergencyContactName),
          emergencyContactPhone: orUndefined(value.emergencyContactPhone),
          // No `phone`: it is immutable once the person exists, and no
          // `isSuspended` — barring someone is its own endpoint, not an edit.
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
        title={t('members.edit.title')}
        subtitle={`${member.firstName} ${member.lastName} · ${member.memberCode}`}
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
            name="firstName"
            label={t('members.fields.firstName')}
            required
          />
          <FormTextField
            form={form}
            name="lastName"
            label={t('members.fields.lastName')}
            required
          />
          {/* Phone is deliberately absent: the API does not accept it here. */}
          <FormDatePickerField
            form={form}
            name="dateOfBirth"
            label={t('members.fields.dateOfBirth')}
            placeholder={t('members.placeholders.pickDate')}
            disableFuture
          />
          <FormSelectField
            form={form}
            name="gender"
            label={t('members.fields.gender')}
            placeholder={t('members.placeholders.gender')}
            options={genderOptions}
          />
          {canChooseBranch && (
            <FormComboboxField
              form={form}
              name="branchId"
              label={t('members.fields.branch')}
              placeholder={t('members.placeholders.branch')}
              searchPlaceholder={t('members.placeholders.searchBranch')}
              options={branchOptions}
              // The saved branch may sit on a page that was never loaded, or
              // be filtered out by a search — without this the trigger renders
              // empty and the field looks unset.
              selectedOption={{
                value: member.branchId,
                label: member.branchName,
              }}
              onSearch={setBranchSearch}
              onScroll={fetchMoreBranches}
              hasNext={hasMoreBranches}
              isLoading={isLoadingBranches}
              required
            />
          )}
          <FormTextField
            form={form}
            name="emergencyContactName"
            label={t('members.fields.emergencyContactName')}
            className="sm:col-span-2"
          />
          <FormTextField
            form={form}
            name="emergencyContactPhone"
            label={t('members.fields.emergencyContactPhone')}
            placeholder="0911000000"
            inputMode="tel"
            className="sm:col-span-2"
          />
        </CardContent>
      </Card>
    </form>
  );
}

/** Mirrors the real layout so the page does not jump when data lands. */
function EditMemberSkeleton() {
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
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
