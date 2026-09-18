import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareInvitation } from './ShareInvitation';

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock('../shell/AppShellContext', () => ({ useAppShell: () => ({ notify }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); notify.mockReset(); });

describe('Invitation sharing', () => {
  it('always opens a link dialog and only copies after pressing Copy', async () => {
    const share = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, clipboard: { writeText } });
    render(<ShareInvitation />);
    fireEvent.click(screen.getByRole('button', { name: 'Share invitation' }));
    expect(screen.getByRole('dialog', { name: 'Invite friends' })).toBeVisible();
    expect(screen.getByText('Copy the link to invite friends to Default Group.')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Invitation link' })).toHaveValue(`${location.origin}/invite/default`);
    expect(share).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', 'Invitation link copied'));
    expect(writeText).toHaveBeenCalledWith(`${location.origin}/invite/default`);
  });

  it('can close and reopen the dialog when browser sharing APIs are absent', async () => {
    vi.stubGlobal('navigator', { share: undefined, clipboard: undefined });
    render(<ShareInvitation />);
    fireEvent.click(screen.getByRole('button', { name: 'Share invitation' }));
    expect(screen.getByRole('dialog', { name: 'Invite friends' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Share invitation' }));
    expect(screen.getByRole('dialog', { name: 'Invite friends' })).toBeVisible();
  });
});
