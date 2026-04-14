/**
 * useOrders — data hook for the Dispatch Board.
 *
 * Phase 6: fetches from the real API via the api client.
 * The returned interface is identical to Phase 2 so no
 * component code changes are required.
 */

import { useState, useCallback, useEffect } from 'react';
import { usePlant } from '@/context/PlantContext';
import { api } from '@/api/client';
import type { Order } from '@/types/domain';
import type { OrderStatus } from '@/theme/statusColors';
import dayjs from 'dayjs';

// Valid status transitions — dispatchers can only move forward
// (or cancel from any non-terminal state).
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:    ['scheduled', 'cancelled'],
  scheduled:  ['dispatched', 'pending', 'cancelled'],
  dispatched: ['in_transit', 'pending', 'cancelled'],
  in_transit: ['pouring', 'pending', 'cancelled'],
  pouring:    ['returning', 'pending', 'cancelled'],
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
  createOrder: (draft: NewOrderDraft) => Promise<Order>;
  updateOrderStatus: (ticketNumber: string, status: OrderStatus, note?: string, routeData?: { coordinates: [number, number][]; distanceMeters: number; durationSeconds: number }, truckAssignment?: { assignedTruckId: string; assignedTruckNumber: string; driverName: string }) => Promise<void>;
  assignTruck: (ticketNumber: string, truckId: string, truckNumber: string, driverName: string) => Promise<void>;
  updateRequestedTime: (ticketNumber: string, newRequestedTime: string) => Promise<void>;
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch orders when plant or date changes, then poll every 15 seconds
  // to pick up ticker-driven status changes
  useEffect(() => {
    let cancelled = false;

    const fetchOrders = (isInitial = false) => {
      if (isInitial) {
        setLoading(true);
        setError(null);
      }

      api.get<{ orders: Order[]; count: number }>('/orders', {
        plantId: selectedPlant.plantId,
        date: selectedDate,
      })
        .then((data) => {
          if (!cancelled) setOrders(data.orders);
        })
        .catch((err) => {
          if (!cancelled && isInitial) setError(err.message ?? 'Failed to load orders');
        })
        .finally(() => {
          if (!cancelled && isInitial) setLoading(false);
        });
    };

    fetchOrders(true);
    const pollId = setInterval(() => fetchOrders(false), 15_000);

    return () => { cancelled = true; clearInterval(pollId); };
  }, [selectedPlant.plantId, selectedDate]);

  // ── createOrder ─────────────────────────────────────────────────────────────
  const createOrder = useCallback(async (draft: NewOrderDraft): Promise<Order> => {
    const body = {
      ...draft,
      plantId: selectedPlant.plantId,
    };

    const newOrder = await api.post<Order>('/orders', body);
    setOrders((prev) => [...prev, newOrder]);
    return newOrder;
  }, [selectedPlant.plantId]);

  // ── updateOrderStatus ────────────────────────────────────────────────────────
  const updateOrderStatus = useCallback(async (
    ticketNumber: string,
    newStatus: OrderStatus,
    note?: string,
    routeData?: { coordinates: [number, number][]; distanceMeters: number; durationSeconds: number },
    truckAssignment?: { assignedTruckId: string; assignedTruckNumber: string; driverName: string },
  ) => {
    // Optimistic validation
    const existing = orders.find((o) => o.ticketNumber === ticketNumber);
    if (existing && !canTransition(existing.status, newStatus)) {
      console.warn(`Invalid transition: ${existing.status} → ${newStatus}`);
      return;
    }

    try {
      const body: Record<string, unknown> = { status: newStatus, note };
      if (routeData) body.routeData = routeData;
      if (truckAssignment) {
        body.assignedTruckId = truckAssignment.assignedTruckId;
        body.assignedTruckNumber = truckAssignment.assignedTruckNumber;
        body.driverName = truckAssignment.driverName;
      }

      const updated = await api.patch<Order>(
        `/orders/${ticketNumber}`,
        body,
        { plantId: selectedPlant.plantId, date: selectedDate },
      );

      setOrders((prev) =>
        prev.map((o) => (o.ticketNumber === ticketNumber ? updated : o))
      );
    } catch (err: unknown) {
      const apiErr = err as { status?: number; message?: string };
      setError(apiErr.message ?? 'Failed to update order status');
    }
  }, [orders, selectedPlant.plantId, selectedDate]);

  // ── assignTruck ──────────────────────────────────────────────────────────────
  const assignTruck = useCallback(async (
    ticketNumber: string,
    truckId: string,
    truckNumber: string,
    driverName: string,
  ) => {
    try {
      const updated = await api.patch<Order>(
        `/orders/${ticketNumber}`,
        { assignedTruckId: truckId, assignedTruckNumber: truckNumber, driverName },
        { plantId: selectedPlant.plantId, date: selectedDate },
      );

      setOrders((prev) =>
        prev.map((o) => (o.ticketNumber === ticketNumber ? updated : o))
      );
    } catch (err: unknown) {
      const apiErr = err as { status?: number; message?: string };
      setError(apiErr.message ?? 'Failed to assign truck');
    }
  }, [selectedPlant.plantId, selectedDate]);

  // ── updateRequestedTime (pending orders only) ───────────────────────────────
  const updateRequestedTime = useCallback(async (
    ticketNumber: string,
    newRequestedTime: string,
  ) => {
    try {
      const updated = await api.patch<Order>(
        `/orders/${ticketNumber}`,
        { requestedTime: newRequestedTime },
        { plantId: selectedPlant.plantId, date: selectedDate },
      );

      setOrders((prev) =>
        prev.map((o) => (o.ticketNumber === ticketNumber ? updated : o))
      );
    } catch (err: unknown) {
      const apiErr = err as { status?: number; message?: string };
      setError(apiErr.message ?? 'Failed to update requested time');
    }
  }, [selectedPlant.plantId, selectedDate]);

  return {
    orders,
    loading,
    error,
    selectedDate,
    setSelectedDate,
    createOrder,
    updateOrderStatus,
    assignTruck,
    updateRequestedTime,
  };
}
