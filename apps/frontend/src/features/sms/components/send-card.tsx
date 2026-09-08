import { useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import { SentIcon } from '@hugeicons/core-free-icons';

import { FormTextField, FormTextareaField } from '@/components/form-fields';
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
import { settle } from '@/lib/settle';
import { sendSmsSchema, type SendSmsFormData } from '../data/schema';
import { useSendSms } from '../hooks/use-sms';
import { MessageLength } from './message-length';

/**
 * One number, one message — a new year wish, or a note to somebody who left
 * their bag behind.
 *
 * The number does not have to belong to a member. Texting somebody who has not
 * signed up yet is a normal thing for a gym to do, so there is no member picker
 * here and no check that the number is one of theirs.
 */
export function SendCard() {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState<SendSmsFormData>();

  const { sendSmsAsync, isPending } = useSendSms(() => form.reset());

  const form = useForm({
    defaultValues: { phone: '', message: '' },
    validators: { onSubmit: sendSmsSchema },
    // Validated first, so the confirmation never sits over a form that would
    // be rejected anyway.
    onSubmit: ({ value }) => setConfirming(value),
  });

  const message = useStore(form.store, (state) => state.values.message);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('sms.send.title')}</CardTitle>
        <CardDescription>{t('sms.send.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          {/* NOT FormPhoneField: that stores +251 E.164, and this API takes
              and stores the local form. */}
          <FormTextField
            form={form}
            name="phone"
            label={t('sms.fields.phone')}
            placeholder="0912345678"
            inputMode="numeric"
            maxLength={10}
            required
          />
          <div className="hidden sm:block" />
          <FormTextareaField
            form={form}
            name="message"
            label={t('sms.fields.message')}
            placeholder={t('sms.placeholders.message')}
            rows={4}
            className="sm:col-span-2"
            required
          />
          <div className="flex items-center justify-between gap-4 sm:col-span-2">
            <MessageLength value={message} />
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <HugeiconsIcon icon={SentIcon} data-icon="inline-start" />
              )}
              {t('sms.send.confirm')}
            </Button>
          </div>
        </form>
      </CardContent>

      {/* A message cannot be unsent, so it is worth one deliberate yes. The
          number is the whole summary — it is the thing that goes wrong. */}
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(isOpen) => {
          if (!isOpen) setConfirming(undefined);
        }}
        title={t('sms.send.confirmTitle')}
        description={confirming?.phone}
        confirmLabel={t('sms.send.confirm')}
        cancelLabel={t('actions.cancel')}
        isPending={isPending}
        onConfirm={() => confirming && settle(sendSmsAsync(confirming))}
      >
        {/* The text itself, quoted — the last chance to notice a typo before
            it is on somebody's phone. */}
        {confirming && (
          <p className="rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap">
            {confirming.message}
          </p>
        )}
      </ConfirmDialog>
    </Card>
  );
}
