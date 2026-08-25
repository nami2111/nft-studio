/**
 * Minimal ZIP read/write helpers over @zip.js/zip.js.
 * The single ZIP library for the app — replaces the former jszip dependency.
 */

interface ZipEntryInput {
	path: string;
	data: ArrayBuffer | string;
}

/** Build a ZIP Blob from in-memory files. */
export async function createZipBlob(entries: ZipEntryInput[], level = 6): Promise<Blob> {
	const { BlobWriter, TextReader, Uint8ArrayReader, ZipWriter, configure } =
		await import('@zip.js/zip.js');
	configure({ useWebWorkers: false });
	const zipWriter = new ZipWriter(new BlobWriter('application/zip'));
	for (const entry of entries) {
		const data =
			typeof entry.data === 'string'
				? new TextReader(entry.data)
				: new Uint8ArrayReader(new Uint8Array(entry.data));
		await zipWriter.add(entry.path, data, { level });
	}
	return zipWriter.close();
}

export interface OpenedZip {
	entries: Array<{
		filename: string;
		directory: boolean;
		getData?: (writer: unknown) => Promise<unknown>;
	}>;
	text(path: string): Promise<string>;
	arrayBuffer(path: string): Promise<ArrayBuffer>;
	close(): Promise<void>;
}

/** Open a ZIP for reading; look entries up by exact path. */
export async function openZip(source: Blob | Uint8Array): Promise<OpenedZip> {
	const { BlobReader, BlobWriter, TextWriter, Uint8ArrayReader, ZipReader, configure } =
		await import('@zip.js/zip.js');
	configure({ useWebWorkers: false });
	const reader = new ZipReader(
		source instanceof Blob ? new BlobReader(source) : new Uint8ArrayReader(source)
	);
	const entries = (await reader.getEntries()) as OpenedZip['entries'];

	function find(path: string) {
		return entries.find((entry) => entry.filename === path && !entry.directory);
	}

	async function withData<T>(path: string, writer: unknown, fallback: T): Promise<T> {
		const entry = find(path);
		if (!entry || typeof entry.getData !== 'function') return fallback;
		return (await entry.getData(writer)) as T;
	}

	return {
		entries,
		text: (path) => withData(path, new TextWriter(), ''),
		arrayBuffer: async (path) => {
			const blob = await withData(path, new BlobWriter(), null as Blob | null);
			return blob ? blob.arrayBuffer() : new ArrayBuffer(0);
		},
		close: () => reader.close()
	};
}
