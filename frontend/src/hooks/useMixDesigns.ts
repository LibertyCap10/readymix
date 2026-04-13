/**
 * useMixDesigns — data hook for the Mixes tab.
 *
 * Provides CRUD operations for mix designs, filtered by the
 * currently selected plant. Follows the same patterns as
 * useOrders and useFleet.
 */

import { useState, useCallback, useEffect } from 'react';
import { usePlant } from '@/context/PlantContext';
import { api } from '@/api/client';
import type {
  MixDesign,
  MixDesignDraft,
  MixDesignFilters,
  IngredientOption,
  AdmixtureOption,
} from '@/types/domain';

// ─── Return shape ────────────────────────────────────────────────────────────

export interface UseMixDesignsReturn {
  mixDesigns: MixDesign[];
  loading: boolean;
  error: string | null;
  filters: MixDesignFilters;
  setFilters: (f: Partial<MixDesignFilters>) => void;
  ingredientOptions: IngredientOption[];
  admixtureOptions: AdmixtureOption[];
  createMixDesign: (draft: MixDesignDraft) => Promise<MixDesign>;
  updateMixDesign: (code: string, draft: Partial<MixDesignDraft>) => Promise<void>;
  toggleActive: (code: string, isActive: boolean) => Promise<void>;
  getMixDesignDetail: (code: string) => Promise<MixDesign>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useMixDesigns(): UseMixDesignsReturn {
  const { selectedPlant } = usePlant();
  const [mixDesigns, setMixDesigns] = useState<MixDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<MixDesignFilters>({
    includeInactive: false,
  });
  const [ingredientOptions, setIngredientOptions] = useState<IngredientOption[]>([]);
  const [admixtureOptions, setAdmixtureOptions] = useState<AdmixtureOption[]>([]);

  const setFilters = useCallback((partial: Partial<MixDesignFilters>) => {
    setFiltersState(prev => ({ ...prev, ...partial }));
  }, []);

  // Fetch mix designs when plant or filters change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params: Record<string, string | number | undefined> = {
      plantId: selectedPlant.plantId,
      psiMin: filters.psiMin,
      psiMax: filters.psiMax,
      pourType: filters.pourType,
      includeInactive: filters.includeInactive ? 'true' : undefined,
    };

    api
      .get<{ mixDesigns: MixDesign[]; count: number }>('/mix-designs', params)
      .then(data => {
        if (!cancelled) setMixDesigns(data.mixDesigns);
      })
      .catch(err => {
        if (!cancelled) setError(err.message ?? 'Failed to load mix designs');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedPlant.plantId, filters.psiMin, filters.psiMax, filters.pourType, filters.includeInactive]);

  // Fetch ingredient + admixture master lists once on mount
  useEffect(() => {
    api
      .get<{ ingredients: IngredientOption[] }>('/ingredients')
      .then(data => setIngredientOptions(data.ingredients))
      .catch(() => { /* non-critical */ });

    api
      .get<{ admixtures: AdmixtureOption[] }>('/admixtures')
      .then(data => setAdmixtureOptions(data.admixtures))
      .catch(() => { /* non-critical */ });
  }, []);

  const createMixDesign = useCallback(
    async (draft: MixDesignDraft): Promise<MixDesign> => {
      await api.post<MixDesign>('/mix-designs', {
        ...draft,
        plantId: selectedPlant.plantId,
      });
      // Re-fetch to get full data including applications
      const full = await api.get<MixDesign>(`/mix-designs/${draft.code}`);
      setMixDesigns(prev => [...prev, full]);
      return full;
    },
    [selectedPlant.plantId],
  );

  const updateMixDesign = useCallback(
    async (code: string, draft: Partial<MixDesignDraft>): Promise<void> => {
      await api.patch(`/mix-designs/${code}`, draft);
      // Re-fetch updated mix
      const full = await api.get<MixDesign>(`/mix-designs/${code}`);
      setMixDesigns(prev => prev.map(m => (m.code === code ? full : m)));
    },
    [],
  );

  const toggleActive = useCallback(
    async (code: string, isActive: boolean): Promise<void> => {
      await api.patch(`/mix-designs/${code}/status`, { isActive });
      setMixDesigns(prev =>
        prev.map(m => (m.code === code ? { ...m, isActive } : m)),
      );
    },
    [],
  );

  const getMixDesignDetail = useCallback(
    async (code: string): Promise<MixDesign> => {
      return api.get<MixDesign>(`/mix-designs/${code}`);
    },
    [],
  );

  return {
    mixDesigns,
    loading,
    error,
    filters,
    setFilters,
    ingredientOptions,
    admixtureOptions,
    createMixDesign,
    updateMixDesign,
    toggleActive,
    getMixDesignDetail,
  };
}
