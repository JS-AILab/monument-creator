const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

// Copy metadata.json to dist
fs.copyFileSync(path.join(__dirname, 'metadata.json'), path.join(distDir, 'metadata.json'));

// Build the React application with esbuild
esbuild.build({
  entryPoints: ['index.tsx'],
  bundle: true,
  outfile: 'dist/index.js',
  loader: { '.tsx': 'tsx' }, // Use 'tsx' loader for .tsx files
  format: 'esm', // Output as ES module
  // Define process.env.API_KEY for substitution during the build
  // Fallback to empty string if not set, for local development robustness
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
  },
  // Mark these imports as external, relying on the importmap in index.html
  external: ['react', 'react-dom', '@google/genai'],
  minify: true, // Minify the output JavaScript
  sourcemap: true, // Generate sourcemaps for easier debugging
  logLevel: 'info',
}).then(() => {
  // Read the original index.html
  let htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  // Update the script tag to point to the bundled JavaScript file
  htmlContent = htmlContent.replace('<script type="module" src="/index.tsx"></script>', '<script type="module" src="/index.js"></script>');
  // Write the modified HTML to the dist directory
  fs.writeFileSync(path.join(distDir, 'index.html'), htmlContent);
  console.log('Build complete and index.html updated in dist/');
}).catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});