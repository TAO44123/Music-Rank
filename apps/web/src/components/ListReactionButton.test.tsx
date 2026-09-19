import { ThemeProvider } from '@mui/material/styles';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { theme } from '../theme';
import { ListReactionButton } from './ListReactionButton';

afterEach(cleanup);

it('shows an icon-only zero Like and exposes its full accessible state', () => {
  const onToggle = vi.fn();
  render(<ThemeProvider theme={theme}><ListReactionButton kind="LIKE" songTitle="大海" reactionCount={0} viewerHasReacted={false} onToggle={onToggle} /></ThemeProvider>);

  const button = screen.getByRole('button', { name: 'Like for 大海. 0 likes.' });
  expect(button).toHaveAttribute('aria-pressed', 'false');
  expect(button.parentElement).toHaveStyle({ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' });
  expect(screen.queryByText('0')).not.toBeInTheDocument();
  fireEvent.click(button);
  expect(onToggle).toHaveBeenCalledOnce();
});

it('uses the custom outlined and filled party poppers for Cheer', () => {
  const view = render(<ThemeProvider theme={theme}><ListReactionButton kind="CHEER" songTitle="后来" reactionCount={0} viewerHasReacted={false} onToggle={() => undefined} /></ThemeProvider>);

  const addButton = screen.getByRole('button', { name: 'Cheer for 后来. 0 cheers.' });
  expect(addButton.querySelector('svg')).toHaveAttribute('viewBox', '140 145 520 520');
  expect(addButton.querySelectorAll('path')).toHaveLength(11);

  view.rerender(<ThemeProvider theme={theme}><ListReactionButton kind="CHEER" songTitle="后来" reactionCount={3} viewerHasReacted onToggle={() => undefined} /></ThemeProvider>);

  const button = screen.getByRole('button', { name: 'Remove cheer for 后来. 3 cheers.' });
  expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(button.querySelector('svg')).toHaveAttribute('viewBox', '140 145 520 520');
  expect(button.querySelectorAll('path')).toHaveLength(9);
  expect(button).toHaveTextContent('3');
});
