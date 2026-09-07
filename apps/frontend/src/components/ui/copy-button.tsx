import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import { Copy01Icon, Tick02Icon } from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * How long the tick and the "Copied" label stay before reverting.
 *
 * Long enough to be noticed, short enough that a second copy a moment later
 * still reads as a fresh confirmation rather than the previous one lingering.
 */
const FEEDBACK_MS = 2000;

type CopyState = 'idle' | 'copied' | 'failed';

interface CopyButtonProps {
  /** The exact string written to the clipboard. */
  value: string;
  /**
   * What is being copied, said in full — "Copy phone number", not "Copy".
   * This is the button's accessible name *and* its tooltip: an icon is not a
   * label, and there is nothing else on the button to read.
   */
  label: string;
  size?: 'icon-xs' | 'icon-sm';
  className?: string;
}

/**
 * Copy one string, with feedback in place rather than a toast.
 *
 * A toast is the wrong weight for something a receptionist does twenty times a
 * shift: it covers the screen, queues up behind itself, and says nothing about
 * *which* of the six phone numbers on the page was taken. The button that was
 * pressed changing under the cursor answers both.
 *
 * The confirmation is never carried by the icon alone — the accessible name and
 * the tooltip swap with it, and the change is announced to a screen reader.
 */
export function CopyButton({
  value,
  label,
  size = 'icon-xs',
  className,
}: CopyButtonProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A table row is unmounted by any refetch or page change, which can easily
  // land inside the two seconds.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const flash = (next: Exclude<CopyState, 'idle'>) => {
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), FEEDBACK_MS);
  };

  const copy = async () => {
    try {
      // Two failures land here and neither may escape as an unhandled
      // rejection: on an insecure origin `navigator.clipboard` is undefined,
      // so the property access itself throws, and where it does exist
      // `writeText` rejects if the permission is denied. Both mean the same
      // thing to the user — it did not copy — so both say so on the button.
      await navigator.clipboard.writeText(value);
      flash('copied');
    } catch {
      flash('failed');
    }
  };

  const activeLabel =
    state === 'copied'
      ? t('actions.copied')
      : state === 'failed'
        ? t('actions.copyFailed')
        : label;

  return (
    <TooltipProvider delay={0}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size={size}
              aria-label={activeLabel}
              // The row underneath may navigate on click; copying must not
              // also open the record.
              onClick={(event: React.MouseEvent<HTMLElement>) => {
                event.stopPropagation();
                void copy();
              }}
              className={cn(
                'text-muted-foreground hover:text-foreground',
                state === 'failed' && 'text-destructive hover:text-destructive',
                className,
              )}
            />
          }
        >
          <HugeiconsIcon icon={state === 'copied' ? Tick02Icon : Copy01Icon} />
        </TooltipTrigger>
        <TooltipContent>{activeLabel}</TooltipContent>
      </Tooltip>
      {/* The tooltip is not announced on a click, and a swapped icon is not
          perceivable at all — so the outcome is said out loud here. */}
      <span role="status" aria-live="polite" className="sr-only">
        {state === 'idle' ? '' : activeLabel}
      </span>
    </TooltipProvider>
  );
}

interface CopyableTextProps {
  /** Null or empty renders an em dash — there is nothing to copy. */
  value: string | null | undefined;
  /** Passed straight to {@link CopyButton} — say what, not just "Copy". */
  label: string;
  /** Applied to the wrapper, so `tabular-nums` and friends reach the text. */
  className?: string;
  /** What is shown, when that differs from what is copied. */
  children?: ReactNode;
}

/**
 * A value with its copy button beside it — the shape almost every call site
 * wants, so the two do not drift apart cell by cell.
 *
 * The button is always visible rather than revealed on hover: a hover-only
 * affordance does not exist on a touch screen, and the front desk is exactly
 * where a tablet turns up.
 */
export function CopyableText({
  value,
  label,
  className,
  children,
}: CopyableTextProps) {
  // Not a disabled button: an absent value is an em dash, the same as every
  // other empty cell on the page.
  if (!value) return <span className="text-muted-foreground">—</span>;

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {children ?? value}
      <CopyButton value={value} label={label} />
    </span>
  );
}
