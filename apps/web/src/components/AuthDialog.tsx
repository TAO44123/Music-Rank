import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState, type FormEvent } from 'react';

export type AuthMode = 'login' | 'register';

type AuthDialogProps = {
  open: boolean;
  initialMode: AuthMode;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: { mode: AuthMode; username: string; displayName?: string; password: string }) => void;
};

export function AuthDialog({ open, initialMode, isPending, error, onClose, onSubmit }: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (open) setMode(initialMode);
    else setPassword('');
  }, [initialMode, open]);

  const switchMode = () => {
    setMode((value) => value === 'login' ? 'register' : 'login');
    setPassword('');
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ mode, username, displayName: mode === 'register' ? displayName : undefined, password });
  };

  return <Dialog open={open} onClose={isPending ? undefined : onClose} fullWidth maxWidth="xs" aria-labelledby="auth-dialog-title">
    <form onSubmit={submit}>
      <DialogTitle id="auth-dialog-title">{mode === 'login' ? 'Sign in to Music Rank' : 'Create your account'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography color="text.secondary">{mode === 'login' ? 'Return to your personal music lists.' : 'Start building and sharing your personal music lists.'}</Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField autoFocus label="Username" name="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required inputProps={{ minLength: 3, maxLength: 32, pattern: '[A-Za-z0-9_]+' }} helperText="3–32 letters, numbers, or underscores" />
          {mode === 'register' && <TextField label="Display name" name="displayName" autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required inputProps={{ maxLength: 80 }} />}
          <TextField label="Password" name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} required inputProps={{ minLength: mode === 'register' ? 12 : 1, maxLength: 128 }} helperText={mode === 'register' ? 'Use at least 12 characters' : undefined} />
          <Button onClick={switchMode} disabled={isPending} sx={{ alignSelf: 'flex-start' }}>{mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}</Button>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={isPending}>Cancel</Button>
        <Button type="submit" variant="contained" loading={isPending}>{mode === 'login' ? 'Sign in' : 'Create account'}</Button>
      </DialogActions>
    </form>
  </Dialog>;
}
