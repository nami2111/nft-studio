// project.ts
import type { Layer } from './layer';

export interface Project {
	id: string;
	name: string;
	description: string;
	outputSize: {
		width: number;
		height: number;
	};
	layers: Layer[];
	_needsProperLoad?: boolean; // Optional flag to indicate if project needs proper loading
}
