import type { TransferrableLayer } from '../domain/project.domain';

export type GenerationWorkerMessage = {
  type: 'start';
  payload: {
    layers: TransferrableLayer[];
    collectionSize: number;
    outputSize: { width: number; height: number };
    projectName: string;
    projectDescription: string;
  };
} | {
  type: 'cancel';
};

let _generationWorker: Worker | null = null;

/**
 * Lazily instantiate and return the Generation Worker as a module-type worker.
 * This enables better tree-shaking and allows code-splitting to reduce bundle size
 * by loading the worker only when generation is actually invoked.
 */
export async function getGenerationWorker(): Promise<Worker> {
  if (_generationWorker) return _generationWorker;

  if (typeof window === 'undefined' || typeof (Worker) === 'undefined') {
    throw new Error('Web Workers are not supported in this environment.');
  }

  // Create a module-type worker so that the worker itself can utilize ES modules
  _generationWorker = new Worker(new URL('./generation.worker.ts', import.meta.url), { type: 'module' });
  return _generationWorker;
}

export function terminateGenerationWorker(): void {
  if (_generationWorker) {
    _generationWorker.terminate();
    _generationWorker = null;
  }
}

/**
 * Lightweight helper to post messages to a worker instance.
 * Keeps a consistent API surface for higher-level orchestration code.
 */
export function postWorkerMessage(worker: Worker, message: GenerationWorkerMessage): void {
  worker.postMessage(message);
}