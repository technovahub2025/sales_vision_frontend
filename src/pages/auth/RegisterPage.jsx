import { z } from 'zod';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AuthLayout from '../../components/auth/AuthLayout';
import { FormAlert, TextField } from '../../components/auth/AuthFormControls';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTES } from '../../routes/routePaths';

const schema = z.object({
  displayName: z.string().min(2, 'Name is required'),
  workspaceName: z.string().min(2, 'Workspace name is required'),
  email: z.string().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must include an uppercase letter')
    .regex(/[a-z]/, 'Must include a lowercase letter')
    .regex(/[0-9]/, 'Must include a number'),
});

export default function RegisterPage() {
  const navigate = useNavigate();
  const { isAuthenticated, register: registerUser, registerState } = useAuth();

  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: '',
      workspaceName: '',
      email: '',
      password: '',
    },
    mode: 'onBlur',
  });

  if (isAuthenticated) {
    return <Navigate replace to={ROUTES.dashboard} />;
  }

  async function onSubmit(values) {
    await registerUser(values);
    navigate(ROUTES.onboarding, { replace: true });
  }

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="Start with your team and first project in minutes."
      compact
      showThemeToggle={false}
      footer={<span>Already have an account? <Link className="fw-semibold link-primary" to={ROUTES.login}>Sign in</Link></span>}
    >
      <form className="d-grid gap-3" onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField id="register-name" label="Full name" placeholder="Enter your full name" register={register('displayName')} error={formState.errors.displayName?.message} floating={false} />
        <TextField id="register-workspace" label="Workspace name" placeholder="Enter workspace name" register={register('workspaceName')} error={formState.errors.workspaceName?.message} floating={false} />
        <TextField id="register-email" label="Email" type="email" placeholder="Enter your email" autoComplete="email" register={register('email')} error={formState.errors.email?.message} floating={false} />
        <TextField id="register-password" label="Password" type="password" placeholder="Create password" autoComplete="new-password" register={register('password')} error={formState.errors.password?.message} showPasswordToggle floating={false} />

        <FormAlert message={registerState.error?.message} />

        <button
          type="submit"
          disabled={registerState.isPending}
          className="btn btn-primary w-100 fw-semibold py-2"
        >
          {registerState.isPending ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}
