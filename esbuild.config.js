import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url'; // Required for __dirname equivalent in ESM

// Recreate __filename and __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.join(__dirname, 'public');

console.log('Starting build process...');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
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
  outfile: path.join(outputDir, 'index.js'),
  loader: { '.tsx': 'tsx' },
  format: 'esm',
  jsx: 'automatic',
  target: 'esnext',
  // Define environment variables for client-side code
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
    'process.env.GOOGLE_MAPS_API_KEY': JSON.stringify(process.env.GOOGLE_MAPS_API_KEY || ''),
    'process.env.RECAPTCHA_SITE_KEY': JSON.stringify(process.env.RECAPTCHA_SITE_KEY || ''), // Added reCAPTCHA Site Key
  },
  // Mark these imports as external, relying on the importmap in index.html
  external: ['react', 'react-dom', 'react-dom/client', '@google/genai', 'react/jsx-runtime'],
  minify: true,
  sourcemap: true,
  logLevel: 'info',
}).then(() => {
  console.log('esbuild bundling complete. Output: public/index.js');
}).catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});