import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LockOutlineIcon from '@mui/icons-material/LockOutline';
import PublicIcon from '@mui/icons-material/Public';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, Tooltip, Typography } from '@mui/material';
import { useState } from 'react';
import type { ListVisibility } from '../api';

type VisibilityControlProps = {
  label: string;
  visibility: ListVisibility;
  publicUrl: string;
  privateNotes?: boolean;
  disabled?: boolean;
  onChange: (visibility: ListVisibility) => void;
  onCopied: () => void;
};

export function VisibilityControl({ label, visibility, publicUrl, privateNotes, disabled, onChange, onCopied }: VisibilityControlProps) {
  const [confirming, setConfirming] = useState(false);
  const controlId = label.toLowerCase().replaceAll(' ', '-');
  const choose = (next: ListVisibility) => {
    if (next === visibility) return;
    if (next === 'PUBLIC') setConfirming(true);
    else onChange('PRIVATE');
  };
  const publish = () => {
    setConfirming(false);
    onChange('PUBLIC');
  };
  const copyLink = async () => {
    await navigator.clipboard.writeText(publicUrl);
    onCopied();
  };

  return <>
    <Stack direction="row" spacing={0.5} alignItems="center">
      <FormControl size="small" sx={{ minWidth: 116 }}>
        <InputLabel id={`${controlId}-visibility-label`}>Visibility</InputLabel>
        <Select labelId={`${controlId}-visibility-label`} label="Visibility" value={visibility} disabled={disabled} onChange={(event) => choose(event.target.value as ListVisibility)} startAdornment={visibility === 'PUBLIC' ? <PublicIcon fontSize="small" sx={{ mr: 0.75 }} /> : <LockOutlineIcon fontSize="small" sx={{ mr: 0.75 }} />}>
          <MenuItem value="PRIVATE">Private</MenuItem>
          <MenuItem value="PUBLIC">Public</MenuItem>
        </Select>
      </FormControl>
      {visibility === 'PUBLIC' && <Tooltip title={`Copy ${label} public link`}><IconButton aria-label={`Copy ${label} public link`} size="small" onClick={() => void copyLink()}><ContentCopyIcon fontSize="small" /></IconButton></Tooltip>}
    </Stack>
    <Dialog open={confirming} onClose={() => setConfirming(false)} aria-labelledby={`${controlId}-publish-title`}>
      <DialogTitle id={`${controlId}-publish-title`}>Make {label} public?</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography>Anyone with your public profile address will be able to see the songs{label === 'Top 10' ? ' and their order' : ' and singing statuses'}.</Typography>
          {privateNotes && <Alert severity="info">Your Singing List notes always remain private.</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={() => setConfirming(false)}>Keep private</Button><Button variant="contained" onClick={publish}>Make public</Button></DialogActions>
    </Dialog>
  </>;
}
