import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import { Box, Button, Divider, Menu, MenuItem } from '@mui/material';
import { useState, type MouseEvent } from 'react';
import type { AuthUser } from '../api';

export function AccountActions({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return <>
    {/* A username is arbitrarily long and unbreakable. Without a cap and an
        ellipsis it pushes the whole top bar past a phone viewport, which scrolls
        every page sideways because the bar is on all of them. */}
    <Button startIcon={<AccountCircleOutlinedIcon />} onClick={(event: MouseEvent<HTMLButtonElement>) => setAnchor(event.currentTarget)} aria-controls={anchor ? 'account-menu' : undefined} aria-haspopup="true" aria-expanded={anchor ? 'true' : undefined} sx={{ minWidth: 0, maxWidth: { xs: 150, sm: 320 }, '& .MuiButton-startIcon': { flexShrink: 0 } }}>
      <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{user.username}</Box>
    </Button>
    <Menu id="account-menu" anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
      <MenuItem component="a" href={`/u/${user.username}`}>View public profile</MenuItem>
      <Divider />
      <MenuItem onClick={() => { setAnchor(null); onLogout(); }}><LogoutIcon fontSize="small" sx={{ mr: 1 }} />Sign out</MenuItem>
    </Menu>
  </>;
}
