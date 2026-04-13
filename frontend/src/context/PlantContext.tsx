import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Plant } from '@/types/domain';
import { api } from '@/api/client';

interface PlantContextValue {
  selectedPlant: Plant;
  setSelectedPlant: (plant: Plant) => void;
  allPlants: Plant[];
}

const PlantContext = createContext<PlantContextValue | null>(null);

const STORAGE_KEY = 'readymix-selected-plant';

function getStoredPlant(): Plant | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as Plant;
  } catch {
    // ignore malformed storage
  }
  return null;
}

export function PlantProvider({ children }: { children: ReactNode }) {
  const [allPlants, setAllPlants] = useState<Plant[]>([]);
  const [selectedPlant, setSelectedPlantState] = useState<Plant | null>(null);

  // Fetch plants from API on mount
  useEffect(() => {
    api.get<{ plants: Plant[] }>('/plants')
      .then((data) => {
        const plants = data.plants;
        setAllPlants(plants);

        // Restore selection from localStorage, falling back to first plant
        const stored = getStoredPlant();
        const match = stored ? plants.find((p) => p.plantId === stored.plantId) : null;
        setSelectedPlantState(match ?? plants[0] ?? null);
      })
      .catch((err) => {
        console.error('Failed to load plants:', err);
      });
  }, []);

  const setSelectedPlant = useCallback((plant: Plant) => {
    setSelectedPlantState(plant);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plant));
  }, []);

  // Don't render children until we have at least one plant
  if (!selectedPlant) return null;

  return (
    <PlantContext.Provider value={{ selectedPlant, setSelectedPlant, allPlants }}>
      {children}
    </PlantContext.Provider>
  );
}

export function usePlant(): PlantContextValue {
  const context = useContext(PlantContext);
  if (!context) {
    throw new Error('usePlant must be used within a PlantProvider');
  }
  return context;
}
