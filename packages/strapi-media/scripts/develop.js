/**
 * Custom develop script for Strapi 5
 *
 * Strapi 5 has a bug where it looks for config in dist/config instead of config/
 * This script watches for dist directory changes and copies config files
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const configDir = path.join(__dirname, '..', 'config');
const distConfigDir = path.join(__dirname, '..', 'dist', 'config');

function copyConfig() {
  if (!fs.existsSync(distConfigDir)) {
    fs.mkdirSync(distConfigDir, { recursive: true });
  }

  const files = fs.readdirSync(configDir);
  files.forEach(file => {
    const src = path.join(configDir, file);
    const dest = path.join(distConfigDir, file);
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, dest);
    }
  });
  console.log('[develop.js] Config files copied to dist/config');
}

// Initial copy
copyConfig();

// Watch for dist directory being cleaned
const distDir = path.join(__dirname, '..', 'dist');
let watching = false;

function startWatching() {
  if (watching) return;
  watching = true;

  // Watch dist directory
  const watcher = fs.watch(distDir, { recursive: false }, (eventType, filename) => {
    // When dist is cleaned and recreated, copy config again
    if (eventType === 'rename' || !fs.existsSync(distConfigDir)) {
      setTimeout(() => {
        copyConfig();
      }, 100);
    }
  });

  // Also watch for config directory not existing
  setInterval(() => {
    if (fs.existsSync(distDir) && !fs.existsSync(distConfigDir)) {
      copyConfig();
    }
  }, 500);
}

// Start strapi develop
const strapi = spawn('npx', ['strapi', 'develop'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env }
});

// Start watching after a short delay (after strapi cleans dist)
setTimeout(startWatching, 1000);

strapi.on('close', (code) => {
  process.exit(code);
});
