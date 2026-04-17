import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AuthLayout from '../../components/auth/AuthLayout';
import { FormAlert, TextField } from '../../components/auth/AuthFormControls';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTES } from '../../routes/routePaths';

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must include an uppercase letter')
      .regex(/[a-z]/, 'Must include a lowercase letter')
      .regex(/[0-9]/, 'Must include a number'),
    confirmPassword: z.string().min(1, 'Please confirm password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match',
  });

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token } = useParams();
  const { resetPassword, resetPasswordState } = useAuth();

  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
    mode: 'onBlur',
  });

  async function onSubmit(values) {
    await resetPassword({ token, newPassword: values.newPassword });
    navigate(ROUTES.login, { replace: true });
  }

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a strong password to secure your account."
      footer={<span>Back to <Link className="fw-semibold link-primary" to={ROUTES.login}>sign in</Link></span>}
    >
      <form className="d-grid gap-3" onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField id="reset-password" label="New password" type="password" autoComplete="new-password" register={register('newPassword')} error={formState.errors.newPassword?.message} />
        <TextField id="reset-confirm-password" label="Confirm password" type="password" autoComplete="new-password" register={register('confirmPassword')} error={formState.errors.confirmPassword?.message} />

        <FormAlert message={resetPasswordState.error?.message} />

        <button
          type="submit"
          disabled={resetPasswordState.isPending}
          className="btn btn-primary w-100 fw-semibold py-2"
        >
          {resetPasswordState.isPending ? 'Saving...' : 'Update password'}
        </button>
      </form>
    </AuthLayout>
  );
}
