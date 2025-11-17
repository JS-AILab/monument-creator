const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..');
const distDir = path.join(sourceDir, 'dist');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}
if (!fs.existsSync(path.join(distDir, 'services'))) {
  fs.mkdirSync(path.join(distDir, 'services'));
}

// Read the template HTML
let htmlContent = fs.readFileSync(path.join(sourceDir, 'index.html'), 'utf8');

// Write the modified HTML to dist
fs.writeFileSync(path.join(distDir, 'index.html'), htmlContent);

// Copy other assets to dist
fs.copyFileSync(path.join(sourceDir, 'index.tsx'), path.join(distDir, 'index.tsx'));
fs.copyFileSync(path.join(sourceDir, 'App.tsx'), path.join(distDir, 'App.tsx'));
fs.copyFileSync(path.join(sourceDir, 'types.ts'), path.join(distDir, 'types.ts'));
fs.copyFileSync(path.join(sourceDir, 'services', 'geminiService.ts'), path.join(distDir, 'services', 'geminiService.ts'));
fs.copyFileSync(path.join(sourceDir, 'metadata.json'), path.join(distDir, 'metadata.json'));