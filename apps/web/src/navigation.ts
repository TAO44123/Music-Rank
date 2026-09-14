import FormatListNumberedOutlinedIcon from '@mui/icons-material/FormatListNumberedOutlined';
import MicNoneIcon from '@mui/icons-material/MicNone';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import type { SvgIconComponent } from '@mui/icons-material';

export type Destination = {
  to: '/' | '/personal' | '/practice';
  short: string;
  full: string;
  icon: SvgIconComponent;
  /** Requires an authenticated session. `TabNav` hides these from anonymous
      visitors; `BottomNav` shows them and opens the sign-in dialog instead. */
  personal: boolean;
};

// `short` and `full` are the labels DESIGN-002 D5 introduced so all three
// destinations fit at 375px. `icon` is used only by the bottom bar: MicNone is
// already the icon on the ranking row's practice action, so the bar names
// Practice with the icon the visitor has been tapping.
export const destinations: readonly Destination[] = [
  { to: '/', short: 'Ranking', full: 'The Ranking', icon: FormatListNumberedOutlinedIcon, personal: false },
  { to: '/personal', short: 'Personal', full: 'Personal Ranking', icon: StarOutlineIcon, personal: true },
  { to: '/practice', short: 'Practice', full: 'Practice Library', icon: MicNoneIcon, personal: true }
];

// MUI's BottomNavigation height. Defined here because AppShellContext spends it
// in three separate expressions, and a bar whose height disagrees with the space
// reserved for it is the class of bug DESIGN-006 §2.1 traced to a hard-coded
// reserve chasing a layout.
export const bottomNavHeight = 56;
