/**
 * useOrders — data hook for the Dispatch Board.
 *
 * Phase 2: returns mock data filtered by the selected plant and date.
 * Phase 6: the internals swap to real API calls; the returned interface
 *           stays identical so no component code changes.
 */

import { useState, useCallback, useMemo } from 'react';
import { usePlant } from '@/context/PlantContext';
import { orders as mockOrders } from '@/mocks';
import type { Order } from '@/mocks/types';
import type { OrderStatus } from '@/theme/statusColors';
import dayjs from 'dayjs';

// Valid status transitions — dispatchers can only move forward
// (or cancel from any non-terminal state).
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:    ['dispatched', 'cancelled'],
  dispatched: ['in_transit', 'cancelled'],
  in_transit: ['pouring', 'cancelled'],
  pouring:    ['returning', 'cancelled'],
  returning:  ['complete'],
  complete:   [],
  cancelled:  [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Return shape ────────────────────────────────────────────────────────────

export interface UseOrdersReturn {
  orders: Order[];
  loading: boolean;
  error: string | null;
  selectedDate: string;          // ISO date string "YYYY-MM-DD"
  setSelectedDate: (d: string) => void;
  createOrder: (draft: NewOrderDraft) => Order;
  updateOrderStatus: (ticketNumber: string, status: OrderStatus, note?: string) => void;
  assignTruck: (ticketNumber: string, truckId: string, truckNumber: string, driverName: string) => void;
}

// Everything the caller must supply to create a new order
export interface NewOrderDraft {
  customerId: string;
  customerName: string;
  jobSiteId: string;
  jobSiteName: string;
  jobSiteAddress: string;
  mixDesignId: string;
  mixDesignName: string;
  psi: number;
  volume: number;
  slump: number;
  pourType: Order['pourType'];
  requestedTime: string;         // ISO datetime
  isHotLoad: boolean;
  notes?: string;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useOrders(): UseOrdersReturn {
  const { selectedPlant } = usePlant();
  const [selectedDate, setSelectedDate] = useState<string>(
    dayjs().format('YYYY-MM-DD')
  );

  // In Phase 2 we hold a local copy of the mock orders in state so
  // creates/updates are reflected in the UI immediately.
  const [localOrders, setLocalOrders] = useState<Order[]>(() => mockOrders);

  // Filter by plant + date
  const orders = useMemo<Order[]>(() => {
    return localOrders.filter((o) => {
      const matchesPlant = o.plantId === selectedPlant.plantId;
      const orderDate = dayjs(o.requestedTime).format('YYYY-MM-DD');
      const matchesDate = orderDate === selectedDate;
      return matchesPlant && matchesDate;
    });
  }, [localOrders, selectedPlant.plantId, selectedDate]);

  // ── createOrder ─────────────────────────────────────────────────────────────
  const createOrder = useCallback((draft: NewOrderDraft): Order => {
    const now = new Date().toISOString();
    const ticketNumber = `TKT-${Date.now().toString().slice(-6)}`;

    const newOrder: Order = {
      ticketNumber,
      plantId: selectedPlant.plantId,
      status: 'pending',
      events: [{ timestamp: now, eventType: 'pending', note: 'Order created' }],
      createdAt: now,
      updatedAt: now,
      ...draft,
    };

    setLocalOrders((prev) => [...prev, newOrder]);
    return newOrder;
  }, [selectedPlant.plantId]);

  // ── updateOrderStatus ────────────────────────────────────────────────────────
  const updateOrderStatus = useCallback((
    ticketNumber: string,
    newStatus: OrderStatus,
    note?: string,
  ) => {
    setLocalOrders((prev) =>
      prev.map((o) => {
        if (o.ticketNumber !== ticketNumber) return o;
        if (!canTransition(o.status, newStatus)) {
          console.warn(`Invalid transition: ${o.status} → ${newStatus}`);
          return o;
        }
        const now = new Date().toISOString();
        return {
          ...o,
          status: newStatus,
          updatedAt: now,
          events: [
            ...o.events,
            { timestamp: now, eventType: newStatus, note },
          ],
        };
      })
    );
  }, []);

  // ── assignTruck ──────────────────────────────────────────────────────────────
  const assignTruck = useCallback((
    ticketNumber: string,
    truckId: string,
    truckNumber: string,
    driverName: string,
  ) => {
    setLocalOrders((prev) =>
      prev.map((o) =>
        o.ticketNumber === ticketNumber
          ? { ...o, assignedTruckId: truckId, assignedTruckNumber: truckNumber, driverName }
          : o
      )
    );
  }, []);

  return {
    orders,
    loading: false,   // Phase 6: set true during fetch
    error: null,      // Phase 6: set on fetch failure
    selectedDate,
    setSelectedDate,
    createOrder,
    updateOrderStatus,
    assignTruck,
  };
}
