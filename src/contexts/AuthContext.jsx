import { createContext, useContext, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import { configureAxiosAuth } from '../api/axiosClient';

const AuthContext = createContext(null);

const AUTH_QUERY_KEY = ['auth', 'me'];
const ACCESS_TOKEN_STORAGE_KEY = 'salevision:accessToken';

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: () => authApi.me().then((payload) => payload.data),
    retry: false,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  });

  useEffect(() => {
    configureAxiosAuth({
      onUnauthorized: () => {
        queryClient.setQueryData(AUTH_QUERY_KEY, null);
        window.localStorage.removeItem('salevision:userId');
        window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
      },
    });
  }, [queryClient]);

  useEffect(() => {
    if (meQuery.data?.user?._id || meQuery.data?.user?.id) {
      window.localStorage.setItem('salevision:userId', String(meQuery.data.user._id || meQuery.data.user.id));
    }
  }, [meQuery.data]);

  const loginMutation = useMutation({
    mutationFn: (values) => authApi.login(values).then((payload) => payload.data),
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, data);
      if (data?.accessToken) {
        window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, String(data.accessToken));
      }
      if (data?.user?._id || data?.user?.id) {
        window.localStorage.setItem('salevision:userId', String(data.user._id || data.user.id));
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: (values) => authApi.register(values).then((payload) => payload.data),
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, data);
      if (data?.accessToken) {
        window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, String(data.accessToken));
      }
      if (data?.user?._id || data?.user?.id) {
        window.localStorage.setItem('salevision:userId', String(data.user._id || data.user.id));
      }
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.removeQueries();
      window.localStorage.removeItem('salevision:userId');
      window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: (values) => authApi.forgotPassword(values).then((payload) => payload.data),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (values) => authApi.resetPassword(values).then((payload) => payload.data),
  });

  const acceptInviteMutation = useMutation({
    mutationFn: (values) => authApi.acceptInvite(values).then((payload) => payload.data),
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, data);
      if (data?.accessToken) {
        window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, String(data.accessToken));
      }
      if (data?.user?._id || data?.user?.id) {
        window.localStorage.setItem('salevision:userId', String(data.user._id || data.user.id));
      }
    },
  });

  const value = useMemo(() => {
    const session = meQuery.data;
    const user = session?.user || null;
    const memberships = session?.memberships || [];
    // Determine an initial/default workspace ID if available in the session or from memberships.
    // This can be consumed by WorkspaceContext to set the active workspace.
    const defaultWorkspaceId = session?.defaultWorkspaceId || (memberships.length > 0 ? memberships[0].workspace._id : null);


    return {
      session,
      user,
      memberships,
      isAuthenticated: Boolean(user),
      isLoading: meQuery.isLoading,
      isFetching: meQuery.isFetching,
      error: meQuery.error,
      login: loginMutation.mutateAsync,
      register: registerMutation.mutateAsync,
      logout: logoutMutation.mutateAsync,
      forgotPassword: forgotPasswordMutation.mutateAsync,
      resetPassword: resetPasswordMutation.mutateAsync,
      acceptInvite: acceptInviteMutation.mutateAsync,
      loginState: loginMutation,
      defaultWorkspaceId, // Expose a default workspace ID for other contexts/components
      registerState: registerMutation,
      logoutState: logoutMutation,
      forgotPasswordState: forgotPasswordMutation,
      resetPasswordState: resetPasswordMutation,
      acceptInviteState: acceptInviteMutation,
      refetchSession: meQuery.refetch,
    };
  }, [
    meQuery.data,
    meQuery.isLoading,
    meQuery.isFetching,
    meQuery.error,
    meQuery.refetch,
    loginMutation,
    registerMutation,
    logoutMutation,
    forgotPasswordMutation,
    resetPasswordMutation,
    acceptInviteMutation,
    // defaultWorkspaceId is derived from session.memberships and session.defaultWorkspaceId,
    // which are already dependencies, so no need to add defaultWorkspaceId itself.
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
