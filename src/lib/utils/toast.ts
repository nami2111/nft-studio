/**
 * Centralized Toast Utility Wrapper
 * Provides standardized toast notifications across the application
 */

import { toast } from 'svelte-sonner';

export function showSuccess(message: string, options?: { description?: string }): void {
	toast.success(message, {
		description: options?.description,
		duration: 4000
	});
}

export function showError(message: string, options?: { description?: string }): void {
	toast.error(message, {
		description: options?.description,
		duration: 6000
	});
}

export function showWarning(message: string, options?: { description?: string }): void {
	toast.warning(message, {
		description: options?.description,
		duration: 5000
	});
}

export function showInfo(message: string, options?: { description?: string }): void {
	toast.info(message, {
		description: options?.description,
		duration: 4000
	});
}

export function showDeleteSuccess(count: number, itemType: string = 'item(s)'): void {
	showSuccess(`${count} ${itemType} deleted successfully.`);
}

export function showDeleteError(): void {
	showError('Failed to delete. Please try again.');
}

export function showUpdateSuccess(itemName: string, action: string = 'updated'): void {
	showSuccess(`${itemName} has been ${action}.`);
}

export function showValidationError(message: string): void {
	showError(message);
}

export function showFileTooLarge(maxSize: string): void {
	showWarning(`File exceeds ${maxSize} limit.`);
}

export function showUploadSuccess(count: number): void {
	showSuccess(`${count} file(s) uploaded successfully.`);
}

export function showUploadPartialSuccess(successCount: number, errorCount: number): void {
	if (errorCount === 0) {
		showSuccess(`${successCount} file(s) uploaded successfully.`);
	} else {
		showWarning(`${successCount} file(s) uploaded, ${errorCount} failed.`);
	}
}

export function showUploadError(message: string): void {
	showError(`Upload failed: ${message}`);
}

export function showProjectSaved(): void {
	showSuccess('Project saved successfully!');
}

export function showProjectLoadSuccess(): void {
	showSuccess('Project loaded successfully!');
}

export function showProjectLoadError(message: string): void {
	showError(`Failed to load project: ${message}`);
}

export function showProjectSaveError(message: string): void {
	showError(message);
}

export function showInvalidFileType(): void {
	showError('Invalid file type. Please select a valid file.');
}

export function showNoValidFiles(): void {
	showError('No valid files found.');
}

export function showLayerRemoved(layerName: string): void {
	showInfo(`Layer "${layerName}" has been removed.`);
}

export function showTraitDeleted(traitName: string): void {
	showSuccess(`Trait "${traitName}" has been deleted.`);
}

export function showTraitNameUpdated(): void {
	showSuccess('Trait name updated.');
}

export function showTraitRenameSuccess(count: number): void {
	showSuccess(`${count} trait(s) renamed.`);
}

export function showBulkTraitDeleteSuccess(count: number): void {
	showSuccess(`${count} trait(s) deleted successfully.`);
}

export function showRulerTraitAction(traitName: string, action: string): void {
	showSuccess(`"${traitName}" ${action} ruler trait.`);
}
