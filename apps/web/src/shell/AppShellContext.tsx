import { Alert, Button, CircularProgress, Snackbar, Stack } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ApiError, request, type AuthSession, type AuthUser, type ListSettings, type ListVisibility } from '../api';
import { AccountActions } from '../components/AccountActions';
import { AuthDialog, type AuthMode } from '../components/AuthDialog';
import { Brand } from '../components/Brand';
import { TabNav } from '../components/TabNav';
import { listSettingsQueryOptions, queryKeys, sessionQueryOptions } from '../queries';

export type ListTypePath = 'top-list' | 'singing-list';

export interface AppShell {
  user: AuthUser | null;
  isSessionLoading: boolean;
  isSessionError: boolean;
  requireUser: (action: () => void) => void;
  openAuth: (mode: AuthMode) => void;
  notify: (severity: 'success' | 'error', message: string) => void;
  mutate: (path: string, options?: RequestInit) => void;
  setVisibility: (listType: ListTypePath, visibility: ListVisibility) => void;
  isVisibilityPending: boolean;
  onUnauthorized: () => Promise<void>;
}

const AppShellContext = createContext<AppShell | null>(null);

export function useAppShell(): AppShell {
  const value = useContext(AppShellContext);
  if (!value) throw new Error('useAppShell must be used inside AppShellProvider');
  return value;
}

export function AppShellProvider({ children, chrome = true }: { children: ReactNode; chrome?: boolean }) {
  const client = useQueryClient();
  const [authDialog, setAuthDialog] = useState<{ open: boolean; mode: AuthMode }>({ open: false, mode: 'login' });
  const [notice, setNotice] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);

  const sessionQuery = useQuery(sessionQueryOptions());
  const user = sessionQuery.data?.user ?? null;

  const notify = useCallback((severity: 'success' | 'error', message: string) => setNotice({ severity, message }), []);

  const clearPersonalData = useCallback(async () => {
    await client.cancelQueries({ queryKey: queryKeys.personal });
    client.removeQueries({ queryKey: queryKeys.personal });
  }, [client]);

  const loseAuthentication = useCallback(async () => {
    await client.cancelQueries({ queryKey: queryKeys.personal });
    client.setQueriesData({ queryKey: queryKeys.personal }, undefined);
    client.setQueryData<AuthSession>(queryKeys.session, { user: null });
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    client.removeQueries({ queryKey: queryKeys.personal });
  }, [client]);

  const authMutation = useMutation({
    mutationFn: ({ mode, ...input }: { mode: AuthMode; username: string; displayName?: string; password: string }) => request<{ user: AuthUser }>(mode === 'register' ? '/api/auth/register' : '/api/auth/login', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: async ({ user: authenticatedUser }) => {
      await clearPersonalData();
      client.setQueryData<AuthSession>(queryKeys.session, { user: authenticatedUser });
      setAuthDialog((current) => ({ ...current, open: false }));
      setNotice({ severity: 'success', message: `Welcome, ${authenticatedUser.displayName}` });
    }
  });
  const authMutationReset = authMutation.reset;
  const openAuth = useCallback((mode: AuthMode) => {
    authMutationReset();
    setAuthDialog({ open: true, mode });
  }, [authMutationReset]);

  const logoutMutation = useMutation({
    mutationFn: () => request<void>('/api/auth/logout', { method: 'POST' }),
    onSuccess: async () => {
      await loseAuthentication();
      setNotice({ severity: 'success', message: 'Signed out' });
    },
    onError: (error) => setNotice({ severity: 'error', message: error instanceof ApiError ? error.message : 'Could not sign out. Please try again.' })
  });

  const invalidatePersonalLists = useCallback(() => Promise.all([
    client.invalidateQueries({ queryKey: user ? queryKeys.topList(user.id) : queryKeys.personal }),
    client.invalidateQueries({ queryKey: user ? ['personal', user.id, 'singing-list'] : queryKeys.personal })
  ]), [client, user]);

  const mutation = useMutation({
    mutationFn: ({ path, options }: { path: string; options?: RequestInit }) => request<unknown>(path, options),
    onSuccess: async () => { await invalidatePersonalLists(); setNotice({ severity: 'success', message: 'Saved successfully' }); },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) void loseAuthentication();
      setNotice({ severity: 'error', message: error instanceof ApiError ? error.message : 'Something went wrong. Please try again.' });
    }
  });

  const visibilityMutation = useMutation({
    mutationFn: ({ listType, visibility }: { listType: ListTypePath; visibility: ListVisibility }) => request<ListSettings>(`/api/me/lists/${listType}/visibility`, { method: 'PATCH', body: JSON.stringify({ visibility }) }),
    onSuccess: (settings) => {
      if (user) client.setQueryData(listSettingsQueryOptions(user).queryKey, settings);
      setNotice({ severity: 'success', message: 'List visibility updated' });
    },
    onError: (error) => setNotice({ severity: 'error', message: error instanceof ApiError ? error.message : 'Could not update visibility' })
  });

  const runMutation = mutation.mutate;
  const mutate = useCallback((path: string, options?: RequestInit) => runMutation({ path, options }), [runMutation]);
  const runVisibilityMutation = visibilityMutation.mutate;
  const setVisibility = useCallback((listType: ListTypePath, visibility: ListVisibility) => runVisibilityMutation({ listType, visibility }), [runVisibilityMutation]);
  const requireUser = useCallback((action: () => void) => { if (user) action(); else openAuth('login'); }, [user, openAuth]);

  const value = useMemo<AppShell>(() => ({
    user,
    isSessionLoading: sessionQuery.isLoading,
    isSessionError: sessionQuery.isError,
    requireUser,
    openAuth,
    notify,
    mutate,
    setVisibility,
    isVisibilityPending: visibilityMutation.isPending,
    onUnauthorized: loseAuthentication
  }), [user, sessionQuery.isLoading, sessionQuery.isError, requireUser, openAuth, notify, mutate, setVisibility, visibilityMutation.isPending, loseAuthentication]);

  const accountAction = sessionQuery.isLoading ? <CircularProgress size={22} aria-label="Loading account" /> : user
    ? <AccountActions user={user} onLogout={() => logoutMutation.mutate()} />
    : <Stack direction="row" spacing={1}><Button onClick={() => openAuth('login')}>Sign in</Button><Button variant="contained" onClick={() => openAuth('register')}>Register</Button></Stack>;

  return <AppShellContext.Provider value={value}>
    {chrome && <Brand action={accountAction} />}
    {chrome && <TabNav />}
    {children}
    <AuthDialog open={authDialog.open} initialMode={authDialog.mode} isPending={authMutation.isPending} error={authMutation.error instanceof ApiError ? authMutation.error.message : authMutation.isError ? 'Something went wrong. Please try again.' : null} onClose={() => setAuthDialog((current) => ({ ...current, open: false }))} onSubmit={(input) => authMutation.mutate(input)} />
    <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}><Alert severity={notice?.severity} onClose={() => setNotice(null)} variant="filled">{notice?.message}</Alert></Snackbar>
  </AppShellContext.Provider>;
}
