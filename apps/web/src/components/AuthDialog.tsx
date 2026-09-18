import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState, type FormEvent } from 'react';

export type AuthMode = 'login' | 'register';

type AuthDialogProps = {
  open: boolean;
  initialMode: AuthMode;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onModeChange?: () => void;
  onSubmit: (input: { mode: AuthMode; username: string }) => void;
};

export function AuthDialog({ open, initialMode, isPending, error, onClose, onModeChange, onSubmit }: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [username, setUsername] = useState('');

  useEffect(() => {
    if (open) setMode(initialMode);
  }, [initialMode, open]);

  const switchMode = () => {
    setMode((value) => value === 'login' ? 'register' : 'login');
    onModeChange?.();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ mode, username });
  };

  return <Dialog open={open} onClose={isPending ? undefined : onClose} fullWidth maxWidth="xs" aria-labelledby="auth-dialog-title">
    <form onSubmit={submit}>
      <DialogTitle id="auth-dialog-title">{mode === 'login' ? 'Sign in to Music Rank' : 'Create your account'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography color="text.secondary">{mode === 'login' ? 'Enter your username to return to your music lists.' : 'Choose a username to create your account.'}</Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField autoFocus label="Username" name="username" autoComplete="username" value={username} disabled={isPending} onChange={(event) => setUsername(event.target.value)} required inputProps={{ minLength: 3, maxLength: 32, pattern: '[A-Za-z0-9_]+' }} helperText="3–32 letters, numbers, or underscores" />
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
