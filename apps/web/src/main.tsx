import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { createAppRouter } from './router';
import { theme } from './theme';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
const router = createAppRouter(queryClient);
createRoot(document.getElementById('root')!).render(<StrictMode><ThemeProvider theme={theme}><QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider></StrictMode>);
