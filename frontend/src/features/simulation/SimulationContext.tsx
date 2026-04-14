import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Order, Plant, Truck } from '@/types/domain';
import type { RouteData } from '@/features/dispatch-map/useMapRoutes';
import type { OrderStatus } from '@/theme/statusColors';
import type { SimulationEntry } from './types';
import { useSimulationEngine } from './useSimulationEngine';

interface SimulationContextValue {
  getTruckPosition: (truckId: string) => { lng: number; lat: number } | null;
  getTruckStatus: (truckId: string) => string | null;
  getEntryByTruck: (truckId: string) => SimulationEntry | null;
  getEntryByTicket: (ticketNumber: string) => SimulationEntry | null;
  getEtaSeconds: (entry: SimulationEntry) => number;
  activeDispatches: SimulationEntry[];
  speedMultiplier: number;
  setSpeedMultiplier: (n: number) => void;
}

const SimulationCtx = createContext<SimulationContextValue | null>(null);

interface ProviderProps {
  orders: Order[];
  trucks: Truck[];
  routes: Record<string, RouteData>;
  plant: Plant;
  updateOrderStatus: (ticketNumber: string, status: OrderStatus) => Promise<void>;
  children: ReactNode;
}

export function SimulationProvider({
  orders,
  trucks,
  routes,
  plant,
  updateOrderStatus,
  children,
}: ProviderProps) {
  const [speedMultiplier, setSpeedMultiplier] = useState(1);

  const { truckPositions, truckStatuses, activeEntries } = useSimulationEngine({
    orders,
    trucks,
    routes,
    plant,
    updateOrderStatus,
    config: { speedMultiplier },
  });

  const getTruckPosition = (truckId: string) => truckPositions.get(truckId) ?? null;
  const getTruckStatus = (truckId: string) => truckStatuses.get(truckId) ?? null;
  const getEntryByTruck = (truckId: string) => activeEntries.find(e => e.truckId === truckId) ?? null;
  const getEntryByTicket = (ticketNumber: string) => activeEntries.find(e => e.ticketNumber === ticketNumber) ?? null;
  const getEtaSeconds = (entry: SimulationEntry) => {
    const remaining = entry.phaseStartedAt + entry.phaseDuration - Date.now();
    return Math.max(0, Math.round(remaining / 1000));
  };

  return (
    <SimulationCtx.Provider
      value={{
        getTruckPosition,
        getTruckStatus,
        getEntryByTruck,
        getEntryByTicket,
        getEtaSeconds,
        activeDispatches: activeEntries,
        speedMultiplier,
        setSpeedMultiplier,
      }}
    >
      {children}
    </SimulationCtx.Provider>
  );
}

export function useSimulation() {
  const ctx = useContext(SimulationCtx);
  if (!ctx) throw new Error('useSimulation must be used inside SimulationProvider');
  return ctx;
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
