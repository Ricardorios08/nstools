const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'frontend/dist');
const dest = path.join(__dirname, 'dist');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

if (fs.existsSync(src)) {
  console.log(`Copying ${src} to ${dest}...`);
  // Clean dest first
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  copyRecursiveSync(src, dest);
  console.log('Copy complete!');
} else {
  console.error(`Source directory ${src} does not exist.`);
  process.exit(1);
}
