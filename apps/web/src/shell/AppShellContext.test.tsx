import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppShell } from './AppShellContext';

afterEach(cleanup);

function Probe() {
  useAppShell();
  return <p>rendered</p>;
}

describe('useAppShell', () => {
  it('fails loudly when used outside the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrowError('useAppShell must be used inside AppShellProvider');
    expect(screen.queryByText('rendered')).not.toBeInTheDocument();
    consoleError.mockRestore();
  });
});
