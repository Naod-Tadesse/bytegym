import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Dumbbell01Icon,
  LockPasswordIcon,
  SmartPhone01Icon,
  ViewIcon,
  ViewOffIcon,
} from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';
import { loginSchema } from './data/schema';
import { useLogin } from './hooks/use-auth';

export function LoginForm() {
  const { t } = useTranslation();
  const { login, isPending, error } = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm({
    defaultValues: { phone: '', password: '' },
    validators: { onSubmit: loginSchema },
    onSubmit: ({ value }) => login(value),
  });

  // The interceptor suppresses toasts for /auth/login so the form owns the error.
  const message =
    (error as { response?: { data?: { message?: string | string[] } } })
      ?.response?.data?.message ?? null;
  const errorText = Array.isArray(message) ? message.join(', ') : message;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      {/* Ambient emerald wash — the accent used as light, not as a surface. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,var(--color-primary)_0%,transparent_70%)] opacity-[0.07]"
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <HugeiconsIcon icon={Dumbbell01Icon} />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t('auth.welcomeBack')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('auth.signInDescription')}
            </p>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            {errorText && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {errorText}
              </div>
            )}

            <form.Field name="phone">
              {(field) => (
                <Field
                  data-invalid={field.state.meta.errors.length > 0 || undefined}
                >
                  <FieldLabel htmlFor="phone">{t('auth.phone')}</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <HugeiconsIcon icon={SmartPhone01Icon} />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="phone"
                      autoComplete="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="0912345678"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      aria-invalid={
                        field.state.meta.errors.length > 0 || undefined
                      }
                    />
                  </InputGroup>
                  <FieldError
                    errors={field.state.meta.errors.map((issue) =>
                      typeof issue === 'string' ? { message: issue } : issue,
                    )}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <Field
                  data-invalid={field.state.meta.errors.length > 0 || undefined}
                >
                  <FieldLabel htmlFor="password">
                    {t('auth.password')}
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <HugeiconsIcon icon={LockPasswordIcon} />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      aria-invalid={
                        field.state.meta.errors.length > 0 || undefined
                      }
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={
                          showPassword
                            ? t('auth.hidePassword')
                            : t('auth.showPassword')
                        }
                      >
                        <HugeiconsIcon
                          icon={showPassword ? ViewOffIcon : ViewIcon}
                        />
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldError
                    errors={field.state.meta.errors.map((issue) =>
                      typeof issue === 'string' ? { message: issue } : issue,
                    )}
                  />
                </Field>
              )}
            </form.Field>

            <Button type="submit" size="lg" disabled={isPending}>
              {isPending && <Spinner data-icon="inline-start" />}
              {t('auth.signIn')}
            </Button>
          </FieldGroup>
        </form>
      </div>
    </div>
  );
}
