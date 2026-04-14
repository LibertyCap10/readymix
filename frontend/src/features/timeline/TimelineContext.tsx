/**
 * TimelineContext — Server-driven replacement for SimulationContext.
 *
 * Instead of running a simulation tick loop that generates ephemeral state,
 * this context derives truck positions, phases, and ETAs from the order's
 * stored `timeline` and `routeData` fields. On page refresh, state is
 * immediately reconstructed from API data + current wall clock.
 *
 * Exposes the SAME API as the old SimulationContext so MapView/popups
 * require zero changes.
 */

import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import type { Order, Plant } from '@/types/domain';
import type { RouteData } from '@/features/dispatch-map/useMapRoutes';
import {
  computeSegmentDistances,
  interpolateAlongRoute,
} from '@/features/simulation/routeGeometry';

// ─── Types ───────────────────────────────────────────────────────────────

export type TimelinePhase =
  | 'loading'
  | 'in_transit_outbound'
  | 'pouring'
  | 'in_transit_return'
  | 'complete';

export interface TimelineEntry {
  ticketNumber: string;
  truckId: string;
  phase: TimelinePhase;
  phaseStartMs: number;       // epoch ms when current phase started
  phaseEndMs: number;         // epoch ms when current phase ends
  routeCoordinates: [number, number][];
  cumulativeDistances: number[];
  totalRouteDistance: number;
  currentPosition: { lng: number; lat: number };
  jobSitePosition: { lng: number; lat: number };
  volume: number;
}

interface TimelineContextValue {
  getTruckPosition: (truckId: string) => { lng: number; lat: number } | null;
  getTruckStatus: (truckId: string) => string | null;
  getEntryByTruck: (truckId: string) => TimelineEntry | null;
  getEntryByTicket: (ticketNumber: string) => TimelineEntry | null;
  getEtaSeconds: (entry: TimelineEntry) => number;
  activeDispatches: TimelineEntry[];
}

const TimelineCtx = createContext<TimelineContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────

interface ProviderProps {
  orders: Order[];
  plant: Plant;
  routes: Record<string, RouteData>;
  isToday?: boolean;
  children: ReactNode;
}

