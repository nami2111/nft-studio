import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Build the WASM module using wasm-pack
function buildWasm() {
  console.log('Building WASM module...');

  const wasmDir = join(__dirname, '../src/lib/wasm');
  const outDir = join(__dirname, '../src/lib/wasm/pkg');

  // Create output directory if it doesn't exist
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  try {
    // Build WASM package
    execSync('wasm-pack build --target web', {
      cwd: wasmDir,
      stdio: 'inherit'
    });

    console.log('WASM module built successfully!');
  } catch (error) {
    console.error('Failed to build WASM module:', error.message);
    process.exit(1);
  }
}

buildWasm();