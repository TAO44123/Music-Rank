import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    statusColors: Record<'CAN_SING' | 'REGULARLY_SING' | 'PRACTICING' | 'WANT_TO_LEARN', string>;
  }
  interface PaletteOptions {
    statusColors?: Record<'CAN_SING' | 'REGULARLY_SING' | 'PRACTICING' | 'WANT_TO_LEARN', string>;
  }
}

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#A63D2F', contrastText: '#FFFCF6' },
    secondary: { main: '#8A661F', contrastText: '#25221E' },
    background: { default: '#F6F0E5', paper: '#FFFCF6' },
    text: { primary: '#25221E', secondary: '#665D52' },
    divider: '#D8CCB9',
    statusColors: {
      CAN_SING: '#4E7650',
      REGULARLY_SING: '#A63D2F',
      PRACTICING: '#8A661F',
      WANT_TO_LEARN: '#617082'
    }
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Avenir Next", Avenir, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontFamily: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif', fontWeight: 700, lineHeight: 1.12, letterSpacing: '-0.01em' },
    h2: { fontFamily: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.005em' }
  },
  spacing: 8,
  components: {
    MuiPaper: { styleOverrides: { root: { boxShadow: '0 2px 10px rgba(55, 41, 24, 0.06)' } } },
    MuiButton: { defaultProps: { size: 'small' }, styleOverrides: { root: { textTransform: 'none', fontWeight: 700 } } },
    MuiIconButton: { styleOverrides: { root: { border: '1px solid #D8CCB9' } } }
  }
});
