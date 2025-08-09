// trait.ts
export interface Trait {
	id: string;
	name: string; // e.g., 'Blue.png'
	imageUrl: string; // Object URL created from uploaded file
	imageData: ArrayBuffer; // The raw file object
	width: number; // Image width in pixels
	height: number; // Image height in pixels
	rarityWeight: number; // Integer from 1 (rare) to 5 (common)
}
