import { z } from 'zod';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AuthLayout from '../../components/auth/AuthLayout';
import { FormAlert, TextField } from '../../components/auth/AuthFormControls';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTES } from '../../routes/routePaths';
import { authApi } from '../../api/auth.api';

const schema = z.object({
  displayName: z.string().min(2, 'Name is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must include an uppercase letter')
    .regex(/[a-z]/, 'Must include a lowercase letter')
    .regex(/[0-9]/, 'Must include a number'),
});

export default function InvitePage() {
  const navigate = useNavigate();
  const { token } = useParams();
  const { isAuthenticated, acceptInvite, acceptInviteState } = useAuth();

  const inviteQuery = useQuery({
    queryKey: ['auth', 'invite', token],
    queryFn: () => authApi.getInvite(token).then((payload) => payload.data),
    enabled: Boolean(token),
    retry: false,
  });

  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: '',
      password: '',
    },
    mode: 'onBlur',
  });

  if (isAuthenticated) {
    return <Navigate replace to={ROUTES.dashboard} />;
  }

  async function onSubmit(values) {
    await acceptInvite({
      token,
      displayName: values.displayName,
      password: values.password,
    });
    navigate(ROUTES.onboarding, { replace: true });
  }

  return (
    <AuthLayout
      title="You are invited"
      subtitle={inviteQuery.data ? `Join ${inviteQuery.data.workspace?.name || 'workspace'} as ${inviteQuery.data.role}.` : 'Validating invite...'}
      footer={<span>Already have an account? <Link className="font-semibold text-primary underline" to={ROUTES.login}>Sign in</Link></span>}
    >
      {inviteQuery.isLoading ? <p className="text-sm text-on-surface-variant">Checking invite...</p> : null}
      {inviteQuery.isError ? <FormAlert message={inviteQuery.error?.message || 'Invite is invalid or expired.'} /> : null}

      {inviteQuery.data ? (
        <div className="mb-4 rounded-xl border border-outline-variant bg-surface-container-low p-3 text-sm">
          <p><strong>Email:</strong> {inviteQuery.data.email}</p>
          <p><strong>Invited by:</strong> {inviteQuery.data.inviter?.displayName || 'Team member'}</p>
          <p><strong>Workspace:</strong> {inviteQuery.data.workspace?.name || 'Workspace'}</p>
        </div>
      ) : null}

      {!inviteQuery.isError ? (
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <TextField id="invite-name" label="Full name" register={register('displayName')} error={formState.errors.displayName?.message} />
          <TextField id="invite-password" label="Password" type="password" autoComplete="new-password" register={register('password')} error={formState.errors.password?.message} />

          <FormAlert message={acceptInviteState.error?.message} />

          <button
            type="submit"
            disabled={acceptInviteState.isPending || inviteQuery.isLoading}
            className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {acceptInviteState.isPending ? 'Joining workspace...' : `Join ${inviteQuery.data?.workspace?.name || 'Workspace'}`}
          </button>
        </form>
      ) : null}
    </AuthLayout>
  );
}
