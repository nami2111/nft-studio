import { describe, it, expect } from 'vitest';
import type { Layer } from '../src/lib/types/layer';
import type { Trait } from '../src/lib/types/trait';
import { prepareLayersForWorker, hasMissingImageData, getLayersWithMissingImages } from '../src/lib/domain/project.domain';

function makeTrait(id: string, name: string, imageDataLen: number, rarityWeight: number): Trait {
  const arr = new ArrayBuffer(imageDataLen);
  return { id, name, imageData: arr, width: 100, height: 100, rarityWeight, imageUrl: '' } as any;
}

function makeLayer(id: string, name: string, traits: Trait[]): Layer {
  return { id, name, order: 0, traits } as any;
}

describe('domain: prepareLayersForWorker', () => {
  it('rejects when a trait has missing imageData', async () => {
    const layer = makeLayer('l1', 'Layer 1', [makeTrait('t1', 'Trait 1', 0, 1)]);
    await expect(prepareLayersForWorker([layer] as any)).rejects.toThrow();
  });

  it('returns transferrable layers when all image data present', async () => {
    const t1 = makeTrait('t1', 'Trait 1', 3, 1);
    const layer = makeLayer('l1', 'Layer 1', [t1]);
    const result = await prepareLayersForWorker([layer] as any);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].name).toBe('Layer 1');
    expect(result[0].traits[0].id).toBe('t1');
    expect(result[0].traits[0].imageData.byteLength).toBe(3);
  });
});

describe('domain: image data validation helpers', () => {
  it('hasMissingImageData detects missing data', () => {
    const layers = [makeLayer('l1', 'L1', [makeTrait('t1', 'T1', 0, 1)])];
    expect(hasMissingImageData(layers as any)).toBe(true);
  });

  it('getLayersWithMissingImages reports missing images', () => {
    const layers = [makeLayer('l1', 'L1', [makeTrait('t1', 'T1', 0, 1)])];
    const missing = getLayersWithMissingImages(layers as any);
    expect(missing.length).toBeGreaterThan(0);
  });
});
