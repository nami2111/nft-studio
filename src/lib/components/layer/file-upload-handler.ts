/**
 * File upload handler for layer traits
 * Handles drag and drop, file validation, and batch processing
 */

import type { LayerId } from '$lib/types/ids';
import { project, startLoading, stopLoading, addTrait, updateProjectDimensions } from '$lib/stores';
import { toast } from 'svelte-sonner';
import { getImageDimensions } from '$lib/utils';

export interface UploadProgress {
	loaded: number;
	total: number;
	percentage: number;
}

export class FileUploadHandler {
	private layerId: LayerId;
	private onProgress?: (progress: UploadProgress) => void;

	constructor(layerId: LayerId, onProgress?: (progress: UploadProgress) => void) {
		this.layerId = layerId;
		this.onProgress = onProgress;
	}

	/**
	 * Handle file upload from input or drag and drop
	 */
	async handleFileUpload(files: FileList | null): Promise<void> {
		if (!files || files.length === 0) return;

		// Validate and filter files
		const imageFiles = Array.from(files).filter((file) => {
			const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
			const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
			const fileName = file.name.toLowerCase();

			return (
				validTypes.includes(file.type) || validExtensions.some((ext) => fileName.endsWith(ext))
			);
		});

		if (imageFiles.length === 0) {
			toast.error('No valid image files found. Please upload PNG, JPG, GIF, or WebP files.');
			return;
		}

		// Check file sizes
		const oversizedFiles = imageFiles.filter((file) => file.size > 10 * 1024 * 1024);
		if (oversizedFiles.length > 0) {
			toast.error('Some files are larger than 10MB and will be skipped.');
		}

		const validFiles = imageFiles.filter((file) => file.size <= 10 * 1024 * 1024);
		if (validFiles.length === 0) return;

		// Auto-set project dimensions if not set and this is the first image
		const projectData = project;
		if (
			projectData.outputSize.width === 0 &&
			projectData.outputSize.height === 0 &&
			validFiles.length > 0
		) {
			try {
				const firstImageDimensions = await getImageDimensions(validFiles[0]);
				updateProjectDimensions({
					width: firstImageDimensions.width,
					height: firstImageDimensions.height
				});
				toast.success('Project dimensions set based on first uploaded image.');
			} catch (error) {
				console.error('Failed to get image dimensions:', error);
			}
		}

		// Process files in batches
		await this.processFilesInBatches(validFiles);
	}

	/**
	 * Process files in batches to avoid overwhelming the system
	 */
	private async processFilesInBatches(files: File[]): Promise<void> {
		const BATCH_SIZE = 5;
		const totalFiles = files.length;
		let processedCount = 0;

		startLoading(`layer-upload-${this.layerId}`);

		try {
			for (let i = 0; i < files.length; i += BATCH_SIZE) {
				const batch = files.slice(i, i + BATCH_SIZE);

				// Process batch
				await Promise.all(
					batch.map(async (file) => {
						try {
							addTrait(this.layerId, file);
						} catch (error) {
							console.error('Failed to add trait:', error);
						}
					})
				);

				processedCount += batch.length;

				// Update progress
				if (this.onProgress) {
					const batchProgress = Math.min(100, Math.round((processedCount / totalFiles) * 100));
					this.onProgress({
						loaded: processedCount,
						total: totalFiles,
						percentage: batchProgress
					});
				}

				// Small delay to prevent UI blocking
				await new Promise((resolve) => setTimeout(resolve, 100));
			}

			toast.success(`Successfully uploaded ${processedCount} files.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'An unknown error occurred.';
			toast.error(`Upload failed: ${message}`);
		} finally {
			stopLoading(`layer-upload-${this.layerId}`);
		}
	}

	/**
	 * Validate dragged files
	 */
	validateDraggedFiles(files: DataTransferItemList): boolean {
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			if (file.kind !== 'file') return false;

			const entry = file.webkitGetAsEntry();
			if (!entry) return false;
			if (entry.isDirectory) return false;
		}
		return true;
	}

	/**
	 * Get files from drag event
	 */
	getFilesFromDragEvent(event: DragEvent): File[] | null {
		if (!event.dataTransfer?.files) return null;

		return Array.from(event.dataTransfer.files).filter((file) => {
			const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
			return validTypes.includes(file.type);
		});
	}
}
