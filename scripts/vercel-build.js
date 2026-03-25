const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const clientBuildDir = path.join(rootDir, 'client', 'build');
const publicDir = path.join(rootDir, 'public');

const removeDirContents = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  for (const entry of fs.readdirSync(dirPath)) {
    const entryPath = path.join(dirPath, entry);
    fs.rmSync(entryPath, { recursive: true, force: true });
  }
};

const copyDir = (sourceDir, destinationDir) => {
  fs.mkdirSync(destinationDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      copyDir(sourcePath, destinationPath);
    } else {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
};

if (!fs.existsSync(clientBuildDir)) {
  throw new Error(`Client build directory not found: ${clientBuildDir}`);
}

fs.mkdirSync(publicDir, { recursive: true });
removeDirContents(publicDir);
copyDir(clientBuildDir, publicDir);

console.log('Copied client/build to public for Vercel deployment.');
