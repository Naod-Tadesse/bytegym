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
import { Spinner } from '@/components/ui/spinner';
import { useCurrentUser } from '@/features/auth/hooks/use-auth';
import { useBranchOptions } from '@/features/branches/hooks/use-branches';
import { useGenderOptions } from '@/features/staff/hooks/use-gender-options';
import { useDebounce } from '@/hooks/use-debounce';
import { createMemberSchema, orUndefined } from '../data/schema';
import { useCreateMember } from '../hooks/use-members';

export function CreateMember() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createMember, isPending } = useCreateMember();

  // Branches are a paginated endpoint, so the picker searches and pages
  // server-side rather than pulling one oversized page and hoping it covers
  // everything.
  const [branchSearch, setBranchSearch] = useState('');
  const {
    options: branchOptions,
    fetchNextPage: fetchMoreBranches,
    hasNextPage: hasMoreBranches,
    isLoading: isLoadingBranches,
  } = useBranchOptions(useDebounce(branchSearch));

  const genderOptions = useGenderOptions();

  // A branch-scoped receptionist can only register at their own branch — the
  // API's `assertCanWriteToBranch` throws Forbidden otherwise, so do not offer
  // a choice that is guaranteed to fail.
  const { data: currentUser } = useCurrentUser();
  const canChooseBranch = currentUser?.dataScope === 'all';

  const goToList = () => navigate({ to: '/members' });

  const form = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      dateOfBirth: '',
      gender: '' as '' | 'male' | 'female',
      // Pre-filled and hidden for a scoped creator — it is the only branch
      // they could pick.
      branchId: canChooseBranch ? '' : (currentUser?.branchId ?? ''),
      emergencyContactName: '',
      emergencyContactPhone: '',
    },
    validators: { onSubmit: createMemberSchema },
    onSubmit: ({ value }) =>
      createMember({
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
        phone: value.phone.trim(),
        // The API rejects '' for these, so send nothing instead.
        dateOfBirth: orUndefined(value.dateOfBirth),
        gender: orUndefined(value.gender),
        branchId: value.branchId,
        emergencyContactName: orUndefined(value.emergencyContactName),
        emergencyContactPhone: orUndefined(value.emergencyContactPhone),
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
        title={t('members.create.title')}
        subtitle={t('members.create.subtitle')}
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
            label={t('members.fields.firstName')}
            required
          />
          <FormTextField
            form={form}
            name="lastName"
            label={t('members.fields.lastName')}
            required
          />
          {/* NOT FormPhoneField: that one stores +251 E.164, and this API
              stores and validates the local form, 0912345678. */}
          <FormTextField
            form={form}
            name="phone"
            label={t('members.fields.phone')}
            placeholder="0912345678"
            inputMode="numeric"
            maxLength={10}
            autoComplete="tel"
            required
          />
          <FormDatePickerField
            form={form}
            name="dateOfBirth"
            label={t('members.fields.dateOfBirth')}
            placeholder={t('members.placeholders.pickDate')}
            disableFuture
          />
          {/* A fixed two-value enum written in code, so a Select is right —
              unlike the branch below, this list cannot grow past the page. */}
          <FormSelectField
            form={form}
            name="gender"
            label={t('members.fields.gender')}
            placeholder={t('members.placeholders.gender')}
            options={genderOptions}
          />
          {/* No member code field — the server assigns it (MBR00001, …). */}
          {canChooseBranch && (
            <FormComboboxField
              form={form}
              name="branchId"
              label={t('members.fields.branch')}
              placeholder={t('members.placeholders.branch')}
              searchPlaceholder={t('members.placeholders.searchBranch')}
              options={branchOptions}
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
