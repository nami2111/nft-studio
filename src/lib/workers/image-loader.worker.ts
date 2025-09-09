self.onmessage = async (event: MessageEvent<{ id: string; src: string }>) => {
	const { id, src } = event.data;

	try {
		const response = await fetch(src);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const blob = await response.blob();
		const reader = new FileReader();
		reader.onload = (e) => {
			const dataUrl = e.target?.result as string;
			const img = new Image();
			img.onload = () => {
				self.postMessage({ id, dataUrl, width: img.naturalWidth, height: img.naturalHeight });
			};
			img.onerror = () => {
				self.postMessage({ id, error: 'Failed to load image dimensions' });
			};
			img.src = dataUrl;
		};
		reader.onerror = () => {
			self.postMessage({ id, error: 'Failed to read blob as data URL' });
		};
		reader.readAsDataURL(blob);
	} catch (error) {
		self.postMessage({ id, error: error instanceof Error ? error.message : 'Unknown error' });
	}
};
