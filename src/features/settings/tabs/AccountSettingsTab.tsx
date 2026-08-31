import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { usersApi } from '../../../services/admin';
import { ErpButton, ErpInput } from '../../../components/erp';
import { FieldLabel, SettingsSection } from '../SettingsSection';

export function AccountSettingsTab({ onError, onSuccess }: { onError: (m: string) => void; onSuccess: (m: string) => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const change = useMutation({
    mutationFn: () => usersApi.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onSuccess('Password changed successfully');
    },
    onError: (e: Error) => onError(e.message),
  });

  const canSubmit = currentPassword.length >= 1 && newPassword.length >= 8 && newPassword === confirmPassword;

  return (
    <SettingsSection title="Change password" description="Update your login password. You will stay signed in on this device.">
      <div className="grid max-w-md gap-2">
        <FieldLabel label="Current password">
          <ErpInput type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="!py-1 !text-[11px] w-full" autoComplete="current-password" />
        </FieldLabel>
        <FieldLabel label="New password" hint="Minimum 8 characters">
          <ErpInput type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="!py-1 !text-[11px] w-full" autoComplete="new-password" />
        </FieldLabel>
        <FieldLabel label="Confirm new password">
          <ErpInput type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="!py-1 !text-[11px] w-full" autoComplete="new-password" />
        </FieldLabel>
        {confirmPassword && newPassword !== confirmPassword && (
          <p className="text-[10px] text-red-500">Passwords do not match</p>
        )}
        <div className="pt-1">
          <ErpButton className="!px-3 !py-1 text-[11px]" disabled={!canSubmit || change.isPending} onClick={() => change.mutate()}>
            Update password
          </ErpButton>
        </div>
      </div>
    </SettingsSection>
  );
}
