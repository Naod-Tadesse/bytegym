import { useForm, useStore } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlayIcon } from '@hugeicons/core-free-icons';

import {
  FormSelectField,
  FormSwitchField,
  FormTextField,
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
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { settle } from '@/lib/settle';
import { smsSettingsSchema } from '../data/schema';
import type { SmsSettings } from '../data/types';
import {
  useRunReminders,
  useSmsSettings,
  useUpdateSmsSettings,
} from '../hooks/use-sms';

/**
 * The automatic expiry nudge.
 *
 * Split in two so `defaultValues` are right on first render with no `reset()`
 * effect — the outer half resolves the settings, the inner only ever renders
 * with them.
 */
export function RemindersCard() {
  const { settings, isLoading } = useSmsSettings();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }
  if (!settings) return null;

  // Keyed on `updatedAt`, and that is the whole fix for a toggle that showed
  // OFF while the server had it ON. `useForm` reads `defaultValues` once, at
  // mount — so settings changed anywhere else (another tab, another member of
  // staff, the API directly) re-render this component with fresh data that the
  // form inside quietly ignores. Remounting is what makes the control show
  // what is actually saved.
  return <RemindersForm key={settings.updatedAt} settings={settings} />;
}

function RemindersForm({ settings }: { settings: SmsSettings }) {
  const { t } = useTranslation();
  const { updateSettingsAsync, isPending } = useUpdateSmsSettings();
  const { runRemindersAsync, isPending: isRunning } = useRunReminders();

  const form = useForm({
    defaultValues: {
      reminderEnabled: settings.reminderEnabled,
      reminderDaysBefore: settings.reminderDaysBefore,
      reminderHour: String(settings.reminderHour),
      reminderTemplate: settings.reminderTemplate,
    },
    validators: { onSubmit: smsSettingsSchema },
    onSubmit: ({ value }) =>
      settle(
        updateSettingsAsync({
          ...value,
          // Back to the number the API takes — see the schema.
          reminderHour: Number(value.reminderHour),
        }),
      ),
  });

  const enabled = useStore(form.store, (state) => state.values.reminderEnabled);
  /**
   * Whether the form differs from what is saved.
   *
   * `Run now` acts on the **saved** settings — the server reads its own row,
   * not the boxes on screen. So with unsaved edits the button does something
   * other than what the screen says, which is how a run happened with the
   * toggle showing OFF. Rather than trying to make one button mean two things,
   * it is unavailable until the two agree.
   */
  const isDirty = useStore(
    form.store,
    (state) =>
      state.values.reminderEnabled !== settings.reminderEnabled ||
      state.values.reminderDaysBefore !== settings.reminderDaysBefore ||
      state.values.reminderHour !== String(settings.reminderHour) ||
      state.values.reminderTemplate !== settings.reminderTemplate,
  );
  const days = useStore(form.store, (state) => state.values.reminderDaysBefore);

  // Labelled on a 24-hour clock in the gym's own time — that is the only clock
  // a receptionist setting this is thinking in.
  const hourOptions = Array.from({ length: 24 }, (_, hour) => ({
    value: String(hour),
    label: `${String(hour).padStart(2, '0')}:00`,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('sms.reminders.title')}</CardTitle>
        <CardDescription>{t('sms.reminders.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <FormSwitchField
            form={form}
            name="reminderEnabled"
            label={t('sms.fields.reminderEnabled')}
            className="sm:col-span-2"
          />
          {enabled && (
            <>
              <FormTextField
                form={form}
                name="reminderDaysBefore"
                label={t('sms.fields.reminderDaysBefore')}
                type="number"
                inputMode="numeric"
                required
              />
              {/* The line that stops a 30 being typed without thinking. The
                  count is per member, every day, so it is the bill. */}
              <span className="flex items-end pb-2 text-xs text-muted-foreground">
                {t('sms.reminders.cost', { count: days || 0 })}
              </span>
              {/* A fixed 24-value list written in code, so a Select is right.
                  Labelled in the gym's own time, because that is the only
                  clock a receptionist is thinking in. */}
              <FormSelectField
                form={form}
                name="reminderHour"
                label={t('sms.fields.reminderHour')}
                options={hourOptions}
                required
              />
              <span className="flex items-end pb-2 text-xs text-muted-foreground">
                {t('sms.reminders.hourHint')}
              </span>
              <FormTextareaField
                form={form}
                name="reminderTemplate"
                label={t('sms.fields.reminderTemplate')}
                rows={3}
                className="sm:col-span-2"
                required
              />
              <span className="text-xs text-muted-foreground sm:col-span-2">
                {t('sms.reminders.placeholders')}
              </span>
            </>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2 sm:col-span-2">
            {/* Running it by hand is the only way to test a daily job without
                waiting a day. Safe to press twice: anyone already reminded
                today is skipped by the database, not re-texted.

                Unavailable with unsaved changes, and unavailable while
                reminders are switched off — in the second case it can only
                report that they are off, which is not worth a request. The
                reason is stated beside it, because a disabled button with no
                explanation is its own kind of bug. */}
            {(isDirty || !settings.reminderEnabled) && (
              <span className="mr-auto text-xs text-muted-foreground">
                {isDirty
                  ? t('sms.reminders.saveFirst')
                  : t('sms.reminders.offHint')}
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={isRunning || isDirty || !settings.reminderEnabled}
              onClick={() => settle(runRemindersAsync())}
            >
              {isRunning ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <HugeiconsIcon icon={PlayIcon} data-icon="inline-start" />
              )}
              {t('sms.reminders.runNow')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner data-icon="inline-start" />}
              {t('actions.save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
