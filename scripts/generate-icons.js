import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Source icon at project root
const sourceIcon = join(projectRoot, 'home.png');

// Output directory
const outputDir = join(projectRoot, 'public');

// Ensure output directory exists
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Icon sizes to generate
const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 }, // iOS standard
  { name: 'apple-touch-icon-152.png', size: 152 }, // iPad
  { name: 'apple-touch-icon-167.png', size: 167 }, // iPad Pro
  { name: 'apple-touch-icon-180.png', size: 180 }, // iPhone
];

async function generateIcons() {
  console.log('🎨 Generating PWA icons from home.png...');

  if (!existsSync(sourceIcon)) {
    console.error(`❌ Source icon not found at: ${sourceIcon}`);
    process.exit(1);
  }

  try {
    for (const { name, size } of sizes) {
      const outputPath = join(outputDir, name);

      await sharp(sourceIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(outputPath);

      console.log(`✓ Generated ${name} (${size}x${size})`);
    }

    console.log('✅ All icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
