import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { FormPageHeader } from '@/components/form-page-header';
import { FormTextField } from '@/components/form-fields';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { branchSchema } from '../data/schema';
import { useCreateBranch } from '../hooks/use-branches';

export function CreateBranch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createBranch, isPending } = useCreateBranch();

  const goToList = () => navigate({ to: '/branches' });

  const form = useForm({
    defaultValues: { name: '', addressLine: '', city: '', phone: '' },
    validators: { onSubmit: branchSchema },
    onSubmit: ({ value }) =>
      createBranch({
        name: value.name.trim(),
        addressLine: value.addressLine.trim(),
        city: value.city.trim(),
        phone: value.phone.trim(),
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
        title={t('branches.create.title')}
        subtitle={t('branches.create.subtitle')}
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
            name="name"
            label={t('branches.fields.name')}
            placeholder={t('branches.placeholders.name')}
            required
          />
          <FormTextField
            form={form}
            name="city"
            label={t('branches.fields.city')}
            placeholder={t('branches.placeholders.city')}
          />
          <FormTextField
            form={form}
            name="phone"
            label={t('branches.fields.phone')}
            placeholder="0911000000"
            inputMode="tel"
          />
          <FormTextField
            form={form}
            name="addressLine"
            label={t('branches.fields.addressLine')}
            placeholder={t('branches.placeholders.addressLine')}
            className="sm:col-span-2"
          />
        </CardContent>
      </Card>
    </form>
  );
}
