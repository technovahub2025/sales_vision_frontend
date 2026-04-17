import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { NavLink } from 'react-router-dom';
import { z } from 'zod';
import { useSettings } from '../../hooks/useSettings';
import { ROUTES } from '../../routes/routePaths';

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

function tabClassName({ isActive }) {
  return `rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
    isActive ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
  }`;
}

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
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-8 pb-12 pt-2">
        <div className="mb-6 flex items-center gap-3">
          <NavLink to={ROUTES.settings} end className={tabClassName}>
            General
          </NavLink>
          <NavLink to={ROUTES.settingsWorkspace} className={tabClassName}>
            Workspace
          </NavLink>
          <NavLink to={ROUTES.settingsMembers} className={tabClassName}>
            Members
          </NavLink>
          <NavLink to={ROUTES.settingsSecurity} className={tabClassName}>
            Security
          </NavLink>
        </div>

        <section className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">General Settings</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Update your profile, password, and notification preferences.
          </p>
        </section>

        {error || actionError ? (
          <section className="mb-6 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {error || actionError}
          </section>
        ) : null}

        <div className="space-y-8">
          <section className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-on-surface">Profile</h2>
              <p className="text-sm text-on-surface-variant">Keep your account details up to date.</p>
            </div>

            {loading ? (
              <div className="space-y-2">
                <div className="h-10 animate-pulse rounded bg-surface-container" />
                <div className="h-10 animate-pulse rounded bg-surface-container" />
                <div className="h-10 animate-pulse rounded bg-surface-container" />
              </div>
            ) : (
              <form onSubmit={submitProfile} className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-1">
                  <span className="mb-1 block text-sm font-medium text-on-surface">Display Name</span>
                  <input
                    type="text"
                    {...profileForm.register('displayName')}
                    className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
                  />
                  {profileForm.formState.errors.displayName ? (
                    <span className="mt-1 block text-xs text-error">{profileForm.formState.errors.displayName.message}</span>
                  ) : null}
                </label>

                <label className="block sm:col-span-1">
                  <span className="mb-1 block text-sm font-medium text-on-surface">Email</span>
                  <input
                    type="email"
                    {...profileForm.register('email')}
                    className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
                  />
                  {profileForm.formState.errors.email ? (
                    <span className="mt-1 block text-xs text-error">{profileForm.formState.errors.email.message}</span>
                  ) : null}
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-on-surface">Avatar URL</span>
                  <input
                    type="url"
                    placeholder="https://cdn.example.com/avatar.webp"
                    {...profileForm.register('avatarUrl')}
                    className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
                  />
                  {profileForm.formState.errors.avatarUrl ? (
                    <span className="mt-1 block text-xs text-error">{profileForm.formState.errors.avatarUrl.message}</span>
                  ) : null}
                </label>

                <div className="sm:col-span-2 flex items-center justify-between gap-3 pt-2">
                  <span className="text-xs text-on-surface-variant">Changes apply immediately after save.</span>
                  <button
                    type="submit"
                    disabled={profileForm.formState.isSubmitting}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {profileForm.formState.isSubmitting ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
                {profileNotice ? <p className="sm:col-span-2 text-sm text-green-600">{profileNotice}</p> : null}
              </form>
            )}
          </section>

          <section className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-on-surface">Change Password</h2>
              <p className="text-sm text-on-surface-variant">Use a strong password with at least 8 characters.</p>
            </div>

            <form onSubmit={submitPassword} className="grid gap-4 sm:grid-cols-3">
              <input
                type="email"
                autoComplete="username"
                value={profile?.email || ''}
                readOnly
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
              />

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-on-surface">Current Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  {...passwordForm.register('currentPassword')}
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
                />
                {passwordForm.formState.errors.currentPassword ? (
                  <span className="mt-1 block text-xs text-error">{passwordForm.formState.errors.currentPassword.message}</span>
                ) : null}
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-on-surface">New Password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register('newPassword')}
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
                />
                {passwordForm.formState.errors.newPassword ? (
                  <span className="mt-1 block text-xs text-error">{passwordForm.formState.errors.newPassword.message}</span>
                ) : null}
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-on-surface">Confirm Password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register('confirmPassword')}
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
                />
                {passwordForm.formState.errors.confirmPassword ? (
                  <span className="mt-1 block text-xs text-error">{passwordForm.formState.errors.confirmPassword.message}</span>
                ) : null}
              </label>

              <div className="sm:col-span-3 flex items-center justify-between gap-3 pt-2">
                <span className="text-xs text-on-surface-variant">Updating password revokes existing refresh sessions.</span>
                <button
                  type="submit"
                  disabled={passwordForm.formState.isSubmitting}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {passwordForm.formState.isSubmitting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
              {passwordNotice ? <p className="sm:col-span-3 text-sm text-green-600">{passwordNotice}</p> : null}
            </form>
          </section>

          <section className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-on-surface">Notification Preferences</h2>
              <p className="text-sm text-on-surface-variant">Choose which updates you receive in-app.</p>
            </div>

            <form onSubmit={submitNotifications} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {NOTIFICATION_FIELDS.map((field) => (
                  <label
                    key={field.key}
                    className="flex items-center justify-between rounded-lg border border-outline-variant/20 bg-surface px-3 py-2"
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

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={notificationsForm.formState.isSubmitting}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {notificationsForm.formState.isSubmitting ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
              {notificationsNotice ? <p className="text-sm text-green-600">{notificationsNotice}</p> : null}
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

export default SettingsPage;
