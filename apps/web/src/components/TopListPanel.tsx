import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Box, IconButton, List, ListItem, ListItemText, Paper, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import type { TopListEntry } from '../api';

type SortableItemProps = { entry: TopListEntry; index: number; count: number; onMove: (from: number, to: number) => void; onRemove: (songId: string) => void };

function SortableItem({ entry, index, count, onMove, onRemove }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  // The three trailing controls need about 130px. Below `sm` that leaves under
  // 100px for the title, so they move to a second line and the text gets the
  // full width. The drag handle stays beside the title at every width.
  return <ListItem ref={setNodeRef} divider disableGutters sx={{ display: 'block', px: 0, py: 1, opacity: isDragging ? 0.6 : 1, transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition }}>
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: { xs: 0.25, sm: 0 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
        <Typography component="span" color="primary.main" fontWeight={800} sx={{ width: 28, flexShrink: 0 }}>{entry.position}</Typography>
        <IconButton aria-label={`Drag ${entry.title}`} {...attributes} {...listeners} size="small" sx={{ mr: 0.75, flexShrink: 0, cursor: 'grab', border: 0, '&:hover': { bgcolor: 'action.hover' } }}><DragIndicatorIcon fontSize="small" /></IconButton>
        <ListItemText primary={entry.title} secondary={entry.artist} primaryTypographyProps={{ fontWeight: 700 }} sx={{ my: 0, minWidth: 0 }} />
      </Box>
      <Stack direction="row" spacing={0.35} sx={{ flexShrink: 0, pl: { xs: '28px', sm: 0 }, justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
        <IconButton aria-label={`Move ${entry.title} up`} disabled={index === 0} onClick={() => onMove(index, index - 1)}><KeyboardArrowUpIcon /></IconButton>
        <IconButton aria-label={`Move ${entry.title} down`} disabled={index === count - 1} onClick={() => onMove(index, index + 1)}><KeyboardArrowDownIcon /></IconButton>
        <IconButton aria-label={`Remove ${entry.title} from My Top 10`} color="primary" onClick={() => onRemove(entry.id)}><RemoveCircleOutlineIcon /></IconButton>
      </Stack>
    </Box>
  </ListItem>;
}

export function TopListPanel({ entries, onReorder, onRemove, headerAction, statusLabel }: { entries: TopListEntry[]; onReorder: (ids: string[]) => void; onRemove: (songId: string) => void; headerAction?: ReactNode; statusLabel?: ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = entries.findIndex((entry) => entry.id === active.id);
    const newIndex = entries.findIndex((entry) => entry.id === over.id);
    onReorder(arrayMove(entries, oldIndex, newIndex).map((entry) => entry.id));
  };
  const move = (from: number, to: number) => onReorder(arrayMove(entries, from, to).map((entry) => entry.id));
  return <Paper component="section" sx={{ p: { xs: 1.75, sm: 2.5 } }} aria-labelledby="top-list-heading">
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1.5}><Box><Typography variant="overline" color="secondary.main" fontWeight={800}>Personal ranking</Typography><Typography id="top-list-heading" variant="h2" fontSize="1.45rem">My Top 10</Typography>{statusLabel && <Box mt={0.75}>{statusLabel}</Box>}</Box><Stack direction="row" alignItems="center" gap={1}><Typography color="text.secondary" fontWeight={700}>{entries.length}/10</Typography>{headerAction}</Stack></Stack>
    {entries.length === 0 ? <Typography color="text.secondary" py={3}>Add songs from the ranking to start your list.</Typography> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><SortableContext items={entries.map((entry) => entry.id)} strategy={verticalListSortingStrategy}><List disablePadding aria-label="My Top 10">{entries.map((entry, index) => <SortableItem key={entry.id} entry={entry} index={index} count={entries.length} onMove={move} onRemove={onRemove} />)}</List></SortableContext></DndContext>}
  </Paper>;
}
