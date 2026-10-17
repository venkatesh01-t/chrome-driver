import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { resolve } from 'path';

const zipName = 'selenium-recorder-extension.zip';
const distDir = resolve(process.cwd(), 'dist');

if (!existsSync(distDir)) {
  console.error('[ERROR] dist/ directory not found. Please run "npm run build" first.');
  process.exit(1);
}

if (existsSync(zipName)) {
  try {
    rmSync(zipName, { force: true });
  } catch {}
}

console.log(`[PACKAGE] Packaging extension into ${zipName}...`);

// Cross-platform packaging using standard python zipfile module or native zip
let packaged = false;

for (const cmd of ['python -m zipfile -c', 'python3 -m zipfile -c', 'zip -r']) {
  try {
    const fullCmd = cmd.includes('zipfile')
      ? `${cmd} ${zipName} dist`
      : `${cmd} ${zipName} dist/*`;
    execSync(fullCmd, { stdio: 'inherit' });
    packaged = true;
    break;
  } catch {
    // try next command
  }
}

if (!packaged) {
  // Fallback for Windows PowerShell if python/zip not in path
  try {
    execSync(
      `powershell -Command "Compress-Archive -Path dist/* -DestinationPath ${zipName} -Force"`,
      { stdio: 'inherit' }
    );
    packaged = true;
  } catch (err) {
    console.error('[ERROR] Failed to package zip archive:', err);
    process.exit(1);
  }
}

console.log(`[SUCCESS] Extension successfully packaged: ${zipName}`);
