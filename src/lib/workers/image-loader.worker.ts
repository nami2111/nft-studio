// Store object URLs for cleanup
const objectUrls = new Map<string, string>();

// Handle single image requests
async function loadSingleImage(id: string, src: string) {
	try {
		// Add timeout to fetch requests
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

		const response = await fetch(src, {
			signal: controller.signal,
			headers: {
				'Cache-Control': 'no-cache'
			}
		});
		clearTimeout(timeoutId);

		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const blob = await response.blob();

		// Create object URL instead of data URL for better memory efficiency
		const objectUrl = URL.createObjectURL(blob);

		// Store for cleanup
		objectUrls.set(id, objectUrl);

		// Create image to get dimensions
		const img = new Image();
		img.onload = () => {
			self.postMessage({
				id,
				objectUrl,
				width: img.naturalWidth,
				height: img.naturalHeight
			});
			// Note: Don't revoke object URL here - it will be cleaned up when no longer needed
		};
		img.onerror = () => {
			// Clean up object URL on error
			if (objectUrls.has(id)) {
				URL.revokeObjectURL(objectUrls.get(id)!);
				objectUrls.delete(id);
			}
			self.postMessage({ id, error: 'Failed to load image dimensions' });
		};
		img.src = objectUrl;
	} catch (error) {
		// Clean up any object URL on error
		if (objectUrls.has(id)) {
			URL.revokeObjectURL(objectUrls.get(id)!);
			objectUrls.delete(id);
		}

		// Handle different error types
		let errorMessage = 'Unknown error';
		if (error instanceof Error) {
			if (error.name === 'AbortError') {
				errorMessage = 'Request timeout - image took too long to load';
			} else {
				errorMessage = error.message;
			}
		}
		self.postMessage({ id, error: errorMessage });
	}
}

// Handle batch image requests
async function loadBatchImages(requests: Array<{ id: string; src: string }>) {
	const results = await Promise.allSettled(
		requests.map(async ({ id, src }) => {
			try {
				// Add timeout to fetch requests
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

				const response = await fetch(src, {
					signal: controller.signal,
					headers: {
						'Cache-Control': 'no-cache'
					}
				});
				clearTimeout(timeoutId);

				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const blob = await response.blob();

				const objectUrl = URL.createObjectURL(blob);
				objectUrls.set(id, objectUrl);

				return new Promise<{ id: string; objectUrl: string; width: number; height: number }>(
					(resolve, reject) => {
						const img = new Image();
						img.onload = () => {
							resolve({
								id,
								objectUrl,
								width: img.naturalWidth,
								height: img.naturalHeight
							});
							// Note: Don't remove from map here - cleanup happens later
						};
						img.onerror = () => {
							if (objectUrls.has(id)) {
								URL.revokeObjectURL(objectUrls.get(id)!);
								objectUrls.delete(id);
							}
							reject(new Error('Failed to load image dimensions'));
						};
						img.src = objectUrl;
					}
				);
			} catch (error) {
				// Handle different error types
				let errorMessage = 'Unknown error';
				if (error instanceof Error) {
					if (error.name === 'AbortError') {
						errorMessage = 'Request timeout - image took too long to load';
					} else {
						errorMessage = error.message;
					}
				}
				throw { id, error: errorMessage };
			}
		})
	);

	// Send results for successful loads
	results.forEach((result) => {
		if (result.status === 'fulfilled') {
			self.postMessage(result.value);
		} else {
			const error = result.reason;
			if (error.id) {
				self.postMessage({ id: error.id, error: error.error });
			}
		}
	});
}

self.onmessage = async (
	event: MessageEvent<{ id: string; src: string } | { batch: Array<{ id: string; src: string }> }>
) => {
	const data = event.data;

	if ('batch' in data) {
		// Handle batch request
		loadBatchImages(data.batch);
	} else {
		// Handle single request
		loadSingleImage(data.id, data.src);
	}
};

// Cleanup on worker termination
self.addEventListener('beforeunload', () => {
	for (const url of objectUrls.values()) {
		URL.revokeObjectURL(url);
	}
	objectUrls.clear();
});