export function TimelineProvider({ orders, plant, routes, isToday = true, children }: ProviderProps) {
  const [tick, setTick] = useState(0);

  // 1-second tick for smooth ETA countdowns and position updates (today only)
  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [isToday]);

  const entries = useMemo(() => {
    void tick; // react to tick changes

    // Non-today dates: no timeline simulation (past = all complete, future = not started)
    if (!isToday) return [];

    const now = Date.now();
    const result: TimelineEntry[] = [];

    for (const order of orders) {
      if (!order.timeline || !order.assignedTruckId) continue;
      if (['complete', 'pending', 'scheduled'].includes(order.status)) continue;

      // Handle cancelled orders that have a truck returning
      if (order.status === 'cancelled') {
        if (!order.cancellation?.estimatedReturnAt) continue;
        if (order.cancellation.truckReturned) continue;

        const cancelledAtMs = new Date(order.cancellation.cancelledAt).getTime();
        const returnAtMs = new Date(order.cancellation.estimatedReturnAt).getTime();

        if (now >= returnAtMs) continue; // already returned

        // Compute return position
        const routeCoords = order.routeData?.coordinates ?? [];
        const reversed = [...routeCoords].reverse() as [number, number][];
        const { cumulative, total } = computeSegmentDistances(reversed);
        const fraction = Math.min((now - cancelledAtMs) / (returnAtMs - cancelledAtMs), 1);
        const pos = total > 0
          ? interpolateAlongRoute(reversed, cumulative, total, fraction)
          : { lng: plant.longitude, lat: plant.latitude };

        result.push({
          ticketNumber: order.ticketNumber,
          truckId: order.assignedTruckId,
          phase: 'in_transit_return',
          phaseStartMs: cancelledAtMs,
          phaseEndMs: returnAtMs,
          routeCoordinates: reversed,
          cumulativeDistances: cumulative,
          totalRouteDistance: total,
          currentPosition: pos,
          jobSitePosition: { lng: order.jobSiteLongitude!, lat: order.jobSiteLatitude! },
          volume: order.volume,
        });
        continue;
      }

      const tl = order.timeline;
      const tlMs = {
        departure: new Date(tl.scheduledDepartureAt).getTime(),
        loadingComplete: new Date(tl.loadingCompletesAt).getTime(),
        arrival: new Date(tl.transitArrivalAt).getTime(),
        pourComplete: new Date(tl.pourCompletesAt).getTime(),
        returnDepart: new Date(tl.returnDepartureAt).getTime(),
        returnArrival: new Date(tl.returnArrivalAt).getTime(),
      };

      // Determine current phase from timeline timestamps
      let phase: TimelinePhase;
      let phaseStartMs: number;
      let phaseEndMs: number;

      if (now < tlMs.loadingComplete) {
        phase = 'loading';
        phaseStartMs = tlMs.departure;
        phaseEndMs = tlMs.loadingComplete;
      } else if (now < tlMs.arrival) {
        phase = 'in_transit_outbound';
        phaseStartMs = tlMs.loadingComplete;
        phaseEndMs = tlMs.arrival;
      } else if (now < tlMs.pourComplete) {
        phase = 'pouring';
        phaseStartMs = tlMs.arrival;
        phaseEndMs = tlMs.pourComplete;
      } else if (now < tlMs.returnArrival) {
        phase = 'in_transit_return';
        phaseStartMs = tlMs.returnDepart;
        phaseEndMs = tlMs.returnArrival;
      } else {
        phase = 'complete';
        phaseStartMs = tlMs.returnArrival;
        phaseEndMs = tlMs.returnArrival;
      }

      if (phase === 'complete') continue;

      // Get route geometry (prefer Mapbox-fetched routes with full road detail,
      // fall back to stored routeData which may have simplified coordinates)
      const routeCoords: [number, number][] =
        (routes[order.ticketNumber]?.coordinates ?? order.routeData?.coordinates ?? []) as [number, number][];

      // Compute position
      let coords = routeCoords;
      if (phase === 'in_transit_return') {
        coords = [...routeCoords].reverse() as [number, number][];
      }
      const { cumulative, total } = computeSegmentDistances(coords);

      let pos: { lng: number; lat: number };
      if (phase === 'loading') {
        pos = { lng: plant.longitude, lat: plant.latitude };
      } else if (phase === 'in_transit_outbound' || phase === 'in_transit_return') {
        const fraction = phaseEndMs > phaseStartMs
          ? Math.min((now - phaseStartMs) / (phaseEndMs - phaseStartMs), 1)
          : 0;
        pos = total > 0
          ? interpolateAlongRoute(coords, cumulative, total, fraction)
          : { lng: plant.longitude, lat: plant.latitude };
      } else {
        // pouring — at job site
        pos = { lng: order.jobSiteLongitude!, lat: order.jobSiteLatitude! };
      }

      result.push({
        ticketNumber: order.ticketNumber,
        truckId: order.assignedTruckId,
        phase,
        phaseStartMs,
        phaseEndMs,
        routeCoordinates: coords,
        cumulativeDistances: cumulative,
        totalRouteDistance: total,
        currentPosition: pos,
        jobSitePosition: { lng: order.jobSiteLongitude!, lat: order.jobSiteLatitude! },
        volume: order.volume,
      });
    }

    return result;
  }, [orders, plant, routes, tick, isToday]);

  const value = useMemo<TimelineContextValue>(() => {
    const byTruck = new Map<string, TimelineEntry>();
    const byTicket = new Map<string, TimelineEntry>();
    for (const e of entries) {
      byTruck.set(e.truckId, e);
      byTicket.set(e.ticketNumber, e);
    }

    return {
      getTruckPosition: (truckId) => byTruck.get(truckId)?.currentPosition ?? null,
      getTruckStatus: (truckId) => {
        const e = byTruck.get(truckId);
        if (!e) return null;
        return mapPhaseToStatus(e.phase);
      },
      getEntryByTruck: (truckId) => byTruck.get(truckId) ?? null,
      getEntryByTicket: (ticketNumber) => byTicket.get(ticketNumber) ?? null,
      getEtaSeconds: (entry) => {
        const remaining = entry.phaseEndMs - Date.now();
        return Math.max(0, Math.round(remaining / 1000));
      },
      activeDispatches: entries,
    };
  }, [entries]);

  return (
    <TimelineCtx.Provider value={value}>
      {children}
    </TimelineCtx.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────

export function useTimeline() {
  const ctx = useContext(TimelineCtx);
  if (!ctx) throw new Error('useTimeline must be used inside TimelineProvider');
  return ctx;
}

// ─── Helpers (same API as SimulationContext exports) ─────────────────────

function mapPhaseToStatus(phase: TimelinePhase): string {
  switch (phase) {
    case 'loading': return 'loading';
    case 'in_transit_outbound': return 'in_transit';
    case 'pouring': return 'pouring';
    case 'in_transit_return': return 'returning';
    default: return 'available';
  }
}

export function formatEta(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function phaseLabel(phase: string): string {
  switch (phase) {
    case 'loading': return 'Loading at plant';
    case 'in_transit_outbound': return 'En route to site';
    case 'pouring': return 'Pouring';
    case 'in_transit_return': return 'Returning to plant';
    default: return '';
  }
}

export function phaseEtaLabel(phase: string, etaSeconds: number): string {
  const eta = formatEta(etaSeconds);
  switch (phase) {
    case 'loading': return `Loading -- ${eta}`;
    case 'in_transit_outbound': return `Arrives in ${eta}`;
    case 'pouring': return `Pour done in ${eta}`;
    case 'in_transit_return': return `Returns in ${eta}`;
    default: return '';
  }
}
