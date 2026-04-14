import { useRef, useState, useEffect, useCallback } from 'react';
import type { Order, Plant, Truck } from '@/types/domain';
import type { RouteData } from '@/features/dispatch-map/useMapRoutes';
import type { OrderStatus } from '@/theme/statusColors';
import type { SimulationEntry, SimulationConfig, SimulationOutput } from './types';
import { DEFAULT_CONFIG } from './config';
import {
  computeSegmentDistances,
  interpolateAlongRoute,
  sliceAndReverse,
  reverseCoordinates,
} from './routeGeometry';

interface EngineInputs {
  orders: Order[];
  trucks: Truck[];
  routes: Record<string, RouteData>;
  plant: Plant;
  updateOrderStatus: (ticketNumber: string, status: OrderStatus) => Promise<void>;
  config?: Partial<SimulationConfig>;
}

export function useSimulationEngine({
  orders,
  trucks: _trucks,
  routes,
  plant,
  updateOrderStatus,
  config: configOverrides,
}: EngineInputs) {
  const cfg: SimulationConfig = { ...DEFAULT_CONFIG, ...configOverrides };

  const entriesRef = useRef<Map<string, SimulationEntry>>(new Map());
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const routesRef = useRef(routes);
  routesRef.current = routes;
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const updateStatusRef = useRef(updateOrderStatus);
  updateStatusRef.current = updateOrderStatus;
  const plantRef = useRef(plant);
  plantRef.current = plant;

  const [output, setOutput] = useState<SimulationOutput>({
    truckPositions: new Map(),
    truckStatuses: new Map(),
    activeEntries: [],
  });

  const advancePhase = useCallback(async (entry: SimulationEntry) => {
    if (entry.transitioning) return;
    entry.transitioning = true;

    const now = Date.now();
    const c = cfgRef.current;

    try {
      switch (entry.phase) {
        case 'loading': {
          await updateStatusRef.current(entry.ticketNumber, 'in_transit');
          entry.phase = 'in_transit_outbound';
          entry.phaseStartedAt = now;
          entry.phaseDuration = entry.routeDurationMs / c.speedMultiplier;
          break;
        }
        case 'in_transit_outbound': {
          await updateStatusRef.current(entry.ticketNumber, 'pouring');
          entry.phase = 'pouring';
          entry.phaseStartedAt = now;
          const pourMs = Math.max(
            c.minPourDurationMs,
            entry.volume * c.pourRateMsPerYard,
          );
          entry.phaseDuration = pourMs / c.speedMultiplier;
          break;
        }
        case 'pouring': {
          await updateStatusRef.current(entry.ticketNumber, 'returning');
          // Reverse the route for the return trip
          const reversed = reverseCoordinates(entry.routeCoordinates);
          const { cumulative, total } = computeSegmentDistances(reversed);
          entry.routeCoordinates = reversed;
          entry.cumulativeDistances = cumulative;
          entry.totalRouteDistance = total;
          entry.phase = 'in_transit_return';
          entry.phaseStartedAt = now;
          entry.phaseDuration = entry.routeDurationMs / c.speedMultiplier;
          break;
        }
        case 'in_transit_return': {
          await updateStatusRef.current(entry.ticketNumber, 'complete');
          entry.phase = 'complete';
          entriesRef.current.delete(entry.ticketNumber);
          break;
        }
      }
    } catch {
      // API call failed -- retry next tick
    } finally {
      entry.transitioning = false;
    }
  }, []);

  // Handle cancellations
  const handleCancellation = useCallback((entry: SimulationEntry) => {
    const now = Date.now();
    const c = cfgRef.current;

    if (entry.phase === 'loading') {
      // Still at plant, just remove
      entriesRef.current.delete(entry.ticketNumber);
      return;
    }

    if (entry.phase === 'pouring') {
      // At job site, start return trip
      const routeData = routesRef.current[entry.ticketNumber];
      if (routeData) {
        const reversed = reverseCoordinates(routeData.coordinates);
        const { cumulative, total } = computeSegmentDistances(reversed);
        entry.routeCoordinates = reversed;
        entry.cumulativeDistances = cumulative;
        entry.totalRouteDistance = total;
        entry.phase = 'in_transit_return';
        entry.phaseStartedAt = now;
        entry.phaseDuration = (routeData.duration * 1000) / c.speedMultiplier;
        entry.transitioning = false;
      } else {
        entriesRef.current.delete(entry.ticketNumber);
      }
      return;
    }

    if (entry.phase === 'in_transit_outbound') {
      // Mid-trip: compute current progress, slice remaining route, reverse it
      const elapsed = now - entry.phaseStartedAt;
      const fraction = Math.min(elapsed / entry.phaseDuration, 1);
      const result = sliceAndReverse(
        entry.routeCoordinates,
        entry.cumulativeDistances,
        entry.totalRouteDistance,
        fraction,
      );
      entry.routeCoordinates = result.coords;
      entry.cumulativeDistances = result.cumulative;
      entry.totalRouteDistance = result.total;
      entry.phase = 'in_transit_return';
      entry.phaseStartedAt = now;
      // Duration proportional to remaining distance
      const originalRouteDist = routesRef.current[entry.ticketNumber]?.distance ?? entry.totalRouteDistance;
      const remainingFraction = originalRouteDist > 0 ? result.total / originalRouteDist : fraction;
      entry.phaseDuration = (entry.routeDurationMs * remainingFraction) / c.speedMultiplier;
      entry.transitioning = false;
      return;
    }

    // in_transit_return or complete: already heading back or done
    if (entry.phase === 'complete') {
      entriesRef.current.delete(entry.ticketNumber);
    }
  }, []);

  // Main tick loop
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const entries = entriesRef.current;
      const currentOrders = ordersRef.current;
      const currentRoutes = routesRef.current;
      const c = cfgRef.current;
      const p = plantRef.current;

      // Detect active orders that need simulation entries
      const activeStatuses = new Set(['dispatched', 'in_transit', 'pouring', 'returning']);
      for (const order of currentOrders) {
        if (activeStatuses.has(order.status) && order.assignedTruckId && !entries.has(order.ticketNumber)) {
          const route = currentRoutes[order.ticketNumber];
          if (!route) continue; // Route not loaded yet, retry next tick

          const { cumulative, total } = computeSegmentDistances(route.coordinates);
          const routeDurationMs = route.duration * 1000;
          const jobSitePosition = {
            lng: order.jobSiteLongitude!,
            lat: order.jobSiteLatitude!,
          };

          // Determine phase and timing based on current order status
          let phase: import('./types').SimulationPhase;
          let phaseStartedAt: number;
          let phaseDuration: number;
          let coords = [...route.coordinates];
          let cumDist = cumulative;
          let totalDist = total;
          let currentPosition: { lng: number; lat: number };

          switch (order.status) {
            case 'dispatched':
              phase = 'loading';
              phaseDuration = c.loadingDurationMs / c.speedMultiplier;
              phaseStartedAt = now;
              currentPosition = { lng: p.longitude, lat: p.latitude };
              break;
            case 'in_transit':
              phase = 'in_transit_outbound';
              phaseDuration = routeDurationMs / c.speedMultiplier;
              // Start partway through (random 10-40%) so trucks aren't all at the start
              phaseStartedAt = now - phaseDuration * (0.1 + Math.random() * 0.3);
              currentPosition = { lng: p.longitude, lat: p.latitude };
              break;
            case 'pouring': {
              phase = 'pouring';
              const pourMs = Math.max(c.minPourDurationMs, order.volume * c.pourRateMsPerYard);
              phaseDuration = pourMs / c.speedMultiplier;
              // Start partway through pouring
              phaseStartedAt = now - phaseDuration * (Math.random() * 0.3);
              currentPosition = jobSitePosition;
              break;
            }
            case 'returning': {
              phase = 'in_transit_return';
              const reversed = reverseCoordinates(route.coordinates);
              const revResult = computeSegmentDistances(reversed);
              coords = reversed;
              cumDist = revResult.cumulative;
              totalDist = revResult.total;
              phaseDuration = routeDurationMs / c.speedMultiplier;
              // Start partway through return
              phaseStartedAt = now - phaseDuration * (0.1 + Math.random() * 0.3);
              currentPosition = jobSitePosition;
              break;
            }
            default:
              continue;
          }

          entries.set(order.ticketNumber, {
            ticketNumber: order.ticketNumber,
            truckId: order.assignedTruckId,
            phase,
            phaseStartedAt,
            phaseDuration,
            routeCoordinates: coords,
            cumulativeDistances: cumDist,
            totalRouteDistance: totalDist,
            routeDurationMs,
            currentPosition,
            jobSitePosition,
            volume: order.volume,
            transitioning: false,
          });
        }

        // Detect cancellations
        if (order.status === 'cancelled' && entries.has(order.ticketNumber)) {
          handleCancellation(entries.get(order.ticketNumber)!);
        }
      }

      // Also detect orders that exist in entries but are now cancelled in the orders array
      for (const [ticket, entry] of entries) {
        const order = currentOrders.find(o => o.ticketNumber === ticket);
        if (order?.status === 'cancelled' && entry.phase !== 'in_transit_return') {
          handleCancellation(entry);
        }
      }

      // Update each active entry
      const newPositions = new Map<string, { lng: number; lat: number }>();
      const newStatuses = new Map<string, string>();

      for (const [, entry] of entries) {
        if (entry.transitioning) {
          // Still waiting for API, keep last position
          newPositions.set(entry.truckId, entry.currentPosition);
          newStatuses.set(entry.truckId, mapPhaseToTruckStatus(entry.phase));
          continue;
        }

        const elapsed = now - entry.phaseStartedAt;
        const fraction = entry.phaseDuration > 0 ? elapsed / entry.phaseDuration : 1;

        if (fraction >= 1) {
          // Phase complete, advance
          advancePhase(entry);
          // Still compute position for this tick
          newPositions.set(entry.truckId, entry.currentPosition);
          newStatuses.set(entry.truckId, mapPhaseToTruckStatus(entry.phase));
          continue;
        }

        // Compute position based on current phase
        let pos: { lng: number; lat: number };
        switch (entry.phase) {
          case 'loading':
            pos = { lng: p.longitude, lat: p.latitude };
            break;
          case 'in_transit_outbound':
          case 'in_transit_return':
            pos = interpolateAlongRoute(
              entry.routeCoordinates,
              entry.cumulativeDistances,
              entry.totalRouteDistance,
              fraction,
            );
            break;
          case 'pouring':
            pos = entry.jobSitePosition;
            break;
          default:
            pos = { lng: p.longitude, lat: p.latitude };
        }

        entry.currentPosition = pos;
        newPositions.set(entry.truckId, pos);
        newStatuses.set(entry.truckId, mapPhaseToTruckStatus(entry.phase));
      }

      setOutput({
        truckPositions: newPositions,
        truckStatuses: newStatuses,
        activeEntries: Array.from(entries.values()),
      });
    }, cfg.tickIntervalMs);

    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.tickIntervalMs]);

  return output;
}

function mapPhaseToTruckStatus(phase: string): string {
  switch (phase) {
    case 'loading': return 'loading';
    case 'in_transit_outbound': return 'in_transit';
    case 'pouring': return 'pouring';
    case 'in_transit_return': return 'returning';
    default: return 'available';
  }
}
