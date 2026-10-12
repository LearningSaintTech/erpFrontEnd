import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ban, KeyRound, Lock, LockOpen, Trash2, UserCheck, type LucideIcon,
} from 'lucide-react';
import { usersApi } from '../../services/admin';
import type { ErpUser } from '../../types/api';
import { toast, useConfirm, usePrompt, type DropdownMenuItem } from '../../components/erp';
import { userDisplayName } from './userUtils';

/**
 * Account actions shared by the users table "⋯" menu and the user drawer:
 * reset password, lock / unlock, deactivate / activate, delete — each behind a confirm dialog.
 */
export function useUserActions({ canUpdate, canDelete, onDeleted }: {
  canUpdate: boolean;
  canDelete: boolean;
  onDeleted?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const prompt = usePrompt();

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['users-page'] });
    qc.invalidateQueries({ queryKey: ['users'] });
    qc.invalidateQueries({ queryKey: ['user-stats'] });
  };

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string; message: string }) => usersApi.update(id, { status }),
    onSuccess: (_d, v) => { refresh(); toast.success(v.message); },
  });
  const unlock = useMutation({
    mutationFn: (id: string) => usersApi.unlock(id),
    meta: { successMessage: 'Account unlocked' },
    onSuccess: refresh,
  });
  const resetPassword = useMutation({
    mutationFn: ({ id, pwd }: { id: string; pwd: string }) => usersApi.resetPassword(id, pwd),
    meta: { successMessage: 'Password reset', successDescription: 'The user must choose a new password at next sign-in.' },
  });
  const remove = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    meta: { successMessage: 'User deleted' },
    onSuccess: (_d, id) => { refresh(); onDeleted?.(id); },
  });

  const statusWithToast = (id: string, status: string, message: string) =>
    setStatus.mutate({ id, status, message });

  const doReset = async (u: ErpUser) => {
    const pwd = await prompt({
      title: `Reset password for ${userDisplayName(u)}?`,
      message: 'Set a temporary password and share it with them securely. They will be asked to change it at next sign-in.',
      label: 'Temporary password',
      inputType: 'password',
      singleLine: true,
      minLength: 8,
      confirmLabel: 'Reset password',
    });
    if (pwd != null) resetPassword.mutate({ id: u._id, pwd });
  };

  const doLock = async (u: ErpUser) => {
    const ok = await confirm({
      title: `Lock ${userDisplayName(u)}?`,
      message: 'They are signed out everywhere and cannot sign in until an admin unlocks the account.',
      confirmLabel: 'Lock account',
      tone: 'danger',
    });
    if (ok) statusWithToast(u._id, 'LOCKED', 'Account locked');
  };

  const doUnlock = async (u: ErpUser) => {
    const ok = await confirm({
      title: `Unlock ${userDisplayName(u)}?`,
      message: 'They can sign in again with their current password.',
      confirmLabel: 'Unlock',
      tone: 'primary',
    });
    if (ok) unlock.mutate(u._id);
  };

  const doDeactivate = async (u: ErpUser) => {
    const ok = await confirm({
      title: `Deactivate ${userDisplayName(u)}?`,
      message: 'They are signed out and cannot sign in. Their records and role assignments are kept, so you can reactivate them later.',
      confirmLabel: 'Deactivate',
      tone: 'danger',
    });
    if (ok) statusWithToast(u._id, 'INACTIVE', 'User deactivated');
  };

  const doActivate = (u: ErpUser) => statusWithToast(u._id, 'ACTIVE', 'User activated');

  const doDelete = async (u: ErpUser) => {
    const ok = await confirm({
      title: `Delete ${userDisplayName(u)}?`,
      message: `${u.email} loses access immediately and all role assignments and sessions are revoked. Prefer Deactivate if you may need this account again.`,
      confirmLabel: 'Delete user',
      tone: 'danger',
    });
    if (ok) remove.mutate(u._id);
  };

  const menuItems = (u: ErpUser): DropdownMenuItem[] => {
    const icon = (i: LucideIcon) => i;
    return [
      { label: 'Reset password…', icon: icon(KeyRound), hidden: !canUpdate, onSelect: () => doReset(u) },
      { label: 'Unlock account', icon: icon(LockOpen), hidden: !canUpdate || u.status !== 'LOCKED', onSelect: () => doUnlock(u) },
      { label: 'Lock account', icon: icon(Lock), hidden: !canUpdate || u.status === 'LOCKED' || !!u.isSuperAdmin, onSelect: () => doLock(u) },
      { label: 'Activate', icon: icon(UserCheck), hidden: !canUpdate || u.status !== 'INACTIVE', onSelect: () => doActivate(u) },
      { type: 'separator' },
      { label: 'Deactivate', icon: icon(Ban), danger: true, hidden: !canUpdate || u.status !== 'ACTIVE' || !!u.isSuperAdmin, onSelect: () => doDeactivate(u) },
      { label: 'Delete user', icon: icon(Trash2), danger: true, hidden: !canDelete || !!u.isSuperAdmin, onSelect: () => doDelete(u) },
    ];
  };

  const busy = setStatus.isPending || unlock.isPending || resetPassword.isPending || remove.isPending;

  return { menuItems, busy };
}
