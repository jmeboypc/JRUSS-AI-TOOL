const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Set TLS ignore for electron downloads if needed
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

console.log('1. Building production web assets...');
try {
  execSync('npm run build', { stdio: 'inherit' });
} catch (e) {
  console.error('Vite build failed:', e.message);
  process.exit(1);
}

console.log('2. Bundling Electron application folder...');
try {
  const ignorePatterns = [
    'src',
    'node_modules/\\.bin',
    'node_modules/electron',
    'node_modules/electron-builder',
    'release',
    'vite.config.js',
    'pack.js',
    'pack.cjs',
    'build-msi.cjs',
    'task.md',
    'implementation_plan.md',
    'walkthrough.md',
    'create-ico.js',
    'create-ico.cjs',
    'installer_dialog.bmp',
    'installer_banner.bmp',
    'license.rtf'
  ].join('|');

  // Ensure sibling temp directory exists
  const tempDir = path.join(__dirname, '..', 'JRUSS_AI_TOOL_Temp');
  fs.mkdirSync(tempDir, { recursive: true });

  const cmd = `npx electron-packager . "JRUSS AI TOOL" --platform=win32 --arch=x64 --out=release --overwrite --tmpdir="${tempDir}" --app-version="2.5.1" --build-version="2.5.1" --icon=icon.ico --ignore="${ignorePatterns}"`;
  execSync(cmd, { stdio: 'inherit' });
} catch (e) {
  console.error('Electron packager failed:', e.message);
  process.exit(1);
}

console.log('3. Running WiX compiler to generate MSI installer...');
try {
  execSync('node build-msi.cjs', { stdio: 'inherit' });
  console.log('JRUSS AI TOOL v2.5.1 MSI installer compiled successfully in release/ folder!');
} catch (e) {
  console.error('MSI compiler failed:', e.message);
  process.exit(1);
}
