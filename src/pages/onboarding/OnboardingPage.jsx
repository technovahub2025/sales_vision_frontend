import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { invitesApi, projectsApi, settingsApi, tasksApi } from '../../api';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { ROUTES } from '../../routes/routePaths';
import SelectDropdown from '../../components/ui/SelectDropdown';

const STORAGE_KEY = 'salevision:onboarding:v1';

const workspaceSchema = z.object({
  workspaceName: z.string().trim().min(2, 'Workspace name is required').max(120),
});

const inviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  role: z.enum(['admin', 'member', 'viewer']),
});
const INVITE_ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
];

const projectSchema = z.object({
  name: z.string().trim().min(2, 'Project name is required').max(120),
  status: z.enum(['active', 'paused', 'planning']).default('active'),
});

const taskSchema = z.object({
  title: z.string().trim().min(2, 'Task title is required').max(160),
});

function readState() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      currentStep: Number(parsed.currentStep) || 0,
      workspaceName: parsed.workspaceName || '',
      projectId: parsed.projectId || '',
      completed: Boolean(parsed.completed),
    };
  } catch {
    return { currentStep: 0, workspaceName: '', projectId: '', completed: false };
  }
}

export default function OnboardingPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { workspaceId, setProjectId } = useWorkspace();
  const [state, setState] = useState(readState);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const workspaceQuery = useQuery({
    queryKey: ['settings', 'workspace', workspaceId],
    queryFn: () => settingsApi.getWorkspace(workspaceId).then((payload) => payload.data),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });

  const invitesQuery = useQuery({
    queryKey: ['invites', workspaceId],
    queryFn: () => invitesApi.list(workspaceId, { status: 'pending', page: 1, limit: 50 }).then((payload) => payload.data),
    enabled: Boolean(workspaceId),
    staleTime: 10_000,
  });

  const updateWorkspaceMutation = useMutation({
    mutationFn: (values) => settingsApi.updateWorkspace(workspaceId, { name: values.workspaceName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'workspace', workspaceId] });
    },
  });

  const createInviteMutation = useMutation({
    mutationFn: (values) => invitesApi.create(workspaceId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites', workspaceId] });
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: (values) => projectsApi.create(workspaceId, values),
  });

  const createTaskMutation = useMutation({
    mutationFn: (values) => tasksApi.create(workspaceId, values),
  });

  const workspaceForm = useForm({
    resolver: zodResolver(workspaceSchema),
    values: {
      workspaceName: state.workspaceName || workspaceQuery.data?.name || '',
    },
  });

  const inviteForm = useForm({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'member' },
  });

  const projectForm = useForm({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: '', status: 'active' },
  });

  const taskForm = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: '' },
  });

  const step = state.currentStep;

  const stepTitle = useMemo(() => {
    if (step === 0) return 'Create workspace';
    if (step === 1) return 'Invite members';
    if (step === 2) return 'Create first project';
    return 'Create first task';
  }, [step]);

  function goNext() {
    setState((current) => ({ ...current, currentStep: Math.min(current.currentStep + 1, 3) }));
  }

  function goPrev() {
    setState((current) => ({ ...current, currentStep: Math.max(current.currentStep - 1, 0) }));
  }

  async function submitWorkspace(values) {
    await updateWorkspaceMutation.mutateAsync(values);
    setState((current) => ({ ...current, workspaceName: values.workspaceName }));
    goNext();
  }

  async function submitInvite(values) {
    await createInviteMutation.mutateAsync(values);
    inviteForm.reset({ email: '', role: values.role });
  }

  async function submitProject(values) {
    const response = await createProjectMutation.mutateAsync(values);
    const projectId = response?.data?._id || response?.data?.id || response?.data?.projectId;
    if (projectId) {
      setProjectId(String(projectId));
      window.localStorage.setItem('salevision:projectId', String(projectId));
      setState((current) => ({ ...current, projectId: String(projectId) }));
    }
    goNext();
  }

  async function submitTask(values) {
    const projectId = state.projectId || window.localStorage.getItem('salevision:projectId') || '';
    if (!projectId) {
      taskForm.setError('title', { type: 'manual', message: 'Create or select a project first.' });
      return;
    }

    await createTaskMutation.mutateAsync({
      title: values.title,
      projectId,
      status: 'todo',
      priority: 'medium',
    });

    setState((current) => ({ ...current, completed: true }));
    window.localStorage.removeItem(STORAGE_KEY);
    navigate(ROUTES.dashboard, { replace: true });
  }

  return (
    <section className="mx-auto max-w-4xl rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Onboarding</p>
        <h1 className="mt-2 text-2xl font-bold">{stepTitle}</h1>
        <p className="mt-1 text-sm text-on-surface-variant">Step {step + 1} of 4</p>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-container">
          <div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / 4) * 100}%` }} />
        </div>
      </header>

      {workspaceQuery.isLoading ? (
        <div className="space-y-2">
          <div className="h-10 animate-pulse rounded bg-surface-container" />
          <div className="h-10 animate-pulse rounded bg-surface-container" />
        </div>
      ) : null}

      {step === 0 ? (
        <form className="space-y-4" onSubmit={workspaceForm.handleSubmit(submitWorkspace)}>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Workspace name</span>
            <input
              className="w-full rounded-xl border border-outline-variant px-3 py-2"
              {...workspaceForm.register('workspaceName')}
            />
            <p className="mt-1 text-xs text-error">{workspaceForm.formState.errors.workspaceName?.message}</p>
          </label>

          <p className="text-xs text-on-surface-variant">This step is required.</p>

          <div className="flex items-center gap-2">
            <button type="submit" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary" disabled={updateWorkspaceMutation.isPending}>
              {updateWorkspaceMutation.isPending ? 'Saving...' : 'Continue'}
            </button>
          </div>
        </form>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <form className="grid gap-3 md:grid-cols-[1fr_auto_auto]" onSubmit={inviteForm.handleSubmit(submitInvite)}>
            <input className="rounded-xl border border-outline-variant px-3 py-2" placeholder="colleague@company.com" {...inviteForm.register('email')} />
            <Controller
              control={inviteForm.control}
              name="role"
              render={({ field }) => (
                <SelectDropdown
                  value={field.value}
                  onChange={field.onChange}
                  options={INVITE_ROLE_OPTIONS}
                  triggerClassName="rounded-xl border border-outline-variant px-3 py-2"
                />
              )}
            />
            <button type="submit" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary" disabled={createInviteMutation.isPending}>
              Send invite
            </button>
          </form>
          <p className="text-xs text-error">{inviteForm.formState.errors.email?.message}</p>

          {!invitesQuery.data?.length ? (
            <div className="rounded-xl border border-dashed border-outline-variant p-4 text-sm text-on-surface-variant">No pending invites yet.</div>
          ) : (
            <ul className="space-y-2">
              {invitesQuery.data.map((invite) => (
                <li key={invite._id || invite.id} className="rounded-xl border border-outline-variant p-3 text-sm">
                  <strong>{invite.email}</strong> - {invite.role}
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2">
            <button type="button" className="rounded-xl border border-outline-variant px-4 py-2 text-sm" onClick={goPrev}>Back</button>
            <button type="button" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary" onClick={goNext}>Skip / Continue</button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <form className="space-y-4" onSubmit={projectForm.handleSubmit(submitProject)}>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Project name</span>
            <input className="w-full rounded-xl border border-outline-variant px-3 py-2" placeholder="Q2 Product Launch" {...projectForm.register('name')} />
            <p className="mt-1 text-xs text-error">{projectForm.formState.errors.name?.message}</p>
          </label>

          <div className="flex items-center gap-2">
            <button type="button" className="rounded-xl border border-outline-variant px-4 py-2 text-sm" onClick={goPrev}>Back</button>
            <button type="button" className="rounded-xl border border-outline-variant px-4 py-2 text-sm" onClick={goNext}>Skip</button>
            <button type="submit" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary" disabled={createProjectMutation.isPending}>
              {createProjectMutation.isPending ? 'Creating...' : 'Create project'}
            </button>
          </div>
        </form>
      ) : null}

      {step === 3 ? (
        <form className="space-y-4" onSubmit={taskForm.handleSubmit(submitTask)}>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">First task title</span>
            <input className="w-full rounded-xl border border-outline-variant px-3 py-2" placeholder="Kickoff sprint planning" {...taskForm.register('title')} />
            <p className="mt-1 text-xs text-error">{taskForm.formState.errors.title?.message}</p>
          </label>

          <div className="flex items-center gap-2">
            <button type="button" className="rounded-xl border border-outline-variant px-4 py-2 text-sm" onClick={goPrev}>Back</button>
            <button
              type="button"
              className="rounded-xl border border-outline-variant px-4 py-2 text-sm"
              onClick={() => {
                window.localStorage.removeItem(STORAGE_KEY);
                navigate(ROUTES.dashboard, { replace: true });
              }}
            >
              Skip
            </button>
            <button type="submit" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary" disabled={createTaskMutation.isPending}>
              {createTaskMutation.isPending ? 'Creating...' : 'Finish onboarding'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
