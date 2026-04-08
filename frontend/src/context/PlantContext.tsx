import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Plant } from '../mocks/types';
import { plants } from '../mocks/plants';

interface PlantContextValue {
  selectedPlant: Plant;
  setSelectedPlant: (plant: Plant) => void;
  allPlants: Plant[];
}

const PlantContext = createContext<PlantContextValue | null>(null);

const STORAGE_KEY = 'readymix-selected-plant';

function getInitialPlant(): Plant {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Plant;
      const match = plants.find((p) => p.plantId === parsed.plantId);
      if (match) return match;
    }
  } catch {
    // ignore malformed storage
  }
  return plants[0];
}

export function PlantProvider({ children }: { children: ReactNode }) {
  const [selectedPlant, setSelectedPlantState] = useState<Plant>(getInitialPlant);

  const setSelectedPlant = useCallback((plant: Plant) => {
    setSelectedPlantState(plant);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plant));
  }, []);

  return (
    <PlantContext.Provider value={{ selectedPlant, setSelectedPlant, allPlants: plants }}>
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
