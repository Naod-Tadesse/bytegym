import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { FormPageHeader } from '@/components/form-page-header';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { settle } from '@/lib/settle';
import type { Permission, RoleDetail } from '../data/types';
import {
  usePermissionCatalogue,
  useRole,
  useSyncRolePermissions,
} from '../hooks/use-roles';

export function ManageRolePermissions({ roleId }: { roleId: string }) {
  const { role, isLoading } = useRole(roleId);
  const { permissions, isLoading: isLoadingCatalogue } =
    usePermissionCatalogue();

  if (isLoading || isLoadingCatalogue) return <PermissionsSkeleton />;
  if (!role) return null;

  return <PermissionsEditor role={role} catalogue={permissions} />;
}

function PermissionsEditor({
  role,
  catalogue,
}: {
  role: RoleDetail;
  catalogue: Permission[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const goToList = () => navigate({ to: '/roles' });
  const { syncPermissionsAsync, isPending } = useSyncRolePermissions(goToList);

  // Seeded from the loaded role rather than an effect — this component only
  // ever mounts with the record in hand.
  const granted = useMemo(
    () => new Set(role.permissions.map((permission) => permission.id)),
    [role.permissions],
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(granted));

  /** The backend already orders by group then name, so insertion order is right. */
  const groups = useMemo(() => {
    const byGroup = new Map<string, Permission[]>();
    for (const permission of catalogue) {
      const list = byGroup.get(permission.group) ?? [];
      list.push(permission);
      byGroup.set(permission.group, list);
    }
    return [...byGroup.entries()];
  }, [catalogue]);

  const isDirty =
    selected.size !== granted.size ||
    [...selected].some((id) => !granted.has(id));

  const toggleOne = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleGroup = (permissions: Permission[], selectAll: boolean) =>
    setSelected((previous) => {
      const next = new Set(previous);
      for (const permission of permissions) {
        if (selectAll) next.add(permission.id);
        else next.delete(permission.id);
      }
      return next;
    });

  return (
    <div className="m-2 flex flex-col gap-4">
      <FormPageHeader
        title={t('roles.permissions.title')}
        subtitle={t('roles.permissions.subtitle', {
          name: role.name,
          selected: selected.size,
          total: catalogue.length,
        })}
        onBack={goToList}
      >
        <Button type="button" variant="outline" onClick={goToList}>
          {t('actions.cancel')}
        </Button>
        <Button
          type="button"
          disabled={isPending || !isDirty}
          onClick={() =>
            settle(
              syncPermissionsAsync({
                roleId: role.id,
                permissionIds: [...selected],
              }),
            )
          }
        >
          {isPending && <Spinner data-icon="inline-start" />}
          {t('actions.save')}
        </Button>
      </FormPageHeader>

      <Card>
        <CardContent>
          <Accordion
            multiple
            defaultValue={groups.map(([groupName]) => groupName)}
          >
            {groups.map(([groupName, permissions]) => {
              const selectedCount = permissions.filter((permission) =>
                selected.has(permission.id),
              ).length;
              const allSelected = selectedCount === permissions.length;

              return (
                <AccordionItem key={groupName} value={groupName}>
                  {/* The group checkbox sits beside the trigger, not inside it —
                      a button nested in a button is invalid markup. */}
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={selectedCount > 0 && !allSelected}
                      onCheckedChange={(checked) =>
                        toggleGroup(permissions, !!checked)
                      }
                      aria-label={t('roles.permissions.toggleGroup', {
                        group: groupName,
                      })}
                    />
                    <AccordionTrigger className="flex-1">
                      <span className="flex items-center gap-2">
                        {groupName}
                        <Badge variant="secondary">
                          {selectedCount}/{permissions.length}
                        </Badge>
                      </span>
                    </AccordionTrigger>
                  </div>

                  <AccordionContent>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {permissions.map((permission) => (
                        <FieldLabel
                          key={permission.id}
                          htmlFor={`permission-${permission.id}`}
                        >
                          <Field orientation="horizontal">
                            <Checkbox
                              id={`permission-${permission.id}`}
                              checked={selected.has(permission.id)}
                              onCheckedChange={() => toggleOne(permission.id)}
                            />
                            <FieldContent>
                              <FieldTitle>{permission.displayName}</FieldTitle>
                              {permission.description && (
                                <FieldDescription>
                                  {permission.description}
                                </FieldDescription>
                              )}
                            </FieldContent>
                          </Field>
                        </FieldLabel>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

function PermissionsSkeleton() {
  return (
    <div className="m-2 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-8 w-48" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
      <Card>
        <CardContent className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
