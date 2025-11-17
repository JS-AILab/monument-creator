const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');

console.log('Starting build process...');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true }); // Ensure recursive flag for nested paths
  console.log(`Created dist directory: ${distDir}`);
} else {
  console.log(`Dist directory already exists: ${distDir}`);
}

// Copy metadata.json to dist
const metadataSrc = path.join(__dirname, 'metadata.json');
const metadataDest = path.join(distDir, 'metadata.json');
fs.copyFileSync(metadataSrc, metadataDest);
console.log(`Copied ${metadataSrc} to ${metadataDest}`);

// Copy index.html to dist (assuming it's already updated to point to index.js)
const htmlSrc = path.join(__dirname, 'index.html');
const htmlDest = path.join(distDir, 'index.html');
fs.copyFileSync(htmlSrc, htmlDest);
console.log(`Copied ${htmlSrc} to ${htmlDest}`);


// Build the React application with esbuild
esbuild.build({
  entryPoints: ['index.tsx'],
  bundle: true,
  outfile: path.join(distDir, 'index.js'), // Ensure outfile path is absolute or relative to cwd
  loader: { '.tsx': 'tsx' },
  format: 'esm',
  // Define process.env.API_KEY for substitution during the build
  // Fallback to empty string if not set, for local development robustness
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
  },
  // Mark these imports as external, relying on the importmap in index.html
  external: ['react', 'react-dom/client', '@google/genai', 'react/jsx-runtime'],
  minify: true, // Minify the output JavaScript
  sourcemap: true, // Generate sourcemaps for easier debugging
  logLevel: 'info',
}).then(() => {
  console.log('esbuild bundling complete. Output: dist/index.js');
}).catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});