import { useCallback, useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'search' }
  | { name: 'trip'; tripId: string }
  | { name: 'engineering' };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  const trip = path.match(/^\/trip\/([a-z0-9-]+)$/);
  if (trip?.[1]) return { name: 'trip', tripId: trip[1] };
  if (path === '/search') return { name: 'search' };
  if (path === '/engineering') return { name: 'engineering' };
  return { name: 'home' };
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'trip':
      return `#/trip/${route.tripId}`;
    case 'search':
      return '#/search';
    case 'engineering':
      return '#/engineering';
    default:
      return '#/';
  }
}

/** Tiny hash router — enough for a prototype, works on any static host. */
export function useHashRoute() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    const hash = routeToHash(next);
    if (window.location.hash !== hash) window.location.hash = hash;
    else setRoute(next);
  }, []);

  return { route, navigate };
}
