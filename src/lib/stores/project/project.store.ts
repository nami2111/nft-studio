import { writable, get } from 'svelte/store';
import { LocalStorageStore } from '$lib/persistence/storage';
import { isValidImportedProject, isValidDimensions } from '$lib/utils/validation';
import {
	handleError,
	handleStorageError,
	handleFileError,
	handleValidationError
} from '$lib/utils/error-handler';
import type { Project } from '$lib/types/project';
import { defaultProject } from './project.model';

// Local storage key
const PROJECT_STORAGE_KEY = 'nft-studio-project';

const LOCAL_STORE = new LocalStorageStore<Project>(PROJECT_STORAGE_KEY);

// Create a writable store for the Project with a sane initial value
const initial = defaultProject();
export const project = writable<Project>(initial);

// Hydrate from storage if available
LOCAL_STORE.load().then((stored) => {
	if (stored) {
		project.set(stored);
	}
});

// Save project to localStorage via persistence layer
function saveProjectToStorage(projectData: Project) {
	LOCAL_STORE.save(projectData);
}

// Auto-save to localStorage on project changes
project.subscribe((p) => {
	saveProjectToStorage(p);
});

// --- Project Level Functions ---
export function updateProjectName(name: string): void {
	project.update((p) => ({ ...p, name }));
}

export function updateProjectDescription(description: string): void {
	project.update((p) => ({ ...p, description }));
}

export function updateProjectDimensions(width: number, height: number): void {
	if (!isValidDimensions(width, height)) {
		handleValidationError<void>(
			new Error('Invalid dimensions: width and height must be positive numbers'),
			{
				context: { component: 'ProjectStore', action: 'updateProjectDimensions' }
			}
		);
		return;
	}
	project.update((p) => ({ ...p, outputSize: { width, height } }));
}

// --- Project Management Functions ---
export function clearStoredProject(): void {
	try {
		// We'll handle trait cleanup in the trait store
	} catch (error) {
		handleError(error, {
			context: {
				component: 'ProjectStore',
				action: 'clearStoredProject'
			},
			silent: true
		});
	}

	try {
		LOCAL_STORE.clear();
	} catch (error) {
		handleStorageError(error, {
			context: {
				component: 'ProjectStore',
				action: 'clearStoredProject',
				userAction: 'clearLocalStorage'
			},
			description: 'Failed to clear project from storage. Please try again.'
		});
	}
}

export function exportProjectData(): string {
	try {
		const currentProject = get(project);
		const exportData = {
			...currentProject,
			// We'll handle trait data in the trait store
			exportedAt: new Date().toISOString()
		};
		return JSON.stringify(exportData, null, 2);
	} catch (error) {
		handleError(error, {
			context: { component: 'ProjectStore', action: 'exportProjectData' },
			title: 'Export Failed',
			description: 'Failed to export project data. Please try again.'
		});
		return '';
	}
}

export function importProjectData(projectJson: string): boolean {
	try {
		const importedData = JSON.parse(projectJson);
		if (!isValidImportedProject(importedData)) {
			handleValidationError(new Error('Invalid project format'), {
				context: { component: 'ProjectStore', action: 'importProjectData' },
				title: 'Import Failed',
				description: 'The project file format is invalid. Please check the file and try again.'
			});
			return false;
		}
		// Type assertion since we've validated the structure
		project.set(importedData as unknown as Project);
		return true;
	} catch (error) {
		handleError(error, {
			context: { component: 'ProjectStore', action: 'importProjectData' },
			title: 'Import Failed',
			description: 'Failed to import project data. Please check the file and try again.'
		});
		return false;
	}
}

// Check if project needs proper loading from ZIP
export function projectNeedsZipLoad(): boolean {
	const currentProject = get(project);
	return currentProject._needsProperLoad === true;
}

// Mark project as properly loaded
export function markProjectAsLoaded(): void {
	project.update((p) => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { _needsProperLoad: _, ...projectWithoutFlag } = p;
		return projectWithoutFlag as Project;
	});
}

// Save project to ZIP
export async function saveProjectToZip(): Promise<void> {
	// We'll implement this with the layer/trait stores
}

// Load project from ZIP
export async function loadProjectFromZip(file: File): Promise<boolean> {
	// We'll implement this with the layer/trait stores
	return false;
}
