import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { theme } from '../theme';
import { VisibilityControl } from './VisibilityControl';

afterEach(cleanup);

describe('VisibilityControl', () => {
  it('requires confirmation before publishing and explains private notes', () => {
    const onChange = vi.fn();
    render(<ThemeProvider theme={theme}><VisibilityControl label="Singing List" visibility="PRIVATE" publicUrl="http://localhost/u/listener" privateNotes onChange={onChange} onCopied={vi.fn()} /></ThemeProvider>);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Visibility' }));
    fireEvent.click(screen.getByRole('option', { name: 'Public' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Your Singing List notes always remain private.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Make public' }));
    expect(onChange).toHaveBeenCalledWith('PUBLIC');
  });
});
