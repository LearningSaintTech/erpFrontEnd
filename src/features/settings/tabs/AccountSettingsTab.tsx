import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { usersApi } from '../../../services/admin';
import { useAuth } from '../../../app/providers/AuthProvider';
import {
  Button, DescriptionList, ErpInput, Field,
} from '../../../components/erp';
import { SettingsSection } from '../SettingsSection';

export function AccountSettingsTab() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const change = useMutation({
    mutationFn: () => usersApi.changePassword(currentPassword, newPassword),
    meta: { successMessage: 'Password changed', successDescription: 'Other devices have been signed out.' },
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!currentPassword) next.current = 'Enter your current password.';
    if (newPassword.length < 8) next.new = 'Use at least 8 characters.';
    else if (newPassword === currentPassword) next.new = 'Choose a password different from the current one.';
    if (confirmPassword !== newPassword) next.confirm = 'The two new passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length === 0) change.mutate();
  };

  return (
    <div className="space-y-4">
      {user && (
        <SettingsSection title="Profile" description="Ask an administrator to change your name or email.">
          <DescriptionList
            columns={2}
            items={[
              { label: 'Name', value: [user.firstName, user.lastName].filter(Boolean).join(' ') },
              { label: 'Email', value: user.email },
            ]}
          />
        </SettingsSection>
      )}

      <SettingsSection title="Change password" description="Other devices are signed out. Use the new password next time you sign in.">
        <form onSubmit={submit} className="grid max-w-md gap-4" noValidate>
          {/* Hidden username helps password managers associate the new password. */}
          <input type="text" name="username" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
          <Field label="Current password" required error={errors.current}>
            <ErpInput type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field label="New password" required hint="At least 8 characters." error={errors.new}>
            <ErpInput type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password" required error={errors.confirm}>
            <ErpInput type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          <div>
            <Button type="submit" loading={change.isPending}>Update password</Button>
          </div>
        </form>
      </SettingsSection>
    </div>
  );
}
