// src/lib/workers/generation.worker.client.ts

import type { TransferrableLayer } from '../domain/project.domain';
import type { GenerationWorkerMessage } from './generation.worker.loader';
import { getGenerationWorker, postWorkerMessage, terminateGenerationWorker } from './generation.worker.loader';

export async function startGeneration(
  layers: TransferrableLayer[],
  collectionSize: number,
  outputSize: { width: number; height: number },
  projectName: string,
  projectDescription: string
): Promise<void> {
  const worker = await getGenerationWorker();
  const message: GenerationWorkerMessage = {
    type: 'start',
    payload: {
      layers,
      collectionSize,
      outputSize,
      projectName,
      projectDescription
    }
  };
  postWorkerMessage(worker, message);
}

export function cancelGeneration(): void {
  terminateGenerationWorker();
}