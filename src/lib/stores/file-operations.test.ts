import { describe, expect, it } from 'vite-plus/test';
import { zipImporter } from './file-operations';

describe('zipImporter', () => {
	it('accepts .zip files', () => {
		const file = new File([], 'project.zip', { type: 'application/zip' });
		expect(zipImporter.canImport(file)).toBe(true);
	});

	it('accepts uppercase .ZIP extension', () => {
		const file = new File([], 'project.ZIP', { type: 'application/zip' });
		expect(zipImporter.canImport(file)).toBe(true);
	});

	it('rejects non-zip files', () => {
		const file = new File([], 'project.json', { type: 'application/json' });
		expect(zipImporter.canImport(file)).toBe(false);
	});

	it('rejects files without extension', () => {
		const file = new File([], 'project');
		expect(zipImporter.canImport(file)).toBe(false);
	});
});
