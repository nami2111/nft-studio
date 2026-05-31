/**
 * ResultStreamer — unifies ZIP-streaming vs storage-streaming behind one interface.
 *
 * Generation pipeline calls `start()`, `onProgress()`, then `finalize()` or
 * `cancel()`. The streamer hides the feature-flag branching and session
 * cleanup details.
 */

import { isFlagEnabled } from '$lib/config/feature-flags';
import {
	cancelStreamingZip,
	finalizeStreamingZip,
	packageFromStorageBySize,
	startStreamingZip
} from '$lib/services/export.service';
import { cleanupStaleGenerationSessions, clearSession } from '$lib/utils/streaming-storage';

export interface StreamerProgressEvent {
	message: string;
}

export interface ResultStreamerOptions {
	sessionId: string;
	projectName: string;
	collectionSize: number;
	onProgress: (event: StreamerProgressEvent) => void;
}

export interface ResultStreamer {
	readonly mode: 'zip-stream' | 'storage-stream';
	readonly sessionId: string;
	start(): void;
	finalize(): Promise<void>;
	cancel(): void;
}

class ZipStreamer implements ResultStreamer {
	readonly mode = 'zip-stream' as const;
	readonly sessionId: string;
	private readonly projectName: string;
	private readonly onProgress: (event: StreamerProgressEvent) => void;
	private active = false;

	constructor(opts: ResultStreamerOptions) {
		this.sessionId = opts.sessionId;
		this.projectName = opts.projectName;
		this.onProgress = opts.onProgress;
	}

	start(): void {
		startStreamingZip(this.sessionId, this.projectName);
		this.active = true;
	}

	async finalize(): Promise<void> {
		this.onProgress({ message: 'Finalizing ZIP...' });
		await finalizeStreamingZip(this.projectName, (progress) => {
			this.onProgress({ message: progress.message });
		});
		this.active = false;
	}

	cancel(): void {
		if (!this.active) return;
		cancelStreamingZip();
		this.active = false;
	}
}

class StorageStreamer implements ResultStreamer {
	readonly mode = 'storage-stream' as const;
	readonly sessionId: string;
	private readonly projectName: string;
	private readonly onProgress: (event: StreamerProgressEvent) => void;

	constructor(opts: ResultStreamerOptions) {
		this.sessionId = opts.sessionId;
		this.projectName = opts.projectName;
		this.onProgress = opts.onProgress;
	}

	start(): void {
		void cleanupStaleGenerationSessions({ activeSessionIds: [this.sessionId] });
	}

	async finalize(): Promise<void> {
		this.onProgress({ message: 'Packaging from storage...' });
		await packageFromStorageBySize(
			this.sessionId,
			this.projectName,
			500 * 1024 * 1024,
			async (progress) => {
				this.onProgress({ message: progress.message });
			}
		);
		await clearSession(this.sessionId).catch(() => {});
	}

	cancel(): void {
		clearSession(this.sessionId).catch(() => {});
	}
}

export function createResultStreamer(opts: ResultStreamerOptions): ResultStreamer {
	const useStorage = isFlagEnabled('enableStreamingStorage');
	return useStorage ? new StorageStreamer(opts) : new ZipStreamer(opts);
}
