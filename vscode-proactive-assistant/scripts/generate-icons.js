/**
 * Icon Generation Script
 * Converts SVG source files to PNG format for the VS Code extension
 * 
 * Usage: node generate-icons.js
 * Requires: npm install sharp
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  Sharp library not found. Please install it first:              ║
║                                                                 ║
║  npm install sharp                                              ║
║                                                                 ║
║  Or use an online converter for the SVG files:                  ║
║  - icon-source.svg → icon.png (256x256)                         ║
║  - logo-source.svg → logo.png (128x128)                         ║
╚════════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

const RESOURCES_DIR = path.join(__dirname, '..', 'resources');

const ICONS = [
  {
    name: 'icon.png',
    source: 'icon-source.svg',
    width: 256,
    height: 256
  },
  {
    name: 'logo.png',
    source: 'logo-source.svg',
    width: 128,
    height: 128
  }
];

async function generateIcons() {
  console.log('🎨 Generating icons for Proactive AI Assistant...\n');

  for (const icon of ICONS) {
    const sourcePath = path.join(RESOURCES_DIR, icon.source);
    const outputPath = path.join(RESOURCES_DIR, icon.name);

    // Check if source exists
    if (!fs.existsSync(sourcePath)) {
      console.error(`❌ Source file not found: ${icon.source}`);
      continue;
    }

    try {
      // Read SVG
      const svgBuffer = fs.readFileSync(sourcePath);

      // Convert to PNG using sharp
      await sharp(svgBuffer)
        .resize(icon.width, icon.height, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png({
          compressionLevel: 9,
          adaptiveFiltering: true,
          force: true
        })
        .toFile(outputPath);

      console.log(`✅ Generated ${icon.name} (${icon.width}x${icon.height})`);
    } catch (error) {
      console.error(`❌ Failed to generate ${icon.name}:`, error.message);
    }
  }

  console.log('\n✨ Icon generation complete!');
}

// Run generation
generateIcons().catch(console.error);
