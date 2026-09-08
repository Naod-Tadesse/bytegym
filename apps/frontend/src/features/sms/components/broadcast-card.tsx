import { useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import { UserGroupIcon } from '@hugeicons/core-free-icons';

import {
  FormComboboxField,
  FormSelectField,
  FormTextareaField,
} from '@/components/form-fields';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { usePlanOptions } from '@/features/membership-plans/hooks/use-membership-plans';
import { useDebounce } from '@/hooks/use-debounce';
import { settle } from '@/lib/settle';
import { broadcastSchema, type BroadcastFormData } from '../data/schema';
import { useBroadcast, usePreviewBroadcast } from '../hooks/use-sms';
import { MessageLength } from './message-length';

/**
 * The same message to everybody, or to everybody on one plan.
 *
 * **Nothing is sent until the recipient count is known.** Submitting asks the
 * server how many people the audience actually is, and that number is what the
 * confirmation shows — "this will text 412 people" is the only thing that
 * reliably stops the wrong audience being chosen, and it cannot be worked out
 * in the browser without fetching every member.
 */
export function BroadcastCard() {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState<{
    values: BroadcastFormData;
    recipients: number;
  }>();

  const { previewAsync, isPending: isCounting } = usePreviewBroadcast();
  const { broadcastAsync, isPending: isSending } = useBroadcast(() =>
    form.reset(),
  );

  // Only sellable plans: a broadcast goes to people currently on a plan, and
  // nobody is currently on a retired one.
  const [planSearch, setPlanSearch] = useState('');
  const {
    options: planOptions,
    fetchNextPage: fetchMorePlans,
    hasNextPage: hasMorePlans,
    isLoading: isLoadingPlans,
  } = usePlanOptions(useDebounce(planSearch));

  const audienceOptions = [
    { value: 'all', label: t('sms.audience.all') },
    { value: 'plan', label: t('sms.audience.plan') },
  ];

  const form = useForm({
    defaultValues: {
      audience: 'all' as 'all' | 'plan',
      planId: '',
      message: '',
    },
    validators: { onSubmit: broadcastSchema },
    onSubmit: async ({ value }) => {
      // Count first. Settled, so a failed count leaves the form alone rather
      // than opening a confirmation with no number in it.
      const result = await settle(previewAsync(payloadOf(value)));
      if (result)
        setConfirming({ values: value, recipients: result.recipients });
    },
  });

  const audience = useStore(form.store, (state) => state.values.audience);
  const message = useStore(form.store, (state) => state.values.message);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('sms.broadcast.title')}</CardTitle>
        <CardDescription>{t('sms.broadcast.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          {/* A two-value list written in code, so a Select is right. */}
          <FormSelectField
            form={form}
            name="audience"
            label={t('sms.fields.audience')}
            options={audienceOptions}
            required
          />
          {/* Plans come from a paginated endpoint, so this searches and pages
              server-side rather than pulling one oversized page. */}
          {audience === 'plan' && (
            <FormComboboxField
              form={form}
              name="planId"
              label={t('sms.fields.plan')}
              placeholder={t('members.placeholders.plan')}
              searchPlaceholder={t('members.placeholders.searchPlan')}
              options={planOptions}
              onSearch={setPlanSearch}
              onScroll={fetchMorePlans}
              hasNext={hasMorePlans}
              isLoading={isLoadingPlans}
              required
            />
          )}
          <FormTextareaField
            form={form}
            name="message"
            label={t('sms.fields.message')}
            placeholder={t('sms.placeholders.broadcast')}
            rows={4}
            className="sm:col-span-2"
            required
          />
          <div className="flex flex-wrap items-center justify-between gap-4 sm:col-span-2">
            <span className="flex flex-col gap-1">
              <MessageLength value={message} />
              <span className="text-xs text-muted-foreground">
                {t('sms.broadcast.nameHint')}
              </span>
            </span>
            <Button type="submit" disabled={isCounting || isSending}>
              {isCounting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <HugeiconsIcon icon={UserGroupIcon} data-icon="inline-start" />
              )}
              {t('sms.broadcast.review')}
            </Button>
          </div>
        </form>
      </CardContent>

      {/* Destructive styling for a send that cannot be recalled and costs a
          message per member. This is the screen's one genuinely expensive
          button, and it should not look like the others. */}
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(isOpen) => {
          if (!isOpen) setConfirming(undefined);
        }}
        title={t('sms.broadcast.confirmTitle', {
          count: confirming?.recipients ?? 0,
        })}
        confirmLabel={t('sms.broadcast.confirm')}
        cancelLabel={t('actions.cancel')}
        confirmVariant="destructive"
        isPending={isSending}
        onConfirm={() =>
          confirming && settle(broadcastAsync(payloadOf(confirming.values)))
        }
      >
        {confirming && (
          <p className="rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap">
            {confirming.values.message}
          </p>
        )}
      </ConfirmDialog>
    </Card>
  );
}

/** `planId` is dropped for an `all` audience — the API ignores it either way. */
function payloadOf(value: BroadcastFormData) {
  return {
    audience: value.audience,
    message: value.message,
    ...(value.audience === 'plan' ? { planId: value.planId } : {}),
  };
}
