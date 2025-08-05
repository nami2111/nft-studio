// layer.ts
import type { Trait } from './trait';

export interface Layer {
  id: string; // e.g., 'background'
  name: string; // e.g., 'Background'
  order: number; // Stacking order, e.g., 0, 1, 2...
  isOptional?: boolean; // For v1.1 Rules Engine
  traits: Trait[];
}