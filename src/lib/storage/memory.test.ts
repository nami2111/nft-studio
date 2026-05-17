import { describe, expect, it } from 'vite-plus/test';
import { createMemoryStorageBackend } from './memory';

describe('memory storage backend', () => {
	it('round-trips binary data without sharing references', async () => {
		const backend = createMemoryStorageBackend();
		const source = new Uint8Array([1, 2, 3]).buffer;

		await backend.binary.write('gnstudio/test/file.bin', source);
		const loaded = await backend.binary.read('gnstudio/test/file.bin');

		expect(Array.from(new Uint8Array(loaded!))).toEqual([1, 2, 3]);

		new Uint8Array(source)[0] = 9;
		const loadedAgain = await backend.binary.read('gnstudio/test/file.bin');
		expect(Array.from(new Uint8Array(loadedAgain!))).toEqual([1, 2, 3]);
	});

	it('round-trips JSON data without sharing references', async () => {
		const backend = createMemoryStorageBackend();
		const value = { items: [{ id: 'one' }] };

		await backend.json.writeJson('gnstudio/test/manifest.json', value);
		value.items[0].id = 'changed';

		const loaded = await backend.json.readJson<typeof value>('gnstudio/test/manifest.json');
		expect(loaded).toEqual({ items: [{ id: 'one' }] });
	});

	it('lists and removes trees', async () => {
		const backend = createMemoryStorageBackend();

		await backend.binary.write('gnstudio/gallery/a/image.bin', new ArrayBuffer(1));
		await backend.json.writeJson('gnstudio/gallery/b/manifest.json', { ok: true });

		expect(await backend.binary.list('gnstudio/gallery')).toEqual(['a', 'b']);

		await backend.binary.removeTree('gnstudio/gallery/a');
		expect(await backend.binary.exists('gnstudio/gallery/a/image.bin')).toBe(false);
		expect(await backend.json.readJson('gnstudio/gallery/b/manifest.json')).toEqual({ ok: true });
	});
});
