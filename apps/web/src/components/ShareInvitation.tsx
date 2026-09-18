import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useAppShell } from '../shell/AppShellContext';

export function ShareInvitation() {
  const { notify } = useAppShell();
  const [manual, setManual] = useState(false);
  const [pending, setPending] = useState(false);
  const url = `${window.location.origin}/invite/default`;
  const share = async () => {
    setPending(true);
    try {
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: 'Join Default Group on Music Rank', url });
          notify('success', 'Invitation shared');
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return;
        }
      }
      if (typeof navigator.clipboard?.writeText === 'function') {
        try {
          await navigator.clipboard.writeText(url);
          notify('success', 'Invitation link copied');
          return;
        } catch {
          // A selectable link remains usable when clipboard permission fails.
        }
      }
      setManual(true);
    } finally {
      setPending(false);
    }
  };
  return <>
    <Button variant="outlined" startIcon={<ShareOutlinedIcon />} disabled={pending} onClick={() => void share()}>Share invitation</Button>
    <Dialog open={manual} onClose={() => setManual(false)} aria-labelledby="copy-invitation-title" fullWidth maxWidth="sm">
      <DialogTitle id="copy-invitation-title">Copy invitation link</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <Typography>Select the link below and copy it to invite someone to Default Group.</Typography>
        <TextField label="Invitation link" value={url} fullWidth slotProps={{ input: { readOnly: true } }} onFocus={(event) => { if (event.target instanceof HTMLInputElement) event.target.select(); }} />
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setManual(false)}>Done</Button></DialogActions>
    </Dialog>
  </>;
}
