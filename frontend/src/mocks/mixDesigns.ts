import type { MixDesign } from './types';

export const mixDesigns: MixDesign[] = [
  {
    mixDesignId: 'MIX-3000-LS',
    name: '3000 PSI Limestone',
    psi: 3000,
    aggregateType: 'limestone',
    slumpMin: 4,
    slumpMax: 6,
    ingredients: [
      { name: 'Type I/II Portland Cement', quantity: 470, unit: 'lbs/yd³' },
      { name: 'Limestone Coarse Aggregate', quantity: 1800, unit: 'lbs/yd³' },
      { name: 'Manufactured Sand', quantity: 1350, unit: 'lbs/yd³' },
      { name: 'Water', quantity: 32, unit: 'gal/yd³' },
    ],
    admixtures: [
      { name: 'WRDA 64', type: 'water_reducer', dosage: 3, unit: 'oz/cwt' },
    ],
  },
  {
    mixDesignId: 'MIX-4000-LS',
    name: '4000 PSI Limestone',
    psi: 4000,
    aggregateType: 'limestone',
    slumpMin: 4,
    slumpMax: 6,
    ingredients: [
      { name: 'Type I/II Portland Cement', quantity: 564, unit: 'lbs/yd³' },
      { name: 'Limestone Coarse Aggregate', quantity: 1750, unit: 'lbs/yd³' },
      { name: 'Manufactured Sand', quantity: 1280, unit: 'lbs/yd³' },
      { name: 'Water', quantity: 30, unit: 'gal/yd³' },
    ],
    admixtures: [
      { name: 'WRDA 64', type: 'water_reducer', dosage: 4, unit: 'oz/cwt' },
      { name: 'Daravair 1000', type: 'air_entrainer', dosage: 0.5, unit: 'oz/cwt' },
    ],
  },
  {
    mixDesignId: 'MIX-5000-GR',
    name: '5000 PSI Granite',
    psi: 5000,
    aggregateType: 'granite',
    slumpMin: 3,
    slumpMax: 5,
    ingredients: [
      { name: 'Type I/II Portland Cement', quantity: 658, unit: 'lbs/yd³' },
      { name: 'Granite Coarse Aggregate', quantity: 1850, unit: 'lbs/yd³' },
      { name: 'Natural Sand', quantity: 1200, unit: 'lbs/yd³' },
      { name: 'Water', quantity: 28, unit: 'gal/yd³' },
    ],
    admixtures: [
      { name: 'ADVA 140M', type: 'water_reducer', dosage: 6, unit: 'oz/cwt' },
      { name: 'Daratard 17', type: 'retarder', dosage: 2, unit: 'oz/cwt' },
    ],
  },
  {
    mixDesignId: 'MIX-3500-LS-ACC',
    name: '3500 PSI Limestone (Accelerated)',
    psi: 3500,
    aggregateType: 'limestone',
    slumpMin: 4,
    slumpMax: 7,
    ingredients: [
      { name: 'Type III Portland Cement', quantity: 520, unit: 'lbs/yd³' },
      { name: 'Limestone Coarse Aggregate', quantity: 1780, unit: 'lbs/yd³' },
      { name: 'Manufactured Sand', quantity: 1320, unit: 'lbs/yd³' },
      { name: 'Water', quantity: 31, unit: 'gal/yd³' },
    ],
    admixtures: [
      { name: 'Pozzolith 100XR', type: 'accelerator', dosage: 15, unit: 'oz/cwt' },
      { name: 'WRDA 64', type: 'water_reducer', dosage: 3, unit: 'oz/cwt' },
    ],
  },
];
