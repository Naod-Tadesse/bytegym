import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import {
  FormSwitchField,
  FormTextareaField,
  FormTextField,
} from '@/components/form-fields';
import { FormPageHeader } from '@/components/form-page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { editPlanSchema } from '../data/schema';
import type { MembershipPlan } from '../data/types';
import {
  useMembershipPlan,
  useUpdateMembershipPlan,
} from '../hooks/use-membership-plans';

/**
 * Split in two on purpose: the outer half resolves the record, the inner half
 * only ever renders with it. That way `defaultValues` are correct on the very
 * first render and no `reset()` effect is needed.
 */
export function EditMembershipPlan({ planId }: { planId: string }) {
  const { plan, isLoading } = useMembershipPlan(planId);

  if (isLoading) return <EditMembershipPlanSkeleton />;
  if (!plan) return null;

  return <EditMembershipPlanForm plan={plan} />;
}

function EditMembershipPlanForm({ plan }: { plan: MembershipPlan }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { updatePlan, isPending } = useUpdateMembershipPlan();

  const goToList = () => navigate({ to: '/membership-plans' });

  const form = useForm({
    defaultValues: {
      name: plan.name,
      description: plan.description ?? '',
      durationDays: plan.durationDays,
      // Straight from the API and straight back — the string is never parsed.
      price: plan.price,
      registrationFee: plan.registrationFee,
      isActive: plan.isActive,
    },
    validators: { onSubmit: editPlanSchema },
    onSubmit: ({ value }) =>
      updatePlan({
        planId: plan.id,
        data: {
          name: value.name.trim(),
          description: value.description.trim(),
          durationDays: value.durationDays,
          price: value.price.trim(),
          // A cleared box means no fee; `''` fails the API's pattern.
          registrationFee: value.registrationFee.trim() || '0',
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
        title={t('plans.edit.title')}
        subtitle={plan.name}
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
            label={t('plans.fields.name')}
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
              round-tripping unparsed. */}
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
          {/* Editing a price in place makes reports lie about which product
              sold — memberships snapshot the price, so history survives either
              way, but the plan row no longer describes what was bought. The
              same is true of the fee: a membership keeps whatever it charged. */}
          <p className="text-sm text-muted-foreground sm:col-span-2">
            {t('plans.edit.priceHint')}
          </p>
          {/* Which sale it lands on is not a property of the plan — the sale
              decides it from whether the member has ever held a membership. */}
          <p className="text-sm text-muted-foreground sm:col-span-2">
            {t('plans.fields.registrationFeeHint')}
          </p>
          <FormTextareaField
            form={form}
            name="description"
            label={t('plans.fields.description')}
            rows={3}
            className="sm:col-span-2"
          />
          <FormSwitchField
            form={form}
            name="isActive"
            label={t('plans.fields.isActive')}
            description={t('plans.fields.isActiveHint')}
            className="sm:col-span-2"
          />
        </CardContent>
      </Card>
    </form>
  );
}

/** Mirrors the real layout so the page does not jump when data lands. */
function EditMembershipPlanSkeleton() {
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
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
