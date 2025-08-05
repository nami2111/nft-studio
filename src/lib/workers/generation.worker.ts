// generation.worker.ts

// Since we can't directly transfer File objects to web workers,
// we'll need to convert them to a transferrable format
interface TransferrableTrait {
  id: string;
  name: string;
  // We'll transfer the image data as an ArrayBuffer
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

// Message types
interface StartMessage {
  type: 'start';
  payload: {
    layers: TransferrableLayer[];
    collectionSize: number;
    outputSize: {
      width: number;
      height: number;
    };
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
    images: { name: string; blob: Blob }[];
    metadata: { name: string; data: object }[];
  };
}

interface ErrorMessage {
  type: 'error';
  payload: {
    message: string;
  };
}

// Type for messages sent from main thread to worker
type IncomingMessage = StartMessage;

// Type for messages sent from worker to main thread
type OutgoingMessage = ProgressMessage | CompleteMessage | ErrorMessage;

// Listen for messages from the main thread
self.onmessage = async (e: MessageEvent<IncomingMessage>) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'start':
      try {
        await generateCollection(payload.layers, payload.collectionSize, payload.outputSize);
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
    default:
      const errorMessage: ErrorMessage = {
        type: 'error',
        payload: {
          message: `Unknown message type: ${type}`
        }
      };
      self.postMessage(errorMessage);
  }
};

// Rarity algorithm
function selectTrait(layer: TransferrableLayer): TransferrableTrait | null {
  // Handle optional layers first (v1.1)
  // ...

  const totalWeight = layer.traits.reduce((sum, trait) => sum + trait.rarityWeight, 0);
  let randomNum = Math.random() * totalWeight;

  for (const trait of layer.traits) {
    if (randomNum < trait.rarityWeight) {
      return trait;
    }
    randomNum -= trait.rarityWeight;
  }
  return null; // Should not happen if weights are valid
}

// Create an ImageBitmap from ArrayBuffer
async function createImageBitmapFromBuffer(buffer: ArrayBuffer): Promise<ImageBitmap> {
  // Create a Blob from the ArrayBuffer
  const blob = new Blob([buffer]);
  // Create an ImageBitmap from the Blob
  return await createImageBitmap(blob);
}

// Generate the collection
async function generateCollection(
  layers: TransferrableLayer[], 
  collectionSize: number,
  outputSize: { width: number; height: number }
) {
  const images: { name: string; blob: Blob }[] = [];
  const metadata: { name: string; data: object }[] = [];

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

  // Generate each NFT
  for (let i = 0; i < collectionSize; i++) {
    try {
      // Create an OffscreenCanvas with the project's output dimensions
      const canvas = new OffscreenCanvas(outputSize.width, outputSize.height);
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get 2d context from OffscreenCanvas');
      }

      // Clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Selected traits for this NFT
      const selectedTraits = [];

      // Iterate through the layers in their specified order
      for (const layer of layers) {
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
          const imageBitmap = await createImageBitmapFromBuffer(selectedTrait.imageData);
          
          // Draw the image onto the OffscreenCanvas
          ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
          
          // Clean up the ImageBitmap
          imageBitmap.close();
        }
      }

      // Convert the canvas to a Blob
      const blob = await canvas.convertToBlob({ type: 'image/png' });

      // Store the blob
      images.push({
        name: `image_${i + 1}.png`,
        blob
      });

      // Create metadata
      const metadataObj = {
        name: `NFT #${i + 1}`,
        description: `NFT #${i + 1} from the collection`,
        image: `image_${i + 1}.png`,
        attributes: selectedTraits.map(trait => ({
          trait_type: trait.layerName,
          value: trait.traitName
        }))
      };

      // Store the metadata
      metadata.push({
        name: `image_${i + 1}.json`,
        data: metadataObj
      });

      // Send progress update every 10 items or for the last item
      if (i % 10 === 0 || i === collectionSize - 1) {
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
      const errorMessage: ErrorMessage = {
        type: 'error',
        payload: {
          message: `Error generating item ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
      self.postMessage(errorMessage);
      // Continue with the next item
    }
  }

  // Send completion message
  const completeMessage: CompleteMessage = {
    type: 'complete',
    payload: {
      images,
      metadata
    }
  };
  self.postMessage(completeMessage);
}

export {};