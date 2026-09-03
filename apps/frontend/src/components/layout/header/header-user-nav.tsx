import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowDown01Icon,
  Logout03Icon,
  UserIcon,
} from '@hugeicons/core-free-icons';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentUser, useLogout } from '@/features/auth/hooks/use-auth';

/**
 * The signed-in user lives in the header, not the sidebar footer — the ekos
 * arrangement, which frees the footer for the theme switch.
 */
export function HeaderUserNav() {
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();
  const { logout, isPending } = useLogout();

  if (!user) return null;

  const fullName = `${user.firstName} ${user.lastName}`;
  const initials =
    `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 outline-none transition-colors hover:bg-accent"
          />
        }
        aria-label={t('nav.userMenu')}
      >
        <Avatar className="size-8">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        {/* Two tight lines, not three — the branch is the useful one. */}
        <div className="hidden text-left leading-tight md:grid">
          <span className="truncate text-sm font-semibold">{fullName}</span>
          <span className="truncate text-xs text-muted-foreground">
            {user.branchName}
          </span>
        </div>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className="hidden text-muted-foreground md:block"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        {/* The label is Base UI's Menu.GroupLabel — it throws unless it sits
            inside a Menu.Group, even when the group holds nothing else. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{fullName}</span>
              <span className="text-xs text-muted-foreground">
                {user.phone}
              </span>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {user.roles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <HugeiconsIcon icon={UserIcon} data-icon="inline-start" />
            {t('nav.profile')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={isPending} onClick={() => logout()}>
            <HugeiconsIcon icon={Logout03Icon} data-icon="inline-start" />
            {t('nav.logOut')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
