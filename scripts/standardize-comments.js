/**
 * Script to standardize comment formatting in the codebase
 */

import fs from 'fs';
import path from 'path';

// Function to process a file and standardize comments
function standardizeComments(filePath) {
	// Only process TypeScript and Svelte files
	if (!filePath.endsWith('.ts') && !filePath.endsWith('.svelte')) {
		return;
	}

	try {
		const content = fs.readFileSync(filePath, 'utf8');
		let updatedContent = content;

		// Fix inline comments to have a space after // but not in URLs
		// This regex finds // followed by a non-space character (but not // or http) and adds a space
		// Only apply this to lines that don't already have a space after //
		updatedContent = updatedContent.replace(/^([ \t]*\/\/)([^\s/])/gm, '$1 $2');

		// Remove trailing whitespace from lines
		updatedContent = updatedContent.replace(/[ \t]+$/gm, '');

		// Write back to file if content has changed
		if (updatedContent !== content) {
			fs.writeFileSync(filePath, updatedContent, 'utf8');
			console.log('Updated comments in: ' + filePath);
		}
	} catch (error) {
		console.error('Error processing file ' + filePath + ':', error.message);
	}
}

// Function to recursively process directory
function processDirectory(dirPath) {
	const files = fs.readdirSync(dirPath);

	for (const file of files) {
		const filePath = path.join(dirPath, file);
		const stat = fs.statSync(filePath);

		if (stat.isDirectory()) {
			processDirectory(filePath);
		} else {
			standardizeComments(filePath);
		}
	}
}

// Process the src directory
const srcDir = path.join(process.cwd(), 'src');
processDirectory(srcDir);

console.log('Comment standardization complete.');
