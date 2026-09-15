import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ExistingSongConfirmationDialog, UnlistedSongDialog } from './UnlistedSongDialog';

afterEach(cleanup);

it('validates, displays errors, blocks pending submission, and cancels an unlisted-song form', () => {
  const onClose = vi.fn();
  const onSubmit = vi.fn();
  const { rerender } = render(<UnlistedSongDialog open listLabel="My Top 10" isPending={false} error="Could not add this song" onClose={onClose} onSubmit={onSubmit} />);
  expect(screen.getByRole('button', { name: 'Add song' })).toBeDisabled();
  expect(screen.getByText('Could not add this song')).toBeVisible();
  fireEvent.change(screen.getByRole('textbox', { name: 'Song title' }), { target: { value: ' New Song ' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Artist' }), { target: { value: ' New Artist ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add song' }));
  expect(onSubmit).toHaveBeenCalledWith({ title: 'New Song', artist: 'New Artist' });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalledOnce();

  rerender(<UnlistedSongDialog open listLabel="My Top 10" isPending error={null} onClose={onClose} onSubmit={onSubmit} />);
  expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
});

it('cancels an existing-song confirmation without a mutation', () => {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(<ExistingSongConfirmationDialog song={{ id: 'song-1', title: 'Shared Song', artist: 'Shared Artist' }} listLabel="My Practice Library" isPending={false} onCancel={onCancel} onConfirm={onConfirm} />);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledOnce();
  expect(onConfirm).not.toHaveBeenCalled();
});
