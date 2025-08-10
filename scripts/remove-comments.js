import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to recursively find all .js files in a directory
function findJSFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = [...results, ...findJSFiles(file)];
    } else if (path.extname(file) === '.js') {
      results.push(file);
    }
  });
  return results;
}

// Function to remove the comment from a file
function removeCommentFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const modifiedContent = content.replace(/\/\/ \.\.\. \(unchanged parts of the component\)/g, '');
    if (content !== modifiedContent) {
      fs.writeFileSync(filePath, modifiedContent, 'utf8');
      console.log(`Removed comment from ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

// Main execution
const buildDir = path.resolve(__dirname, '../build');
if (fs.existsSync(buildDir)) {
  const jsFiles = findJSFiles(buildDir);
  console.log(`Found ${jsFiles.length} JavaScript files in build directory`);
  
  jsFiles.forEach(file => {
    removeCommentFromFile(file);
  });
  
  console.log('Finished removing comments from build files');
} else {
  console.log('Build directory not found');
}