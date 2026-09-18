import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { theme } from '../theme';
import { AuthDialog } from './AuthDialog';

afterEach(cleanup);

describe('AuthDialog', () => {
  it.each(['login', 'register'] as const)('submits only username in %s mode', (mode) => {
    const onSubmit = vi.fn();
    render(<ThemeProvider theme={theme}><AuthDialog open initialMode={mode} isPending={false} error={null} onClose={vi.fn()} onSubmit={onSubmit} /></ThemeProvider>);
    fireEvent.change(screen.getByRole('textbox', { name: /^Username/ }), { target: { value: 'listener_1' } });
    expect(screen.queryByLabelText(/^Password/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Display name/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: mode === 'login' ? 'Sign in' : 'Create account' }));
    expect(onSubmit).toHaveBeenCalledWith({ mode, username: 'listener_1' });
  });

  it('retains username after a missing-user error and requires explicit registration', () => {
    const onSubmit = vi.fn();
    const onModeChange = vi.fn();
    render(<ThemeProvider theme={theme}><AuthDialog open initialMode="login" isPending={false} error="This username is not registered. Register to create an account." onClose={vi.fn()} onSubmit={onSubmit} onModeChange={onModeChange} /></ThemeProvider>);
    expect(screen.getByRole('alert')).toHaveTextContent('This username is not registered');
    fireEvent.change(screen.getByLabelText(/^Username/), { target: { value: 'new_listener' } });
    fireEvent.click(screen.getByRole('button', { name: 'Need an account? Register' }));
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    expect(screen.getByLabelText(/^Username/)).toHaveValue('new_listener');
    expect(onModeChange).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(onSubmit).toHaveBeenCalledWith({ mode: 'register', username: 'new_listener' });
    fireEvent.click(screen.getByRole('button', { name: 'Already have an account? Sign in' }));
    expect(screen.getByLabelText(/^Username/)).toHaveValue('new_listener');
  });
});
