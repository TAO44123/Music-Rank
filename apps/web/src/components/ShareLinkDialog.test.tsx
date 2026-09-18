import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareLinkDialog } from './ShareLinkDialog';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const url = 'http://localhost/u/listener';
function mount() {
  const onCopied = vi.fn();
  render(<ShareLinkDialog open title="Share a list" hint="Copy the link to share this list." url={url} linkLabel="List link" onClose={vi.fn()} onCopied={onCopied} />);
  return onCopied;
}
function legacyCopy(result: boolean) {
  const command = vi.fn().mockReturnValue(result);
  Object.defineProperty(document, 'execCommand', { configurable: true, value: command });
  return command;
}
afterEach(() => { Reflect.deleteProperty(document, 'execCommand'); });

describe('ShareLinkDialog copying', () => {
  it('copies only after pressing Copy and reports success after the write completes', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const onCopied = mount();
    expect(writeText).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Link copied.');
    expect(writeText).toHaveBeenCalledWith(url);
    expect(onCopied).toHaveBeenCalledOnce();
  });

  it('selects and copies the displayed link when the HTTP clipboard API is absent', async () => {
    vi.stubGlobal('navigator', { clipboard: undefined });
    const command = legacyCopy(true);
    const onCopied = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    const input = screen.getByRole('textbox', { name: 'List link' }) as HTMLInputElement;
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(url.length);
    expect(command).toHaveBeenCalledWith('copy');
    await waitFor(() => expect(onCopied).toHaveBeenCalledOnce());
  });

  it('uses selection-based copying after clipboard permission is rejected', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new DOMException('Blocked', 'NotAllowedError')) } });
    const command = legacyCopy(true);
    const onCopied = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(command).toHaveBeenCalledWith('copy'));
    expect(onCopied).toHaveBeenCalledOnce();
  });

  it('keeps the link available and explains manual copying when both methods fail', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Blocked')) } });
    legacyCopy(false);
    const onCopied = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByText('Could not copy automatically. Select the link and copy it manually.')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'List link' })).toHaveValue(url);
    expect(onCopied).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
