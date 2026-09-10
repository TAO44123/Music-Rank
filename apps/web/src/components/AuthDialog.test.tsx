import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { theme } from '../theme';
import { AuthDialog } from './AuthDialog';

afterEach(cleanup);

describe('AuthDialog', () => {
  it('submits login credentials without a display name', () => {
    const onSubmit = vi.fn();
    render(<ThemeProvider theme={theme}><AuthDialog open initialMode="login" isPending={false} error={null} onClose={vi.fn()} onSubmit={onSubmit} /></ThemeProvider>);
    fireEvent.change(screen.getByRole('textbox', { name: /^Username/ }), { target: { value: 'listener_1' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'correct horse battery staple' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSubmit).toHaveBeenCalledWith({ mode: 'login', username: 'listener_1', displayName: undefined, password: 'correct horse battery staple' });
  });

  it('switches to registration and exposes validation guidance', () => {
    render(<ThemeProvider theme={theme}><AuthDialog open initialMode="login" isPending={false} error="Invalid username or password" onClose={vi.fn()} onSubmit={vi.fn()} /></ThemeProvider>);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password');
    fireEvent.click(screen.getByRole('button', { name: 'Need an account? Register' }));
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: /^Display name/ })).toBeRequired();
    expect(screen.getByText('Use at least 12 characters')).toBeVisible();
  });
});
