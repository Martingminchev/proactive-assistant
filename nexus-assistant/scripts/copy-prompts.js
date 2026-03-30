// Copy prompt templates to dist for runtime loading
// Run after tsc build so personality-prompt-builder finds them at dist/shared/prompts
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../src/shared/prompts');
const dest = path.join(__dirname, '../dist/shared/prompts');

if (!fs.existsSync(src)) {
  console.warn('[copy-prompts] Source prompts dir not found:', src);
  process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log('[copy-prompts] Copied prompts to', dest);
