import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import type { ExistingSong } from '../api';

type UnlistedSongDialogProps = {
  open: boolean;
  listLabel: string;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (song: { title: string; artist: string }) => void;
};

export function UnlistedSongDialog({ open, listLabel, isPending, error, onClose, onSubmit }: UnlistedSongDialogProps) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');

  useEffect(() => {
    if (open) {
      setTitle('');
      setArtist('');
    }
  }, [open]);

  const canSubmit = title.trim().length > 0 && artist.trim().length > 0 && !isPending;
  return <Dialog open={open} onClose={isPending ? undefined : onClose} aria-labelledby="unlisted-song-title">
    <DialogTitle id="unlisted-song-title">Add a song not listed</DialogTitle>
    <DialogContent>
      <Typography color="text.secondary" mb={2}>Add a shared song to {listLabel}. It will not be added to a public ranking.</Typography>
      <Stack component="form" spacing={2} onSubmit={(event) => { event.preventDefault(); if (canSubmit) onSubmit({ title: title.trim(), artist: artist.trim() }); }}>
        <TextField autoFocus label="Song title" value={title} onChange={(event) => setTitle(event.target.value)} slotProps={{ htmlInput: { maxLength: 160 } }} required fullWidth />
        <TextField label="Artist" value={artist} onChange={(event) => setArtist(event.target.value)} slotProps={{ htmlInput: { maxLength: 160 } }} required fullWidth />
        {error && <Alert severity="error">{error}</Alert>}
        <DialogActions sx={{ px: 0 }}>
          <Button onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={!canSubmit}>{isPending ? 'Adding…' : 'Add song'}</Button>
        </DialogActions>
      </Stack>
    </DialogContent>
  </Dialog>;
}

type ExistingSongConfirmationDialogProps = {
  song: ExistingSong | null;
  listLabel: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ExistingSongConfirmationDialog({ song, listLabel, isPending, onCancel, onConfirm }: ExistingSongConfirmationDialogProps) {
  return <Dialog open={song !== null} onClose={isPending ? undefined : onCancel} aria-labelledby="existing-song-title">
    <DialogTitle id="existing-song-title">Use existing song?</DialogTitle>
    <DialogContent>
      <Typography>This song is already in the shared catalog.</Typography>
      {song && <Typography mt={1.5} fontWeight={700}>{song.title} — {song.artist}</Typography>}
      <Typography color="text.secondary" mt={1.5}>Add it to {listLabel} instead?</Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onCancel} disabled={isPending}>Cancel</Button>
      <Button variant="contained" onClick={onConfirm} disabled={isPending}>{isPending ? 'Adding…' : 'Add existing song'}</Button>
    </DialogActions>
  </Dialog>;
}
