import { EditAccessDialog } from '../actions/edit-access-dialog';
import { ResetPasswordDialog } from '../actions/reset-password-dialog';
import { RevokeAccessDialog } from '../actions/revoke-access-dialog';
import { ToggleLoginDialog } from '../actions/toggle-login-dialog';
import { useUserContext } from './user-context';

/** Single mount point for every user dialog, so rows stay presentational. */
export function UserDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useUserContext();

  const closeRowDialog = (isOpen: boolean) => {
    if (isOpen) return;
    setOpen(null);
    setCurrentRow(null);
  };

  // Every dialog here acts on a row, so there is nothing to mount without one.
  if (!currentRow) return null;

  return (
    <>
      <EditAccessDialog
        // Keyed by row so the prefilled roles and scope belong to it.
        key={`edit-access-${currentRow.personId}`}
        open={open === 'editAccess'}
        onOpenChange={closeRowDialog}
        user={currentRow}
      />
      <ResetPasswordDialog
        // Keyed by row: retargeting remounts with the right state.
        key={`reset-${currentRow.personId}`}
        open={open === 'resetPassword'}
        onOpenChange={closeRowDialog}
        user={currentRow}
      />
      <ToggleLoginDialog
        // Also keyed by status: the copy flips with it, and a stale
        // mount would offer to disable someone already disabled.
        key={`toggle-${currentRow.personId}-${currentRow.status}`}
        open={open === 'toggleLogin'}
        onOpenChange={closeRowDialog}
        user={currentRow}
      />
      <RevokeAccessDialog
        key={`revoke-${currentRow.personId}`}
        open={open === 'revokeAccess'}
        onOpenChange={closeRowDialog}
        user={currentRow}
      />
    </>
  );
}
