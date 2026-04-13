// Re-export all domain types from their canonical location.
// This file exists for backward compatibility with storybook/test imports.
export type {
  Plant,
  CustomerContact,
  JobSite,
  Customer,
  Ingredient,
  Admixture,
  MixDesign,
  Driver,
  Truck,
  PourType,
  DeliveryEvent,
  Order,
  DailyVolume,
  CycleTimePoint,
  UtilizationData,
} from '@/types/domain';
