import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { theme } from '../theme';
import { VisibilityControl } from './VisibilityControl';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('VisibilityControl', () => {
  it.each(['Top 10', 'Practice Library'])('opens a link dialog for %s without using native sharing or copying immediately', async (label) => {
    const share = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, clipboard: { writeText } });
    const onShareComplete = vi.fn();
    render(<ThemeProvider theme={theme}><VisibilityControl label={label} visibility="PUBLIC" publicUrl="http://localhost/u/listener" onChange={vi.fn()} onShareComplete={onShareComplete} /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: `Share ${label}` }));
    expect(screen.getByRole('dialog', { name: `Share ${label}` })).toBeVisible();
    expect(screen.getByText('Copy the link to share this list. Recipients can only see your public lists.')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'List link' })).toHaveValue('http://localhost/u/listener');
    expect(share).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Link copied.');
    expect(onShareComplete).toHaveBeenCalledWith('copied');
  });

  it('requires confirmation before publishing and explains private notes', () => {
    const onChange = vi.fn();
    render(<ThemeProvider theme={theme}><VisibilityControl label="Practice Library" visibility="PRIVATE" publicUrl="http://localhost/u/listener" privateNotes onChange={onChange} onShareComplete={vi.fn()} /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Practice Library is private. Make public' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Your Practice Library notes always remain private.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Make public' }));
    expect(onChange).toHaveBeenCalledWith('PUBLIC');
  });

  it('makes a public list private directly and keeps sharing separate', () => {
    const onChange = vi.fn();
    render(<ThemeProvider theme={theme}><VisibilityControl label="Top 10" visibility="PUBLIC" publicUrl="http://localhost/u/listener" onChange={onChange} onShareComplete={vi.fn()} /></ThemeProvider>);
    expect(screen.getByRole('button', { name: 'Share Top 10' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Top 10 is public. Make private' }));
    expect(onChange).toHaveBeenCalledWith('PRIVATE');
  });
});
