import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useId, useRef, useState } from 'react';

type ShareLinkDialogProps = {
  open: boolean;
  title: string;
  hint: string;
  url: string;
  linkLabel: string;
  onClose: () => void;
  onCopied: () => void;
};

export function ShareLinkDialog({ open, title, hint, url, linkLabel, onClose, onCopied }: ShareLinkDialogProps) {
  const titleId = useId();
  const hintId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const close = () => {
    if (pending) return;
    setCopied(false);
    setFailed(false);
    onClose();
  };
  const copy = async () => {
    setPending(true);
    setCopied(false);
    setFailed(false);
    try {
      let success = false;
      if (typeof navigator.clipboard?.writeText === 'function') {
        try {
          await navigator.clipboard.writeText(url);
          success = true;
        } catch {
          // Try selection-based copying when permission is denied.
        }
      }
      if (!success) {
        input.current?.focus();
        input.current?.select();
        // HTTP pages may lack navigator.clipboard entirely.
        try { success = typeof document.execCommand === 'function' && document.execCommand('copy'); }
        catch { success = false; }
      }
      setCopied(success);
      setFailed(!success);
      if (success) onCopied();
    } finally {
      setPending(false);
    }
  };
  return <Dialog open={open} onClose={close} aria-labelledby={titleId} aria-describedby={hintId} fullWidth maxWidth="sm">
    <DialogTitle id={titleId}>{title}</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <Typography id={hintId}>{hint}</Typography>
      <Stack direction="row" gap={1} alignItems="center">
        <TextField label={linkLabel} value={url} inputRef={input} fullWidth sx={{ minWidth: 0 }} slotProps={{ input: { readOnly: true } }} onFocus={(event) => { if (event.target instanceof HTMLInputElement) event.target.select(); }} />
        <Button variant="contained" startIcon={<ContentCopyOutlinedIcon />} disabled={pending} onClick={() => void copy()} sx={{ flexShrink: 0 }}>{copied ? 'Copied' : 'Copy'}</Button>
      </Stack>
      {copied && <Typography role="status" color="success.main">Link copied.</Typography>}
      {failed && <Alert severity="info">Could not copy automatically. Select the link and copy it manually.</Alert>}
    </Stack></DialogContent>
    <DialogActions><Button onClick={close} disabled={pending}>Done</Button></DialogActions>
  </Dialog>;
}
