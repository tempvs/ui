const fs = require('fs');
const path = require('path');

const packageRoot = path.join(
  __dirname,
  '..',
  'node_modules',
  '@formatjs',
  'fast-memoize'
);

const sourcePath = path.join(packageRoot, 'index.ts');
const fallbackJsPath = path.join(packageRoot, 'index.js');

if (!fs.existsSync(packageRoot) || fs.existsSync(sourcePath)) {
  process.exit(0);
}

let source = `// Generated during postinstall to satisfy webpack source-map-loader.\n`;

if (fs.existsSync(fallbackJsPath)) {
  source += fs.readFileSync(fallbackJsPath, 'utf8');
}

fs.writeFileSync(sourcePath, source);
