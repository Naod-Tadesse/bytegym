import { useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon, PencilEdit02Icon } from '@hugeicons/core-free-icons';

import { FormPageHeader } from '@/components/form-page-header';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/hooks/use-auth';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { TerminateStaffDialog } from '../actions/terminate-staff';
import { EmploymentStatusBadge } from '../components/employment-status-badge';
import type { StaffDetail as StaffDetailType } from '../data/types';
import { useStaffMember } from '../hooks/use-staff';

export function StaffDetail({ staffId }: { staffId: string }) {
  const { staffMember, isLoading } = useStaffMember(staffId);

  if (isLoading) return <StaffDetailSkeleton />;
  if (!staffMember) return null;

  return <StaffDetailView staffMember={staffMember} />;
}

function StaffDetailView({ staffMember }: { staffMember: StaffDetailType }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { data: currentUser } = useCurrentUser();
  const [isTerminating, setIsTerminating] = useState(false);

  const fullName = `${staffMember.firstName} ${staffMember.lastName}`;
  const canTerminate =
    hasPermission('staff.terminate') &&
    currentUser?.id !== staffMember.userId &&
    staffMember.employmentStatus !== 'terminated';

  return (
    <div className="m-2 flex flex-col gap-4">
      <FormPageHeader
        title={fullName}
        subtitle={staffMember.staffCode}
        onBack={() => navigate({ to: '/staff' })}
      >
        {hasPermission('staff.update') && (
          <Button
            variant="outline"
            onClick={() =>
              navigate({
                to: '/staff/$staffId/edit',
                params: { staffId: staffMember.userId },
              })
            }
          >
            <HugeiconsIcon icon={PencilEdit02Icon} data-icon="inline-start" />
            {t('actions.edit')}
          </Button>
        )}
        {canTerminate && (
          <Button variant="destructive" onClick={() => setIsTerminating(true)}>
            <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" />
            {t('staff.actions.terminate')}
          </Button>
        )}
      </FormPageHeader>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              <AvatarFallback>
                {`${staffMember.firstName[0] ?? ''}${staffMember.lastName[0] ?? ''}`.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <span className="text-lg font-semibold">{fullName}</span>
              <span className="text-sm text-muted-foreground">
                {staffMember.jobTitle} · {staffMember.branchName}
              </span>
            </div>
            <div className="ml-auto">
              <EmploymentStatusBadge status={staffMember.employmentStatus} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <DetailRow label={t('staff.fields.phone')}>
            <span className="tabular-nums">{staffMember.phone}</span>
          </DetailRow>
          <Separator />
          <DetailRow label={t('staff.fields.staffCode')}>
            {staffMember.staffCode}
          </DetailRow>
          <Separator />
          <DetailRow label={t('staff.fields.branch')}>
            {staffMember.branchName}
          </DetailRow>
          <Separator />
          <DetailRow label={t('staff.fields.roles')}>
            {staffMember.roles.length === 0 ? (
              <span className="text-muted-foreground">
                {t('staff.detail.noRoles')}
              </span>
            ) : (
              <div className="flex flex-wrap justify-end gap-1">
                {staffMember.roles.map((role) => (
                  <Badge key={role.id} variant="secondary">
                    {role.name}
                  </Badge>
                ))}
              </div>
            )}
          </DetailRow>
          <Separator />
          <DetailRow label={t('staff.fields.hiredOn')}>
            {formatDay(staffMember.hiredOn)}
          </DetailRow>
          {staffMember.terminatedOn && (
            <>
              <Separator />
              <DetailRow label={t('staff.fields.terminatedOn')}>
                {formatDay(staffMember.terminatedOn)}
              </DetailRow>
            </>
          )}
          <Separator />
          <DetailRow label={t('staff.fields.dateOfBirth')}>
            {formatDay(staffMember.dateOfBirth)}
          </DetailRow>
          <Separator />
          <DetailRow label={t('staff.fields.gender')}>
            {staffMember.gender
              ? t(
                  staffMember.gender === 'male'
                    ? 'staff.gender.male'
                    : 'staff.gender.female',
                )
              : '—'}
          </DetailRow>
          <Separator />
          <DetailRow label={t('staff.fields.lastLogin')}>
            {staffMember.lastLoginAt
              ? format(parseISO(staffMember.lastLoginAt), 'PPp')
              : t('staff.detail.neverSignedIn')}
          </DetailRow>
        </CardContent>
      </Card>

      <TerminateStaffDialog
        open={isTerminating}
        onOpenChange={setIsTerminating}
        staffMember={staffMember}
      />
    </div>
  );
}

/** `yyyy-MM-dd` from the API, rendered long-form. */
function formatDay(value: string | null) {
  return value ? format(parseISO(value), 'PPP') : '—';
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

function StaffDetailSkeleton() {
  return (
    <div className="m-2 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-8 w-48" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-12 w-64" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-5 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
