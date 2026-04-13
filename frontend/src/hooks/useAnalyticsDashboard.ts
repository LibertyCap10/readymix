/**
 * useAnalyticsDashboard — fetches all analytics data in parallel
 * for the Analytics reporting page.
 */

import { useState, useEffect } from 'react';
import { usePlant } from '@/context/PlantContext';
import { api } from '@/api/client';

export interface VolumePoint {
  date: string;
  volumeYards: number;
}

export interface CycleTimePoint {
  date: string;
  avgMinutes: number;
}

export interface CustomerScore {
  name: string;
  totalOrders: number;
  totalVolume: number;
  revenue: number;
  avgCycleTime: number;
  onTimePct: number;
  lastDelivery: string;
}

export interface DriverScore {
  name: string;
  deliveries: number;
  totalVolume: number;
  avgCycleTime: number;
  onTimePct: number;
  plant: string;
}

export interface AnalyticsDashboardData {
  volume: VolumePoint[];
  cycleTimes: CycleTimePoint[];
  benchmarkMinutes: number;
  utilizationPct: number;
  totalTrucks: number;
  productiveCount: number;
  customers: CustomerScore[];
  drivers: DriverScore[];
  loading: boolean;
  error: string | null;
  range: string;
  setRange: (r: string) => void;
}

interface VolumeResponse {
  plantId: string;
  range: string;
  data: Array<{ date: string; volumeYards: number }>;
}

interface CycleTimeResponse {
  plantId: string;
  range: string;
  data: Array<{ date: string; avgMinutes: number }>;
  benchmarkMinutes: number;
}

interface UtilizationResponse {
  plantId: string;
  total: number;
  productiveCount: number;
  utilizationPct: number;
  byStatus: Record<string, number>;
}

interface CustomersResponse {
  plantId: string;
  customers: CustomerScore[];
}

interface DriversResponse {
  plantId: string;
  drivers: DriverScore[];
}

export function useAnalyticsDashboard(): AnalyticsDashboardData {
  const { selectedPlant } = usePlant();
  const [range, setRange] = useState('7d');
  const [volume, setVolume] = useState<VolumePoint[]>([]);
  const [cycleTimes, setCycleTimes] = useState<CycleTimePoint[]>([]);
  const [benchmarkMinutes, setBenchmark] = useState(90);
  const [utilizationPct, setUtilizationPct] = useState(0);
  const [totalTrucks, setTotalTrucks] = useState(0);
  const [productiveCount, setProductiveCount] = useState(0);
  const [customers, setCustomers] = useState<CustomerScore[]>([]);
  const [drivers, setDrivers] = useState<DriverScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const plantId = selectedPlant.plantId;

    Promise.all([
      api.get<VolumeResponse>('/analytics/volume', { plantId, range }),
      api.get<CycleTimeResponse>('/analytics/cycle-times', { plantId, range }),
      api.get<UtilizationResponse>('/analytics/utilization', { plantId }),
      api.get<CustomersResponse>('/analytics/customers', { plantId }),
      api.get<DriversResponse>('/analytics/drivers', { plantId }),
    ])
      .then(([vol, ct, util, cust, drv]) => {
        if (cancelled) return;
        setVolume(vol.data.map(d => ({ date: d.date, volumeYards: Number(d.volumeYards) || 0 })));
        setCycleTimes(ct.data.map(d => ({ date: d.date, avgMinutes: Number(d.avgMinutes) || 0 })));
        setBenchmark(ct.benchmarkMinutes);
        setUtilizationPct(util.utilizationPct);
        setTotalTrucks(util.total);
        setProductiveCount(util.productiveCount);
        setCustomers(cust.customers);
        setDrivers(drv.drivers);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? 'Failed to load analytics');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedPlant.plantId, range]);

  return {
    volume,
    cycleTimes,
    benchmarkMinutes,
    utilizationPct,
    totalTrucks,
    productiveCount,
    customers,
    drivers,
    loading,
    error,
    range,
    setRange,
  };
}
