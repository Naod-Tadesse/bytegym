import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { MAX_MESSAGE_LENGTH } from '../data/schema';

/** One SMS. Past this the message is split and billed per part. */
const PER_PART = 160;

/**
 * Characters used, and how many messages that actually costs.
 *
 * The part count is the point, not the character count: 161 characters is two
 * messages and twice the money, and nothing else on the screen says so. A gym
 * texting four hundred members has a real interest in the difference.
 */
export function MessageLength({ value }: { value: string }) {
  const { t } = useTranslation();
  const used = value.length;
  const parts = Math.max(1, Math.ceil(used / PER_PART));
  const overLimit = used > MAX_MESSAGE_LENGTH;

  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        overLimit ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {t('sms.length', { used, max: MAX_MESSAGE_LENGTH })}
      {used > 0 && ` · ${t('sms.parts', { count: parts })}`}
    </span>
  );
}
