import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Box, IconButton, List, ListItem, ListItemText, Paper, Stack, Typography } from '@mui/material';
import type { TopListEntry } from '../api';

type SortableItemProps = { entry: TopListEntry; index: number; count: number; onMove: (from: number, to: number) => void; onRemove: (songId: string) => void };

function SortableItem({ entry, index, count, onMove, onRemove }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  return <ListItem ref={setNodeRef} divider sx={{ px: 0, py: 1, opacity: isDragging ? 0.6 : 1, transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition }}>
    <Typography component="span" color="primary.main" fontWeight={800} sx={{ width: 28 }}>{entry.position}</Typography>
    <IconButton aria-label={`Drag ${entry.title}`} {...attributes} {...listeners} size="small" sx={{ mr: 0.75, cursor: 'grab', border: 0, '&:hover': { bgcolor: 'action.hover' } }}><DragIndicatorIcon fontSize="small" /></IconButton>
    <ListItemText primary={entry.title} secondary={entry.artist} primaryTypographyProps={{ fontWeight: 700 }} />
    <Stack direction="row" spacing={0.35}>
      <IconButton aria-label={`Move ${entry.title} up`} disabled={index === 0} onClick={() => onMove(index, index - 1)}><KeyboardArrowUpIcon /></IconButton>
      <IconButton aria-label={`Move ${entry.title} down`} disabled={index === count - 1} onClick={() => onMove(index, index + 1)}><KeyboardArrowDownIcon /></IconButton>
      <IconButton aria-label={`Remove ${entry.title} from My Top 10`} color="primary" onClick={() => onRemove(entry.id)}><RemoveCircleOutlineIcon /></IconButton>
    </Stack>
  </ListItem>;
}

export function TopListPanel({ entries, onReorder, onRemove }: { entries: TopListEntry[]; onReorder: (ids: string[]) => void; onRemove: (songId: string) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = entries.findIndex((entry) => entry.id === active.id);
    const newIndex = entries.findIndex((entry) => entry.id === over.id);
    onReorder(arrayMove(entries, oldIndex, newIndex).map((entry) => entry.id));
  };
  const move = (from: number, to: number) => onReorder(arrayMove(entries, from, to).map((entry) => entry.id));
  return <Paper component="section" sx={{ p: 2.5 }} aria-labelledby="top-list-heading">
    <Stack direction="row" justifyContent="space-between" alignItems="baseline"><Box><Typography variant="overline" color="secondary.main" fontWeight={800}>Personal ranking</Typography><Typography id="top-list-heading" variant="h2" fontSize="1.45rem">My Top 10</Typography></Box><Typography color="text.secondary" fontWeight={700}>{entries.length}/10</Typography></Stack>
    {entries.length === 0 ? <Typography color="text.secondary" py={3}>Add songs from the ranking to start your list.</Typography> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><SortableContext items={entries.map((entry) => entry.id)} strategy={verticalListSortingStrategy}><List disablePadding aria-label="My Top 10">{entries.map((entry, index) => <SortableItem key={entry.id} entry={entry} index={index} count={entries.length} onMove={move} onRemove={onRemove} />)}</List></SortableContext></DndContext>}
  </Paper>;
}
