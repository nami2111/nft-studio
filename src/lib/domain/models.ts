import type { Project } from '$lib/types/project';
import type { Layer } from '$lib/types/layer';
import type { Trait } from '$lib/types/trait';

// Central domain models mapped to existing types
export type DomainProject = Project;
export type DomainLayer = Layer;
export type DomainTrait = Trait;

// For clarity, export simple shaped interfaces potentially extended later
export interface IDomainProjectLike {
  id: string;
  name: string;
  description?: string;
  outputSize: { width: number; height: number };
  layers: DomainLayer[];
}

export interface IDomainLayerLike {
  id: string;
  name: string;
  order?: number;
  isOptional?: boolean;
  traits: DomainTrait[];
}

export interface IDomainTraitLike {
  id: string;
  name: string;
  imageData?: ArrayBuffer;
  imageUrl?: string;
  rarityWeight?: number;
}
