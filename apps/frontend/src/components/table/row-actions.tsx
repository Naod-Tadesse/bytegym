import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { MoreHorizontalIcon } from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * At or below this many actions they are inline icon buttons; above it they go
 * back behind a `⋯` menu.
 *
 * Four is where a row of icons stops reading as a small set of choices and
 * starts reading as a toolbar. Every table in the app is at or under it today,
 * so nothing currently takes the menu path — it is kept because the rule is the
 * point, not the current count, and the next screen may well cross the line.
 */
export const INLINE_ACTION_LIMIT = 4;

export interface RowAction {
  /** Stable identity — also the React key. */
  key: string;
  /**
   * The full action, said out loud: "Terminate staff member", not "Terminate".
   * It is the button's only accessible name and its tooltip, because an icon
   * is neither.
   */
  label: string;
  icon: IconSvgElement;
  onSelect: () => void;
  /**
   * Terminate, delete, revoke, void, retire. Rendered in destructive colours
   * inline, and ruled off below the benign entries in the menu.
   */
  destructive?: boolean;
  /**
   * Visible but not actionable — the state is wrong for it right now (already
   * voided, yourself). Different from omitting the action entirely, which is
   * what a *missing permission* does: what you may never do should not be
   * advertised, but what you cannot do *yet* should say so.
   */
  disabled?: boolean;
  /** Why it is disabled. Replaces the tooltip, so say the reason, not "Disabled". */
  disabledReason?: string;
}

interface RowActionsProps {
  /**
   * In display order. Filter out the ones the caller has no permission for
   * before passing them; an empty array renders nothing at all.
   */
  actions: RowAction[];
  className?: string;
}

/**
 * The actions column of every table.
 *
 * Note there is no width class and no centering here, and none should be added
 * at the call sites either: the last column stretches, and constraining it
 * strands the buttons hard against the right edge of the screen.
 */
export function RowActions({ actions, className }: RowActionsProps) {
  const { t } = useTranslation();

  // A row with nothing on offer renders nothing — not an empty container, and
  // not a menu button that opens onto an empty popup.
  if (actions.length === 0) return null;

  return (
    // Several tables navigate on row click. Acting on a row must not also open
    // it, and stopping it here means no caller has to remember to.
    <div
      className={cn('flex items-center', className)}
      onClick={(event) => event.stopPropagation()}
    >
      {actions.length <= INLINE_ACTION_LIMIT ? (
        <InlineRowActions actions={actions} />
      ) : (
        <RowActionsMenu actions={actions} label={t('actions.rowActions')} />
      )}
    </div>
  );
}

function InlineRowActions({ actions }: { actions: RowAction[] }) {
  return (
    <TooltipProvider delay={0}>
      <div className="flex items-center gap-0.5">
        {actions.map((action) => {
          const isDisabled = Boolean(action.disabled);

          return (
            <Tooltip key={action.key}>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    // `aria-disabled`, not `disabled`: a disabled button takes
                    // no pointer events, so the tooltip saying *why* it is
                    // disabled could never open — which is the whole reason
                    // for showing it rather than hiding it.
                    aria-disabled={isDisabled || undefined}
                    aria-label={action.label}
                    onClick={isDisabled ? undefined : action.onSelect}
                    className={cn(
                      action.destructive &&
                        'text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20',
                      isDisabled &&
                        'cursor-not-allowed opacity-50 hover:bg-transparent',
                    )}
                  />
                }
              >
                <HugeiconsIcon icon={action.icon} />
              </TooltipTrigger>
              <TooltipContent>
                {isDisabled && action.disabledReason
                  ? action.disabledReason
                  : action.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

function RowActionsMenu({
  actions,
  label,
}: {
  actions: RowAction[];
  label: string;
}) {
  // A rule above the first destructive entry, so a delete is never where the
  // pointer lands out of habit.
  const firstDestructive = actions.findIndex((action) => action.destructive);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <HugeiconsIcon icon={MoreHorizontalIcon} />
        <span className="sr-only">{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action, index) => (
          <Fragment key={action.key}>
            {index === firstDestructive && index > 0 && (
              <DropdownMenuSeparator />
            )}
            <DropdownMenuItem
              variant={action.destructive ? 'destructive' : 'default'}
              disabled={action.disabled}
              // A menu item cannot carry the tooltip the inline buttons use —
              // that would be a popup inside a popup — so the reason rides on
              // the native title instead.
              title={action.disabled ? action.disabledReason : undefined}
              onClick={action.onSelect}
            >
              <HugeiconsIcon icon={action.icon} data-icon="inline-start" />
              {action.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
