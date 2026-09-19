import { ThemeProvider } from '@mui/material/styles';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SingingListPanel } from './SingingListPanel';
import { theme } from '../theme';

afterEach(cleanup);

const entry = {
  id: 'song-1',
  title: '我不想说',
  artist: '杨钰莹',
  releaseYear: 1992,
  status: 'WANT_TO_LEARN' as const,
  note: 'Start with the chorus.',
  reactionCount: 0,
  viewerHasReacted: false
};

it('keeps the singing item compact until editing begins', () => {
  const onSave = vi.fn();
  render(<ThemeProvider theme={theme}><SingingListPanel entries={[entry]} filter="ALL" onFilterChange={() => undefined} onSave={onSave} onRemove={() => undefined} onToggleReaction={() => undefined} isReactionPending={() => false} /></ThemeProvider>);

  expect(screen.queryByLabelText('Note')).not.toBeInTheDocument();
  expect(screen.getByText('Start with the chorus.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Edit 我不想说' }));
  expect(screen.getByLabelText('Note')).toHaveValue('Start with the chorus.');
  fireEvent.click(screen.getAllByRole('button', { name: 'Practicing' })[1]);
  fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Practice the bridge.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(onSave).toHaveBeenCalledWith('song-1', 'PRACTICING', 'Practice the bridge.');
});

it('uses compact status chips to filter the list', () => {
  const onFilterChange = vi.fn();
  render(<ThemeProvider theme={theme}><SingingListPanel entries={[entry]} filter="ALL" onFilterChange={onFilterChange} onSave={() => undefined} onRemove={() => undefined} onToggleReaction={() => undefined} isReactionPending={() => false} /></ThemeProvider>);

  fireEvent.click(screen.getAllByRole('button', { name: 'Want to Learn' })[0]);
  expect(onFilterChange).toHaveBeenCalledWith('WANT_TO_LEARN');
});
