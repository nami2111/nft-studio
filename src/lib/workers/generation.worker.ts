// generation.worker.ts

// Worker message interfaces
interface TransferrableTrait {
	id: string;
	name: string;
	imageData: ArrayBuffer;
	rarityWeight: number;
}

interface TransferrableLayer {
	id: string;
	name: string;
	order: number;
	isOptional?: boolean;
	traits: TransferrableTrait[];
}

interface StartMessage {
	type: 'start';
	payload: {
		layers: TransferrableLayer[];
		collectionSize: number;
		outputSize: {
			width: number;
			height: number;
		};
		projectName: string;
		projectDescription: string;
	};
}

interface ProgressMessage {
	type: 'progress';
	payload: {
		generatedCount: number;
		totalCount: number;
		statusText: string;
	};
}

interface CompleteMessage {
	type: 'complete';
	payload: {
		images: { name: string; imageData: ArrayBuffer }[];
		metadata: { name: string; data: object }[];
	};
}

interface ErrorMessage {
	type: 'error';
	payload: {
		message: string;
	};
}

type IncomingMessage = StartMessage | { type: 'cancel' };

// Rarity algorithm
function selectTrait(layer: TransferrableLayer): TransferrableTrait | null {
	// Handle optional layers first
	if (layer.isOptional) {
		const skipChance = 0.3; // 30% chance to skip optional layer
		if (Math.random() < skipChance) {
			return null;
		}
	}

	const totalWeight = layer.traits.reduce((sum, trait) => sum + trait.rarityWeight, 0);
	if (totalWeight === 0) {
		return null; // No traits available
	}

	let randomNum = Math.random() * totalWeight;

	for (const trait of layer.traits) {
		if (randomNum < trait.rarityWeight) {
			return trait;
		}
		randomNum -= trait.rarityWeight;
	}
	return null;
}

