/**
 * useDispatchMapFilters — UI filter state for the dispatch map page.
 *
 * Manages status multi-select, search, hot-load toggle, truck/route
 * visibility, and derives filtered order lists for the map + side panel.
 */

import { useState, useMemo, useCallback, useDeferredValue } from 'react';
import type { Order } from '@/types/domain';
import type { OrderStatus } from '@/theme/statusColors';

const ALL_STATUSES: OrderStatus[] = [
  'pending', 'dispatched', 'in_transit', 'pouring', 'returning', 'complete', 'cancelled',
];

const DEFAULT_STATUSES = new Set<OrderStatus>([
  'pending', 'dispatched', 'in_transit', 'pouring', 'returning',
]);

export function useDispatchMapFilters(allOrders: Order[]) {
  const [statusFilters, setStatusFilters] = useState<Set<OrderStatus>>(
    () => new Set(DEFAULT_STATUSES),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [hotLoadOnly, setHotLoadOnly] = useState(false);
  const [showTrucks, setShowTrucks] = useState(true);
  const [showAllRoutes, setShowAllRoutes] = useState(false);

  const deferredSearch = useDeferredValue(searchQuery);

  const toggleStatus = useCallback((status: OrderStatus) => {
    setStatusFilters(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setStatusFilters(new Set(DEFAULT_STATUSES));
    setSearchQuery('');
    setHotLoadOnly(false);
  }, []);

  // Counts from unfiltered set (so chip badges always show totals)
  const statusCounts = useMemo(() => {
    const counts = {} as Record<OrderStatus, number>;
    for (const s of ALL_STATUSES) counts[s] = 0;
    for (const o of allOrders) {
      counts[o.status as OrderStatus] = (counts[o.status as OrderStatus] ?? 0) + 1;
    }
    return counts;
  }, [allOrders]);

  const filteredOrders = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    return allOrders.filter(o => {
      if (!statusFilters.has(o.status as OrderStatus)) return false;
      if (hotLoadOnly && !o.isHotLoad) return false;
      if (q) {
        const haystack = `${o.ticketNumber} ${o.customerName} ${o.jobSiteName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [allOrders, statusFilters, hotLoadOnly, deferredSearch]);

  const isFiltered = useMemo(() => {
    if (hotLoadOnly) return true;
    if (deferredSearch.trim()) return true;
    if (statusFilters.size !== DEFAULT_STATUSES.size) return true;
    for (const s of DEFAULT_STATUSES) {
      if (!statusFilters.has(s)) return true;
    }
    return false;
  }, [statusFilters, hotLoadOnly, deferredSearch]);

  return {
    // Filter state
    statusFilters,
    searchQuery,
    hotLoadOnly,
    showTrucks,
    showAllRoutes,
    // Setters
    toggleStatus,
    setSearchQuery,
    setHotLoadOnly,
    setShowTrucks,
    setShowAllRoutes,
    clearFilters,
    // Derived
    filteredOrders,
    statusCounts,
    isFiltered,
    totalCount: allOrders.length,
  };
}
