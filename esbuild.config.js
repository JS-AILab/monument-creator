import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url'; // Required for __dirname equivalent in ESM

// Recreate __filename and __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.join(__dirname, 'public'); // Changed from 'dist' to 'public'

console.log('Starting build process...');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true }); // Ensure recursive flag for nested paths
  console.log(`Created output directory: ${outputDir}`);
} else {
  console.log(`Output directory already exists: ${outputDir}`);
}

// Copy metadata.json to public
const metadataSrc = path.join(__dirname, 'metadata.json');
const metadataDest = path.join(outputDir, 'metadata.json');
fs.copyFileSync(metadataSrc, metadataDest);
console.log(`Copied ${metadataSrc} to ${metadataDest}`);

// Copy index.html to public
const htmlSrc = path.join(__dirname, 'index.html');
const htmlDest = path.join(outputDir, 'index.html');
fs.copyFileSync(htmlSrc, htmlDest);
console.log(`Copied ${htmlSrc} to ${htmlDest}`);


// Build the React application with esbuild
esbuild.build({
  entryPoints: ['index.tsx'],
  bundle: true,
  outfile: path.join(outputDir, 'index.js'), // Ensure outfile path is absolute or relative to cwd
  loader: { '.tsx': 'tsx' },
  format: 'esm',
  // Explicitly set JSX factory to 'automatic'
  jsx: 'automatic',
  // Target modern browsers
  target: 'esnext',
  // Define process.env.API_KEY for substitution during the build
  // Fallback to empty string if not set, for local development robustness
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
  },
  // Mark these imports as external, relying on the importmap in index.html
  external: ['react', 'react-dom', 'react-dom/client', '@google/genai', 'react/jsx-runtime'],
  minify: true, // Minify the output JavaScript
  sourcemap: true, // Generate sourcemaps for easier debugging
  logLevel: 'info',
}).then(() => {
  console.log('esbuild bundling complete. Output: public/index.js');
}).catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});