// Create an ImageBitmap from ArrayBuffer without intermediate Object URLs
async function createImageBitmapFromBuffer(
	buffer: ArrayBuffer,
	traitName: string
): Promise<ImageBitmap> {
	if (!buffer || buffer.byteLength === 0) {
		throw new Error(`Image data is empty for trait "${traitName}"`);
	}

	try {
		const blob = new Blob([buffer], { type: 'image/png' });
		// Directly create an ImageBitmap from the Blob (no object URL needed)
		const imageBitmap = await createImageBitmap(blob);
		return imageBitmap;
	} catch (error) {
		throw new Error(
			`Failed to process image "${traitName}": ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

// No-op to keep call sites intact; retained for backward compatibility
function cleanupObjectUrls() {
	// Intentionally empty: we no longer create object URLs in the worker
}

// Generate the collection with chunked processing
async function generateCollection(
	layers: TransferrableLayer[],
	collectionSize: number,
	outputSize: { width: number; height: number },
	projectName: string,
	projectDescription: string
) {
	const images: { name: string; blob: Blob }[] = [];
	const metadata: { name: string; data: object }[] = [];
	const CHUNK_SIZE = 50;

	// Send initial progress
	const initialProgress: ProgressMessage = {
		type: 'progress',
		payload: {
			generatedCount: 0,
			totalCount: collectionSize,
			statusText: 'Starting generation...'
		}
	};

	self.postMessage(initialProgress);

	// Handle cancellation flag
	let isCancelled = false;
	const cancelHandler = (e: MessageEvent) => {
		if ((e as MessageEvent).data?.type === 'cancel') {
			isCancelled = true;
			cleanupResources();
			self.postMessage({ type: 'cancelled' });
			self.removeEventListener('message', cancelHandler);
		}
	};
	self.addEventListener('message', cancelHandler);

	// Prepare a reusable OffscreenCanvas and context once per generation to reduce GC churn
	const reusableCanvas = new OffscreenCanvas(outputSize.width, outputSize.height);
	const reusableCtx = reusableCanvas.getContext('2d');
	if (!reusableCtx) {
		throw new Error('Could not get 2d context from OffscreenCanvas');
	}

	// Generate each NFT in chunks
	for (let chunkStart = 0; chunkStart < collectionSize && !isCancelled; chunkStart += CHUNK_SIZE) {
		const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, collectionSize);

		for (let i = chunkStart; i < chunkEnd && !isCancelled; i++) {
			try {
				// Clear the reusable canvas for this item
				reusableCtx.clearRect(0, 0, reusableCanvas.width, reusableCanvas.height);

				// Selected traits for this NFT
				const selectedTraits = [];

				// Iterate through the layers in their specified order
				for (const layer of layers) {
					// Validate layer has traits
					if (!layer.traits || layer.traits.length === 0) {
						continue;
					}

					// Select a trait based on the rarity algorithm
					const selectedTrait = selectTrait(layer);

					// If a trait is selected, draw it
					if (selectedTrait) {
						selectedTraits.push({
							layerId: layer.id,
							layerName: layer.name,
							traitId: selectedTrait.id,
							traitName: selectedTrait.name
						});

						// Create ImageBitmap from the trait's image data
						const imageBitmap = await createImageBitmapFromBuffer(
							selectedTrait.imageData,
							selectedTrait.name
						);

						// Draw the image onto the OffscreenCanvas
						reusableCtx.drawImage(imageBitmap, 0, 0, reusableCanvas.width, reusableCanvas.height);

						// Clean up the ImageBitmap
						imageBitmap.close();
					}
				}

				// Convert the canvas to a Blob
				const blob = await reusableCanvas.convertToBlob({ type: 'image/png' });

				// Store the blob
				images.push({
					name: `${i + 1}.png`,
					blob
				});

				// Create metadata
				const attributes = [];
				for (const trait of selectedTraits) {
					attributes.push({
						trait_type: trait.layerName,
						value: trait.traitName
					});
				}

				const metadataObj = {
					name: `${projectName} #${i + 1}`,
					description: projectDescription,
					image: `${i + 1}.png`,
					attributes: attributes
				};

				// Store the metadata
				metadata.push({
					name: `${i + 1}.json`,
					data: metadataObj
				});

				// Send progress update
				if (i % 10 === 0 || i === collectionSize - 1 || i === chunkEnd - 1) {
					// Cleanup Object URLs periodically to free memory
					cleanupObjectUrls();
					
					const progressMessage: ProgressMessage = {
						type: 'progress',
						payload: {
							generatedCount: i + 1,
							totalCount: collectionSize,
							statusText: `Generated ${i + 1} of ${collectionSize} items`
						}
					};
					self.postMessage(progressMessage);
				}
			} catch (error) {
				// Ensure we detach the cancel listener on error paths to avoid leaks across runs
				try {
					self.removeEventListener('message', cancelHandler);
				} catch {
					// ignore
				}

				const errorMessage: ErrorMessage = {
					type: 'error',
					payload: {
						message: `Error generating item ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`
					}
				};
				self.postMessage(errorMessage);
				throw error; // Stop generation on error
			}
		}

		// Force garbage collection between chunks if available
		if (typeof globalThis !== 'undefined' && 'gc' in globalThis) {
			(globalThis as { gc?: () => void }).gc?.();
		}

		// Send intermediate progress for chunk completion
		if (!isCancelled && chunkEnd < collectionSize) {
			const chunkProgress: ProgressMessage = {
				type: 'progress',
				payload: {
					generatedCount: chunkEnd,
					totalCount: collectionSize,
					statusText: `Completed chunk ${Math.floor(chunkEnd / CHUNK_SIZE)} of ${Math.ceil(collectionSize / CHUNK_SIZE)}`
				}
			};
			self.postMessage(chunkProgress);
		}
	}

	// Remove cancel listener
	self.removeEventListener('message', cancelHandler);

	// Check if cancelled before final processing
	if (isCancelled) {
		self.postMessage({ type: 'cancelled' });
		return;
	}

	// Final cleanup (no object URLs created anymore, left as no-op)
	cleanupObjectUrls();

	// Convert Blobs to ArrayBuffers for transfer
	const imagesForTransfer = await Promise.all(
		images.map(async (image) => ({
			name: image.name,
			imageData: await image.blob.arrayBuffer()
		}))
	);

	// Send completion message with transferables to avoid copying
	const completeMessage: CompleteMessage = {
		type: 'complete',
		payload: {
			images: imagesForTransfer,
			metadata
		}
	};

	const transferables: ArrayBuffer[] = [];
	imagesForTransfer.forEach((img) => {
		if (img.imageData instanceof ArrayBuffer) {
			transferables.push(img.imageData);
		}
	});

	// Transfer the underlying ArrayBuffers
	// @ts-expect-error - TS in worker env may not infer postMessage overload with transfer list
	self.postMessage(completeMessage, transferables);
}

// Cleanup function to free resources
function cleanupResources() {
	if (typeof globalThis !== 'undefined' && 'gc' in globalThis) {
		(globalThis as { gc?: () => void }).gc?.();
	}
}

// Main worker message handler
self.onmessage = async (e: MessageEvent<IncomingMessage>) => {
	const { type, payload } = e.data as {
		type: string;
		payload?: unknown;
	};

	switch (type) {
		case 'start':
			try {
				const startPayload = payload as StartMessage['payload'];
				await generateCollection(
					startPayload.layers,
					startPayload.collectionSize,
					startPayload.outputSize,
					startPayload.projectName,
					startPayload.projectDescription
				);
			} catch (error) {
				const errorMessage: ErrorMessage = {
					type: 'error',
					payload: {
						message: error instanceof Error ? error.message : 'An unknown error occurred'
					}
				};
				self.postMessage(errorMessage);
			}
			break;
		case 'cancel':
			// Cancel is handled by event listener in generateCollection
			break;
		default: {
			const errorMessage: ErrorMessage = {
				type: 'error',
				payload: {
					message: `Unknown message type: ${type}`
				}
			};
			self.postMessage(errorMessage);
		}
	}
};
