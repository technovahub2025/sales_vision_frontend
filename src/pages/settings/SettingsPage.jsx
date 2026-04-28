import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Icon from '../../components/ui/Icon';
import { useSettings } from '../../hooks/useSettings';
import SettingsTabs from './SettingsTabs';

const PROFILE_SCHEMA = z.object({
  displayName: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name must be 80 characters or less'),
  email: z.string().trim().email('Enter a valid email address'),
  avatarUrl: z
    .string()
    .trim()
    .max(500, 'Avatar URL is too long')
    .refine((value) => !value || /^https?:\/\//i.test(value), 'Avatar URL must start with http:// or https://'),
});

const PASSWORD_SCHEMA = z
  .object({
    currentPassword: z.string().min(8, 'Current password must be at least 8 characters'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Confirm password must be at least 8 characters'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const NOTIFICATION_FIELDS = [
  { key: 'taskAssigned', label: 'Task assigned' },
  { key: 'taskComment', label: 'Task comment' },
  { key: 'taskMention', label: '@Mention' },
  { key: 'sprintUpdates', label: 'Sprint updates' },
  { key: 'workspaceMember', label: 'Member changes' },
  { key: 'dueDateReminder', label: 'Due date reminders' },
  { key: 'securityAlerts', label: 'Security alerts' },
];

const NOTIFICATION_SCHEMA = z.object(
  NOTIFICATION_FIELDS.reduce((shape, field) => {
    shape[field.key] = z.boolean();
    return shape;
  }, {}),
);

function SettingsPage() {
  const {
    profile,
    preferences,
    loading,
    error,
    updateProfile,
    updatePassword,
    updateNotifications,
  } = useSettings();

  const [profileNotice, setProfileNotice] = useState('');
  const [passwordNotice, setPasswordNotice] = useState('');
  const [notificationsNotice, setNotificationsNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const profileDefaults = useMemo(
    () => ({
      displayName: profile?.displayName || '',
      email: profile?.email || '',
      avatarUrl: profile?.avatarUrl || '',
    }),
    [profile?.avatarUrl, profile?.displayName, profile?.email],
  );

  const notificationDefaults = useMemo(() => {
    return NOTIFICATION_FIELDS.reduce((result, field) => {
      result[field.key] = Boolean(preferences?.[field.key]);
      return result;
    }, {});
  }, [preferences]);

  const profileForm = useForm({
    resolver: zodResolver(PROFILE_SCHEMA),
    defaultValues: profileDefaults,
    mode: 'onTouched',
  });

  const passwordForm = useForm({
    resolver: zodResolver(PASSWORD_SCHEMA),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    mode: 'onTouched',
  });

  const notificationsForm = useForm({
    resolver: zodResolver(NOTIFICATION_SCHEMA),
    defaultValues: notificationDefaults,
    mode: 'onChange',
  });

  useEffect(() => {
    profileForm.reset(profileDefaults);
  }, [profileDefaults, profileForm]);

  useEffect(() => {
    notificationsForm.reset(notificationDefaults);
  }, [notificationDefaults, notificationsForm]);

  const submitProfile = profileForm.handleSubmit(async (values) => {
    setActionError('');
    setProfileNotice('');
    try {
      await updateProfile(values);
      setProfileNotice('Profile updated successfully.');
    } catch (submitError) {
      setActionError(submitError.message || 'Failed to update profile.');
    }
  });

  const submitPassword = passwordForm.handleSubmit(async (values) => {
    setActionError('');
    setPasswordNotice('');
    try {
      await updatePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      setPasswordNotice('Password updated successfully.');
      passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (submitError) {
      setActionError(submitError.message || 'Failed to update password.');
    }
  });

  const submitNotifications = notificationsForm.handleSubmit(async (values) => {
    setActionError('');
    setNotificationsNotice('');
    try {
      await updateNotifications(values);
      setNotificationsNotice('Notification preferences saved.');
    } catch (submitError) {
      setActionError(submitError.message || 'Failed to update notification preferences.');
    }
  });

  return (
    <main className="min-h-screen sv-settings-page">
      <div className="sv-settings-shell">
        <SettingsTabs />

        <section className="sv-settings-header">
          <h1 className="sv-settings-title">General Settings</h1>
          <p className="sv-settings-subtitle">
            Update your profile, password, and notification preferences.
          </p>
        </section>

        {error || actionError ? (
          <section className="sv-settings-alert">
            {error || actionError}
          </section>
        ) : null}

        <div className="sv-settings-stack">
          <section className="sv-settings-card">
            <div className="sv-settings-card-head">
              <h2 className="sv-settings-card-title">Profile</h2>
              <p className="sv-settings-card-subtitle">Keep your account details up to date.</p>
            </div>

            {loading ? (
              <div className="space-y-2">
                <div className="h-10 animate-pulse rounded bg-surface-container" />
                <div className="h-10 animate-pulse rounded bg-surface-container" />
                <div className="h-10 animate-pulse rounded bg-surface-container" />
              </div>
            ) : (
              <form onSubmit={submitProfile} className="sv-settings-form-grid">
                <label className="sv-settings-field sm:col-span-1">
                  <span className="sv-settings-label">Display Name</span>
                  <input
                    type="text"
                    {...profileForm.register('displayName')}
                    className="sv-settings-input"
                  />
                  {profileForm.formState.errors.displayName ? (
                    <span className="sv-settings-error">{profileForm.formState.errors.displayName.message}</span>
                  ) : null}
                </label>

                <label className="sv-settings-field sm:col-span-1">
                  <span className="sv-settings-label">Email</span>
                  <input
                    type="email"
                    {...profileForm.register('email')}
                    className="sv-settings-input"
                  />
                  {profileForm.formState.errors.email ? (
                    <span className="sv-settings-error">{profileForm.formState.errors.email.message}</span>
                  ) : null}
                </label>

                <label className="sv-settings-field sm:col-span-2">
                  <span className="sv-settings-label">Avatar URL</span>
                  <input
                    type="url"
                    placeholder="https://cdn.example.com/avatar.webp"
                    {...profileForm.register('avatarUrl')}
                    className="sv-settings-input"
                  />
                  {profileForm.formState.errors.avatarUrl ? (
                    <span className="sv-settings-error">{profileForm.formState.errors.avatarUrl.message}</span>
                  ) : null}
                </label>

                <div className="sm:col-span-2 sv-settings-form-actions">
                  <span className="sv-settings-note">Changes apply immediately after save.</span>
                  <button
                    type="submit"
                    disabled={profileForm.formState.isSubmitting}
                    className="sv-settings-btn sv-settings-btn-primary"
                  >
                    <Icon name="save" className="text-[1rem]" />
                    {profileForm.formState.isSubmitting ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
                {profileNotice ? <p className="sm:col-span-2 sv-settings-success">{profileNotice}</p> : null}
              </form>
            )}
          </section>

          <section className="sv-settings-card">
            <div className="sv-settings-card-head">
              <h2 className="sv-settings-card-title">Change Password</h2>
              <p className="sv-settings-card-subtitle">Use a strong password with at least 8 characters.</p>
            </div>

            <form onSubmit={submitPassword} className="sv-settings-form-grid sv-settings-form-grid-3">
              <input
                type="email"
                autoComplete="username"
                value={profile?.email || ''}
                readOnly
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
              />

              <label className="sv-settings-field">
                <span className="sv-settings-label">Current Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  {...passwordForm.register('currentPassword')}
                  className="sv-settings-input"
                />
                {passwordForm.formState.errors.currentPassword ? (
                  <span className="sv-settings-error">{passwordForm.formState.errors.currentPassword.message}</span>
                ) : null}
              </label>

              <label className="sv-settings-field">
                <span className="sv-settings-label">New Password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register('newPassword')}
                  className="sv-settings-input"
                />
                {passwordForm.formState.errors.newPassword ? (
                  <span className="sv-settings-error">{passwordForm.formState.errors.newPassword.message}</span>
                ) : null}
              </label>

              <label className="sv-settings-field">
                <span className="sv-settings-label">Confirm Password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register('confirmPassword')}
                  className="sv-settings-input"
                />
                {passwordForm.formState.errors.confirmPassword ? (
                  <span className="sv-settings-error">{passwordForm.formState.errors.confirmPassword.message}</span>
                ) : null}
              </label>

              <div className="sm:col-span-3 sv-settings-form-actions">
                <span className="sv-settings-note">Updating password revokes existing refresh sessions.</span>
                <button
                  type="submit"
                  disabled={passwordForm.formState.isSubmitting}
                  className="sv-settings-btn sv-settings-btn-primary"
                >
                  <Icon name="lock_reset" className="text-[1rem]" />
                  {passwordForm.formState.isSubmitting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
              {passwordNotice ? <p className="sm:col-span-3 sv-settings-success">{passwordNotice}</p> : null}
            </form>
          </section>

          <section className="sv-settings-card">
            <div className="sv-settings-card-head">
              <h2 className="sv-settings-card-title">Notification Preferences</h2>
              <p className="sv-settings-card-subtitle">Choose which updates you receive in-app.</p>
            </div>

            <form onSubmit={submitNotifications} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {NOTIFICATION_FIELDS.map((field) => (
                  <label
                    key={field.key}
                    className="sv-settings-switch"
                  >
                    <span className="text-sm text-on-surface">{field.label}</span>
                    <input
                      type="checkbox"
                      {...notificationsForm.register(field.key)}
                      className="h-4 w-4 rounded border-outline-variant"
                    />
                  </label>
                ))}
              </div>

              <div className="sv-settings-form-actions justify-end">
                <button
                  type="submit"
                  disabled={notificationsForm.formState.isSubmitting}
                  className="sv-settings-btn sv-settings-btn-primary"
                >
                  <Icon name="notifications_active" className="text-[1rem]" />
                  {notificationsForm.formState.isSubmitting ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
              {notificationsNotice ? <p className="sv-settings-success">{notificationsNotice}</p> : null}
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

export default SettingsPage;
