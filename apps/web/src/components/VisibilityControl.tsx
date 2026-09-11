import LockOutlineIcon from '@mui/icons-material/LockOutline';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import ReplyOutlinedIcon from '@mui/icons-material/ReplyOutlined';
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useState } from 'react';
import type { ListVisibility } from '../api';

type VisibilityControlProps = {
  label: string;
  visibility: ListVisibility;
  publicUrl: string;
  privateNotes?: boolean;
  disabled?: boolean;
  onChange: (visibility: ListVisibility) => void;
  onShareComplete: (method: 'shared' | 'copied') => void;
};

export function VisibilityStatus({ label, visibility }: { label: string; visibility: ListVisibility }) {
  const isPublic = visibility === 'PUBLIC';
  return <Chip aria-label={`${label} visibility: ${isPublic ? 'public' : 'private'}`} label={isPublic ? 'Public' : 'Private'} size="small" variant="outlined" sx={{ height: 22, color: isPublic ? '#4E7650' : 'text.secondary', borderColor: isPublic ? '#A9C5AA' : 'divider', bgcolor: isPublic ? 'rgba(78, 118, 80, 0.08)' : 'background.default', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.03em', '& .MuiChip-label': { px: 1 } }} />;
}

export function VisibilityControl({ label, visibility, publicUrl, privateNotes, disabled, onChange, onShareComplete }: VisibilityControlProps) {
  const [confirming, setConfirming] = useState(false);
  const controlId = label.toLowerCase().replaceAll(' ', '-');
  const toggleVisibility = () => {
    if (visibility === 'PRIVATE') setConfirming(true);
    else onChange('PRIVATE');
  };
  const publish = () => {
    setConfirming(false);
    onChange('PUBLIC');
  };
  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${label} on Music Rank`, url: publicUrl });
        onShareComplete('shared');
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    await navigator.clipboard.writeText(publicUrl);
    onShareComplete('copied');
  };
  const visibilityAction = `${label} is ${visibility === 'PUBLIC' ? 'public. Make private' : 'private. Make public'}`;

  return <>
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title={visibilityAction}>
        <span>
          <IconButton aria-label={visibilityAction} aria-pressed={visibility === 'PUBLIC'} size="small" disabled={disabled} onClick={toggleVisibility} sx={{ width: 36, height: 36, color: visibility === 'PUBLIC' ? '#4E7650' : 'text.secondary', borderColor: visibility === 'PUBLIC' ? '#8FB291' : 'divider', bgcolor: visibility === 'PUBLIC' ? 'rgba(78, 118, 80, 0.10)' : 'background.default', '&:hover': { bgcolor: visibility === 'PUBLIC' ? 'rgba(78, 118, 80, 0.18)' : 'action.hover' } }}>
            {visibility === 'PUBLIC' ? <LockOpenOutlinedIcon fontSize="small" /> : <LockOutlineIcon fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
      {visibility === 'PUBLIC' && <Tooltip title={`Share ${label}`}><IconButton aria-label={`Share ${label}`} size="small" onClick={() => void shareLink()}><ReplyOutlinedIcon fontSize="small" sx={{ transform: 'scaleX(-1)' }} /></IconButton></Tooltip>}
    </Stack>
    <Dialog open={confirming} onClose={() => setConfirming(false)} aria-labelledby={`${controlId}-publish-title`}>
      <DialogTitle id={`${controlId}-publish-title`}>Make {label} public?</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography>Anyone with your public profile address will be able to see the songs{label === 'Top 10' ? ' and their order' : ' and singing statuses'}.</Typography>
          {privateNotes && <Alert severity="info">Your Practice Library notes always remain private.</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={() => setConfirming(false)}>Keep private</Button><Button variant="contained" onClick={publish}>Make public</Button></DialogActions>
    </Dialog>
  </>;
}
