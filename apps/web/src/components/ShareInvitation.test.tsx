import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareInvitation } from './ShareInvitation';

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock('../shell/AppShellContext', () => ({ useAppShell: () => ({ notify }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); notify.mockReset(); });

describe('Invitation sharing', () => {
  it('provides a selectable link when both browser APIs are absent', async () => {
    vi.stubGlobal('navigator', { share: undefined, clipboard: undefined });
    render(<ShareInvitation />);
    fireEvent.click(screen.getByRole('button', { name: 'Share invitation' }));
    expect(await screen.findByRole('dialog', { name: 'Copy invitation link' })).toBeVisible();
    expect(screen.getByLabelText('Invitation link')).toHaveValue(`${location.origin}/invite/default`);
  });

  it('falls back to manual copy when clipboard permission is rejected', async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException('Blocked', 'NotAllowedError'));
    vi.stubGlobal('navigator', { share: undefined, clipboard: { writeText } });
    render(<ShareInvitation />);
    fireEvent.click(screen.getByRole('button', { name: 'Share invitation' }));
    expect(await screen.findByRole('dialog', { name: 'Copy invitation link' })).toBeVisible();
    expect(notify).not.toHaveBeenCalledWith('success', 'Invitation link copied');
  });

  it('copies when native sharing fails and clipboard is available', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('Blocked', 'NotAllowedError'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, clipboard: { writeText } });
    render(<ShareInvitation />);
    fireEvent.click(screen.getByRole('button', { name: 'Share invitation' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', 'Invitation link copied'));
    expect(writeText).toHaveBeenCalledWith(`${location.origin}/invite/default`);
  });

  it('does not copy or open a fallback when the user cancels native sharing', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { share, clipboard: { writeText } });
    render(<ShareInvitation />);
    fireEvent.click(screen.getByRole('button', { name: 'Share invitation' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Share invitation' })).not.toBeDisabled());
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
