import { DeleteRoleDialog } from '../actions/delete-role';
import { RoleFormDialog } from '../actions/role-form-dialog';
import { useRoleContext } from './role-context';

/** Single mount point for every role dialog, so rows stay presentational. */
export function RoleDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useRoleContext();

  const closeRowDialog = (isOpen: boolean) => {
    if (isOpen) return;
    setOpen(null);
    setCurrentRow(null);
  };

  return (
    <>
      <RoleFormDialog
        open={open === 'create'}
        onOpenChange={(isOpen) => setOpen(isOpen ? 'create' : null)}
      />

      {currentRow && (
        <>
          <RoleFormDialog
            // Keyed by row: retargeting remounts with the right defaults.
            key={`edit-${currentRow.id}`}
            open={open === 'edit'}
            onOpenChange={closeRowDialog}
            role={currentRow}
          />
          <DeleteRoleDialog
            key={`delete-${currentRow.id}`}
            open={open === 'delete'}
            onOpenChange={closeRowDialog}
            role={currentRow}
          />
        </>
      )}
    </>
  );
}
