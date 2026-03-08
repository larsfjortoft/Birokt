const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const AMBER = '#f59e0b';
const WHITE = '#ffffff';

async function generateIcon(size, filename) {
  const fontSize = Math.round(size * 0.55);
  const yOffset = Math.round(size * 0.05);

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${AMBER}" />
      <text x="50%" y="50%" dy="${yOffset}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${WHITE}" text-anchor="middle" dominant-baseline="central">B</text>
    </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(path.join(ASSETS_DIR, filename));
  console.log(`Generated ${filename} (${size}x${size})`);
}

async function generateSplashIcon(size, filename) {
  const circleR = Math.round(size * 0.42);
  const fontSize = Math.round(size * 0.45);
  const center = size / 2;
  const yOffset = Math.round(size * 0.04);

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${center}" cy="${center}" r="${circleR}" fill="${AMBER}" />
      <text x="50%" y="50%" dy="${yOffset}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${WHITE}" text-anchor="middle" dominant-baseline="central">B</text>
    </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(path.join(ASSETS_DIR, filename));
  console.log(`Generated ${filename} (${size}x${size})`);
}

async function main() {
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }

  await generateIcon(1024, 'icon.png');
  await generateIcon(1024, 'adaptive-icon.png');
  await generateSplashIcon(512, 'splash-icon.png');

  console.log('All assets generated successfully!');
}

main().catch((err) => {
  console.error('Failed to generate assets:', err);
  process.exit(1);
});
