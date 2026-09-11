import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { theme } from '../theme';
import { VisibilityControl } from './VisibilityControl';

afterEach(cleanup);

describe('VisibilityControl', () => {
  it('requires confirmation before publishing and explains private notes', () => {
    const onChange = vi.fn();
    render(<ThemeProvider theme={theme}><VisibilityControl label="Singing List" visibility="PRIVATE" publicUrl="http://localhost/u/listener" privateNotes onChange={onChange} onShareComplete={vi.fn()} /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Singing List is private. Make public' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Your Singing List notes always remain private.')).toBeVisible();
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
