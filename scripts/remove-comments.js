import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to recursively find all .js files in a directory
function findJSFiles(dir) {
	let results = [];
	const list = fs.readdirSync(dir);
	list.forEach((file) => {
		file = path.resolve(dir, file);
		const stat = fs.statSync(file);
		if (stat && stat.isDirectory()) {
			results = [...results, ...findJSFiles(file)];
		} else if (path.extname(file) === ".js") {
			results.push(file);
		}
	});
	return results;
}

// Function to remove the comment from a file
function removeCommentFromFile(filePath) {
	try {
		const content = fs.readFileSync(filePath, "utf8");
		const modifiedContent = content.replace(
			/\/\/ \.\.\. \(unchanged parts of the component\)/g,
			"",
		);
		if (content !== modifiedContent) {
			fs.writeFileSync(filePath, modifiedContent, "utf8");
			console.log(`Removed comment from ${filePath}`);
		}
	} catch (error) {
		console.error(`Error processing ${filePath}:`, error);
	}
}

// Function to find and remove empty JS files, then clean up their references
function removeEmptyChunks(buildDir) {
	const jsFiles = findJSFiles(buildDir);
	const emptyFiles = [];

	// Find all empty JS files
	for (const file of jsFiles) {
		const stat = fs.statSync(file);
		if (stat.size === 0) {
			emptyFiles.push(file);
		}
	}

	if (emptyFiles.length === 0) {
		return;
	}

	console.log(`Found ${emptyFiles.length} empty JS files to remove:`);

	// Get relative paths and basenames for reference cleanup
	const emptyFileNames = emptyFiles.map((f) => {
		const relPath = path.relative(buildDir, f);
		const basename = path.basename(f);
		return { fullPath: f, relPath, basename };
	});

	// Delete empty files
	for (const { fullPath, relPath } of emptyFileNames) {
		fs.unlinkSync(fullPath);
		console.log(`Deleted empty file: ${relPath}`);
	}

	// Remove references from all remaining JS files
	const remainingFiles = jsFiles.filter((f) => !emptyFiles.includes(f));
	let totalRefsRemoved = 0;

	for (const file of remainingFiles) {
		try {
			let content = fs.readFileSync(file, "utf8");
			let modified = false;

			for (const { basename } of emptyFileNames) {
				const nameWithoutExt = basename.replace(".js", "");
				// Match import statements like: import"./BTN-ohlh.js";
				const importPattern = new RegExp(
					`import\\s*["']\\.\\/[^"']*${nameWithoutExt}[^"']*\\.js["']\\s*;?`,
					"g",
				);
				// Match import statements like: import"./chunks/BTN-ohlh.js";
				const importPattern2 = new RegExp(
					`import\\s*["'][^"']*${nameWithoutExt}[^"']*\\.js["']\\s*;?`,
					"g",
				);
				// Match dynamic imports
				const dynamicImportPattern = new RegExp(
					`import\\s*\\(\\s*["'][^"']*${nameWithoutExt}[^"']*\\.js["']\\s*\\)\\s*,?`,
					"g",
				);
				// Match in arrays (like PWA precache lists)
				const arrayPattern = new RegExp(
					`["'][^"']*${nameWithoutExt}[^"']*\\.js["']\\s*,?`,
					"g",
				);
				// Match modulepreload links
				const preloadPattern = new RegExp(
					`<link[^>]*href=["'][^"']*${nameWithoutExt}[^"']*\\.js["'][^>]*>\\s*`,
					"g",
				);

				const patterns = [
					importPattern,
					importPattern2,
					dynamicImportPattern,
					arrayPattern,
					preloadPattern,
				];

				for (const pattern of patterns) {
					const newContent = content.replace(pattern, "");
					if (newContent !== content) {
						content = newContent;
						modified = true;
					}
				}
			}

			if (modified) {
				fs.writeFileSync(file, content, "utf8");
				const relPath = path.relative(buildDir, file);
				console.log(`Cleaned references from: ${relPath}`);
				totalRefsRemoved++;
			}
		} catch (error) {
			console.error(`Error cleaning references in ${file}:`, error);
		}
	}

	console.log(`Cleaned references from ${totalRefsRemoved} files`);
}

// Main execution
const buildDir = path.resolve(__dirname, "../build");
if (fs.existsSync(buildDir)) {
	const jsFiles = findJSFiles(buildDir);
	console.log(`Found ${jsFiles.length} JavaScript files in build directory`);

	jsFiles.forEach((file) => {
		removeCommentFromFile(file);
	});

	console.log("Finished removing comments from build files");

	// Remove empty JS chunks and clean up references
	// NOTE: Disabled — regex-based reference cleanup is fragile and can
	// leave dangling dynamic imports in SW precache manifests and lazy-loaded
	// components, causing "MIME type text/html" errors in production.
	// Empty chunks are harmless; deleting them creates real bugs.
	// removeEmptyChunks(buildDir);
} else {
	console.log("Build directory not found");
}
