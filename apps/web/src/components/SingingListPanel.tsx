import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Box, Button, Chip, Collapse, IconButton, List, ListItem, Paper, Stack, TextField, Tooltip, Typography, useTheme } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import type { SingingListEntry, SingingStatus } from '../api';
import { singingStatuses, statusLabels } from '../status';
import { ListReactionButton } from './ListReactionButton';

type SingingItemProps = {
  entry: SingingListEntry;
  onSave: (songId: string, status: SingingStatus, note: string) => void;
  onRemove: (songId: string) => void;
  onToggleReaction: (songId: string, viewerHasReacted: boolean) => void;
  isReactionPending: boolean;
};

function SingingItem({ entry, onSave, onRemove, onToggleReaction, isReactionPending }: SingingItemProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [note, setNote] = useState(entry.note ?? '');
  const [status, setStatus] = useState<SingingStatus>(entry.status);
  const statusColor = theme.palette.statusColors[entry.status];

  useEffect(() => {
    setNote(entry.note ?? '');
    setStatus(entry.status);
  }, [entry.note, entry.status]);

  const cancelEditing = () => {
    setNote(entry.note ?? '');
    setStatus(entry.status);
    setIsEditing(false);
  };

  const saveChanges = () => {
    onSave(entry.id, status, note);
    setIsEditing(false);
  };

  return <ListItem divider disableGutters sx={{ display: 'block', py: 1.5 }}>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '4px minmax(0, 1fr) auto', sm: '4px minmax(0, 1fr) auto auto' }, columnGap: { xs: 1.25, sm: 0.4 }, rowGap: 0.75, alignItems: 'center' }}>
      <Box aria-hidden="true" sx={{ width: 4, height: 44, borderRadius: 4, bgcolor: statusColor, gridRow: { xs: '1 / -1', sm: 'auto' }, alignSelf: 'center' }} />
      <Box sx={{ minWidth: 0, ml: { xs: 0, sm: 0.85 } }}>
        <Typography fontWeight={800} lineHeight={1.25}>{entry.title}</Typography>
        <Typography variant="body2" color="text.secondary">{entry.artist}</Typography>
      </Box>
      <ListReactionButton kind="CHEER" songTitle={entry.title} reactionCount={entry.reactionCount} viewerHasReacted={entry.viewerHasReacted} disabled={isReactionPending} onToggle={() => onToggleReaction(entry.id, entry.viewerHasReacted)} />
      <Stack direction="row" spacing={0.4} alignItems="center" sx={{ gridColumn: { xs: '2 / 4', sm: 4 }, gridRow: { xs: entry.note ? 3 : 2, sm: 1 }, justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
        <Chip label={statusLabels[entry.status]} size="small" variant="outlined" sx={{ color: statusColor, borderColor: statusColor, fontWeight: 700 }} />
        <Tooltip title={`Edit ${entry.title}`}>
          <IconButton aria-label={`Edit ${entry.title}`} aria-expanded={isEditing} aria-controls={`singing-editor-${entry.id}`} size="small" color="primary" onClick={() => setIsEditing((value) => !value)} sx={{ border: 0 }}><EditOutlinedIcon fontSize="small" /></IconButton>
        </Tooltip>
        <Tooltip title={`Remove ${entry.title}`}>
          <IconButton aria-label={`Remove ${entry.title} from My Practice Library`} size="small" color="primary" onClick={() => onRemove(entry.id)} sx={{ border: 0 }}><DeleteOutlineIcon fontSize="small" /></IconButton>
        </Tooltip>
      </Stack>
      {entry.note && <Typography variant="body2" color="text.secondary" sx={{ gridColumn: { xs: '2 / 4', sm: 2 }, gridRow: 2, ml: { xs: 0, sm: 0.85 }, fontFamily: theme.typography.h2.fontFamily, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.note}</Typography>}
    </Box>
    <Collapse in={isEditing} unmountOnExit>
      <Box id={`singing-editor-${entry.id}`} sx={{ mt: 1.5, ml: { xs: 0, sm: 2 }, p: { xs: 1.25, sm: 1.75 }, borderLeft: 3, borderColor: theme.palette.statusColors[status], borderRadius: '0 10px 10px 0', bgcolor: '#F6F0E5' }}>
        <Typography variant="subtitle2" fontWeight={800} mb={1.25}>Update {entry.title}</Typography>
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75} mb={1.5} aria-label="Singing status">
          {singingStatuses.map((option) => {
            const optionColor = theme.palette.statusColors[option];
            const selected = status === option;
            return <Chip key={option} label={statusLabels[option]} size="small" clickable onClick={() => setStatus(option)} aria-pressed={selected} variant={selected ? 'filled' : 'outlined'} sx={{ color: selected ? '#FFFCF6' : optionColor, bgcolor: selected ? optionColor : 'transparent', borderColor: optionColor, fontWeight: 700, '&:hover': { bgcolor: selected ? optionColor : '#FFFCF6' } }} />;
          })}
        </Stack>
        <TextField label="Note" variant="standard" multiline minRows={2} value={note} onChange={(event) => setNote(event.target.value)} slotProps={{ htmlInput: { maxLength: 300 } }} helperText={`${note.length}/300`} fullWidth />
        <Stack direction="row" justifyContent="flex-end" spacing={1} mt={1.25}>
          <Button onClick={cancelEditing}>Cancel</Button>
          <Button variant="contained" onClick={saveChanges}>Save changes</Button>
        </Stack>
      </Box>
    </Collapse>
  </ListItem>;
}

type SingingListPanelProps = {
  entries: SingingListEntry[];
  filter: SingingStatus | 'ALL';
  onFilterChange: (filter: SingingStatus | 'ALL') => void;
  onSave: (songId: string, status: SingingStatus, note: string) => void;
  onRemove: (songId: string) => void;
  onToggleReaction: (songId: string, viewerHasReacted: boolean) => void;
  isReactionPending: (songId: string) => boolean;
  headerAction?: ReactNode;
  promptAction?: ReactNode;
  statusLabel?: ReactNode;
};

export function SingingListPanel({ entries, filter, onFilterChange, onSave, onRemove, onToggleReaction, isReactionPending, headerAction, promptAction, statusLabel }: SingingListPanelProps) {
  const theme = useTheme();

  return <Paper component="section" sx={{ p: { xs: 1.75, sm: 2.5 } }} aria-labelledby="singing-list-heading">
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2}>
      <Box>
        <Typography variant="overline" color="secondary.main" fontWeight={800}>Practice library</Typography>
        <Typography id="singing-list-heading" variant="h2" fontSize="1.45rem">My Practice Library</Typography>
        {promptAction && <Box mt={0.5}>{promptAction}</Box>}
        {statusLabel && <Box mt={0.5}>{statusLabel}</Box>}
      </Box>
      <Stack direction="row" alignItems="center" gap={1}><Typography variant="body2" color="text.secondary" fontWeight={700}>{entries.length} {entries.length === 1 ? 'song' : 'songs'}</Typography>{headerAction}</Stack>
    </Stack>
    <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75} mt={2} mb={0.5} aria-label="Filter practice library by status">
      <Chip label="All" size="small" clickable onClick={() => onFilterChange('ALL')} aria-pressed={filter === 'ALL'} color={filter === 'ALL' ? 'primary' : 'default'} variant={filter === 'ALL' ? 'filled' : 'outlined'} sx={{ fontWeight: 700 }} />
      {singingStatuses.map((status) => {
        const statusColor = theme.palette.statusColors[status];
        const selected = filter === status;
        return <Chip key={status} label={statusLabels[status]} size="small" clickable onClick={() => onFilterChange(status)} aria-pressed={selected} variant={selected ? 'filled' : 'outlined'} sx={{ color: selected ? '#FFFCF6' : statusColor, bgcolor: selected ? statusColor : 'transparent', borderColor: statusColor, fontWeight: 700, '&:hover': { bgcolor: selected ? statusColor : '#F2E6D5' } }} />;
      })}
    </Stack>
    {entries.length === 0 ? <Box py={3}><Typography color="text.secondary">No songs in this view. Add one from the ranking.</Typography></Box> : <List disablePadding aria-label="My Practice Library">{entries.map((entry) => <SingingItem key={entry.id} entry={entry} onSave={onSave} onRemove={onRemove} onToggleReaction={onToggleReaction} isReactionPending={isReactionPending(entry.id)} />)}</List>}
  </Paper>;
}
