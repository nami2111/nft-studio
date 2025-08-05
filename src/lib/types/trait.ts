// trait.ts
export interface Trait {
  id: string;
  name: string; // e.g., 'Blue.png'
  imageUrl: string; // Object URL created from uploaded file
  imageData: File; // The raw file object
  rarityWeight: number; // Integer from 1 (rarest) to 5 (most common)
}