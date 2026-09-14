import { createRoute, redirect } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';
import { rankingSearchSchema } from './rankingSearch';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: rankingSearchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({
      to: '/rankings/$decade/$region',
      params: { decade: '90s', region: 'mainland' },
      search
    });
  }
});
