import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import { Button } from '@mui/material';
import { useState } from 'react';
import { useAppShell } from '../shell/AppShellContext';
import { ShareLinkDialog } from './ShareLinkDialog';

export function ShareInvitation() {
  const { notify } = useAppShell();
  const [open, setOpen] = useState(false);
  const url = `${window.location.origin}/invite/default`;
  return <>
    <Button variant="outlined" startIcon={<ShareOutlinedIcon />} onClick={() => setOpen(true)}>Share invitation</Button>
    <ShareLinkDialog open={open} onClose={() => setOpen(false)} title="Invite friends" hint="Copy the link to invite friends to Default Group." url={url} linkLabel="Invitation link" onCopied={() => notify('success', 'Invitation link copied')} />
  </>;
}
