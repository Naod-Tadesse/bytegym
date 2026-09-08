import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { FormTextareaField, FormTextField } from '@/components/form-fields';
import { FormPageHeader } from '@/components/form-page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { planSchema } from '../data/schema';
import { useCreateMembershipPlan } from '../hooks/use-membership-plans';

export function CreateMembershipPlan() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createPlan, isPending } = useCreateMembershipPlan();

  const goToList = () => navigate({ to: '/membership-plans' });

  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
      durationDays: 30,
      price: '',
      // Most plans carry none, so the box starts at zero rather than empty —
      // an explicit "no joining fee" reads better than a blank one.
      registrationFee: '0',
    },
    validators: { onSubmit: planSchema },
    onSubmit: ({ value }) =>
      createPlan({
        name: value.name.trim(),
        description: value.description.trim(),
        durationDays: value.durationDays,
        // Sent exactly as typed. Never `Number(value.price)` — the API stores
        // numeric(12,2) and a round trip through a float can lose a cent.
        price: value.price.trim(),
        // A cleared box means no fee; `''` fails the API's pattern.
        registrationFee: value.registrationFee.trim() || '0',
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
        title={t('plans.create.title')}
        subtitle={t('plans.create.subtitle')}
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
            label={t('plans.fields.name')}
            placeholder={t('plans.placeholders.name')}
            required
          />
          <FormTextField
            form={form}
            name="durationDays"
            label={t('plans.fields.durationDays')}
            type="number"
            inputMode="numeric"
            required
          />
          {/* NOT type="number": the value is a decimal string and must survive
              round-tripping unparsed. `inputMode` still gives a numeric keypad. */}
          <FormTextField
            form={form}
            name="price"
            label={t('plans.fields.price')}
            placeholder="1500.00"
            inputMode="decimal"
            required
          />
          {/* Charged once, the first time a member buys anything — not on a
              renewal. Zero is the normal answer, so it is not `required`. */}
          <FormTextField
            form={form}
            name="registrationFee"
            label={t('plans.fields.registrationFee')}
            placeholder="900.00"
            inputMode="decimal"
          />
          <FormTextareaField
            form={form}
            name="description"
            label={t('plans.fields.description')}
            placeholder={t('plans.placeholders.description')}
            rows={3}
            className="sm:col-span-2"
          />
          {/* No `isActive` here — a new plan is sellable. Retire it later. */}
        </CardContent>
      </Card>
    </form>
  );
}
