import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import { Link, useRouterState } from '@tanstack/react-router';
import { bottomNavHeight, destinations } from '../navigation';
import { useAppShell } from '../shell/AppShellContext';

export function BottomNav() {
  const { user, openAuth } = useAppShell();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const current = destinations.some((destination) => destination.to === pathname) ? pathname : '/';

  return <Paper component="nav" aria-label="Primary bottom" square elevation={3} sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: (theme) => theme.zIndex.appBar, pb: 'env(safe-area-inset-bottom)' }}>
    <BottomNavigation showLabels value={current} sx={{ height: bottomNavHeight }}>
      {destinations.map((destination) => {
        const Icon = destination.icon;
        // A guarded destination is not a link for an anonymous visitor: following
        // it would hit the beforeLoad guard in routes/personal.tsx, redirect back
        // to '/', and flash a page the visitor never asked for. It is a button
        // that opens the dialog, which is also the honest semantics — it does not
        // navigate.
        const locked = destination.personal && !user;
        const selected = current === destination.to;
        return <BottomNavigationAction
          key={destination.to}
          value={destination.to}
          label={destination.short}
          // The visible label is shortened to fit three destinations at 320px.
          // The accessible name must not be.
          aria-label={destination.full}
          icon={<Icon />}
          {...(locked
            ? { onClick: () => openAuth('login') }
            : { component: Link, to: destination.to, 'aria-current': selected ? 'page' as const : undefined })}
        />;
      })}
    </BottomNavigation>
  </Paper>;
}
