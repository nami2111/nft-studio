/**
 * Test setup file for component testing.
 * Provides global test utilities and mocks.
 */

import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/svelte';

// Mock Worker API for testing
class MockWorker {
	url: string;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: ErrorEvent) => void) | null = null;

	constructor(url: string) {
		this.url = url;
		// Simulate async worker loading
		setTimeout(() => {
			this.onmessage?.({ data: { type: 'ready' } } as MessageEvent);
		}, 10);
	}

	postMessage(data: unknown) {
		// Simulate worker processing
		setTimeout(() => {
			if (this.onmessage) {
				this.onmessage({
					data: {
						type: 'response',
						data,
						id: Math.random().toString(36).substr(2, 9)
					}
				} as MessageEvent);
			}
		}, 5);
	}

	terminate() {
		// Mock termination
	}

	addEventListener(type: string, listener: EventListener) {
		if (type === 'message') {
			this.onmessage = listener as (event: MessageEvent) => void;
		} else if (type === 'error') {
			this.onerror = listener as (event: ErrorEvent) => void;
		}
	}

	removeEventListener(type: string, listener: EventListener) {
		if (type === 'message' && this.onmessage === listener) {
			this.onmessage = null;
		} else if (type === 'error' && this.onerror === listener) {
			this.onerror = null;
		}
	}
}

// Setup global Worker mock
global.Worker = MockWorker as any;

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn()
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn()
}));

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'mocked-url');
global.URL.revokeObjectURL = vi.fn();

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(), // deprecated
		removeListener: vi.fn(), // deprecated
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn()
	}))
});

// Mock window.visualViewport
Object.defineProperty(window, 'visualViewport', {
	writable: true,
	value: {
		height: 800,
		width: 1200,
		scale: 1,
		offsetTop: 0,
		offsetLeft: 0,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn()
	}
});

// Mock canvas context
const mockCanvasContext = {
	getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
	putImageData: vi.fn(),
	createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
	drawImage: vi.fn(),
	clearRect: vi.fn(),
	fillRect: vi.fn(),
	strokeRect: vi.fn(),
	beginPath: vi.fn(),
	closePath: vi.fn(),
	moveTo: vi.fn(),
	lineTo: vi.fn(),
	arc: vi.fn(),
	translate: vi.fn(),
	rotate: vi.fn(),
	scale: vi.fn(),
	save: vi.fn(),
	restore: vi.fn(),
	fill: vi.fn(),
	stroke: vi.fn(),
	clip: vi.fn(),
	measureText: vi.fn(() => ({ width: 100 })),
	fillText: vi.fn(),
	strokeText: vi.fn()
};

HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCanvasContext);

// Mock File API
global.File = class MockFile {
	constructor(
		public chunks: BlobPart[],
		public filename: string,
		public options: FilePropertyBag = {}
	) {
		this.name = filename;
		this.size = chunks.reduce((acc, chunk) => acc + (chunk as Blob).size, 0);
		this.type = options.type || '';
		this.lastModified = Date.now();
	}

	name: string;
	size: number;
	type: string;
	lastModified: number;

	slice(): Blob {
		return new Blob();
	}

	stream(): ReadableStream {
		return new ReadableStream();
	}

	text(): Promise<string> {
		return Promise.resolve('');
	}

	arrayBuffer(): Promise<ArrayBuffer> {
		return Promise.resolve(new ArrayBuffer(0));
	}
};

// Mock Blob
global.Blob = class MockBlob {
	constructor(
		public parts: BlobPart[] = [],
		public options: BlobPropertyBag = {}
	) {
		this.size = parts.reduce((acc, part) => acc + (part as Blob).size, 0);
		this.type = options.type || '';
	}

	size: number;
	type: string;

	slice(): Blob {
		return new Blob();
	}

	stream(): ReadableStream {
		return new ReadableStream();
	}

	text(): Promise<string> {
		return Promise.resolve('');
	}

	arrayBuffer(): Promise<ArrayBuffer> {
		return Promise.resolve(new ArrayBuffer(0));
	}
};

// Mock document.createElement for anchor tags
const originalCreateElement = document.createElement.bind(document);
vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
	if (tagName === 'a') {
		return {
			href: '',
			download: '',
			click: vi.fn(),
			style: { display: '' },
			parentElement: null,
			setAttribute: vi.fn(),
			removeAttribute: vi.fn()
		} as any;
	}
	return originalCreateElement(tagName);
});

// Clean up after each test
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

// Mock console methods to reduce noise in tests
global.console = {
	...console,
	warn: vi.fn(),
	error: vi.fn()
};
