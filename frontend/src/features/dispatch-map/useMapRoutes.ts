/**
 * useMapRoutes — fetches driving routes from the Mapbox Directions API.
 *
 * Only fetches for dispatched/in_transit orders. Caches by
 * origin+destination key since plants and job sites don't move.
 */

import { useState, useEffect, useRef } from 'react';
import type { Order, Plant } from '@/types/domain';

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN ?? '') as string;

export interface RouteData {
  coordinates: [number, number][];
  distance: number; // meters
  duration: number; // seconds
}

export function useMapRoutes(
  orders: Order[],
  plant: Plant,
) {
  const [routes, setRoutes] = useState<Record<string, RouteData>>({});
  const cacheRef = useRef<Record<string, RouteData>>({});

  // Fetch routes for active orders AND pending orders (needed for dispatch)
  const activeStatuses = new Set(['pending', 'dispatched', 'in_transit', 'pouring', 'returning']);
  const routeOrders = orders.filter(
    o => activeStatuses.has(o.status) &&
      o.jobSiteLatitude != null && o.jobSiteLongitude != null,
  );

  // Stable key for the current set of route-worthy orders
  const routeKey = routeOrders.map(o => o.ticketNumber).sort().join(',');

  useEffect(() => {
    if (!MAPBOX_TOKEN || !plant.latitude || !plant.longitude) return;

    let cancelled = false;

    async function fetchRoutes() {
      const newRoutes: Record<string, RouteData> = {};

      for (const order of routeOrders) {
        const cacheKey = `${plant.longitude},${plant.latitude}->${order.jobSiteLongitude},${order.jobSiteLatitude}`;

        if (cacheRef.current[cacheKey]) {
          newRoutes[order.ticketNumber] = cacheRef.current[cacheKey];
          continue;
        }

        try {
          const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${plant.longitude},${plant.latitude};${order.jobSiteLongitude},${order.jobSiteLatitude}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
          const res = await fetch(url);
          if (!res.ok) continue;
          const data = await res.json();
          const route = data.routes?.[0];
          if (!route) continue;

          const routeData: RouteData = {
            coordinates: route.geometry.coordinates,
            distance: route.distance,
            duration: route.duration,
          };
          cacheRef.current[cacheKey] = routeData;
          newRoutes[order.ticketNumber] = routeData;
        } catch {
          // Silently skip failed routes
        }
      }

      if (!cancelled) {
        // Replace (not merge) so stale routes from other dates are dropped
        setRoutes(newRoutes);
      }
    }

    fetchRoutes();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, plant.plantId]);

  return routes;
}
