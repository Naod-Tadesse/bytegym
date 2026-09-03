import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Logout03Icon,
  MoreVerticalIcon,
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
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUser, useLogout } from '@/features/auth/hooks/use-auth';

export function NavUser() {
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();
  const { logout, isPending } = useLogout();

  if (!user) return null;

  const fullName = `${user.firstName} ${user.lastName}`;
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" />}
            aria-label={t('nav.userMenu')}
          >
            <Avatar className="size-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col text-left">
              <span className="truncate text-sm font-medium">{fullName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user.branchName}
              </span>
            </div>
            <HugeiconsIcon icon={MoreVerticalIcon} />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" side="top" className="w-56">
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
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
