import { execSync } from 'child_process';
import { existsSync, rmSync, copyFileSync, mkdirSync, statSync } from 'fs';
import { resolve } from 'path';

const zipName = 'selenium-recorder-extension.zip';
const distDir = resolve(process.cwd(), 'dist');
const docsDir = resolve(process.cwd(), 'docs');
const demoAppSrc = resolve(process.cwd(), 'test-pages', 'demo-app.html');
const demoAppDest = resolve(docsDir, 'demo-app.html');
const zipDocsDest = resolve(docsDir, zipName);

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

// Ensure docs directory exists
if (!existsSync(docsDir)) {
  mkdirSync(docsDir, { recursive: true });
}

// Synchronize zip package to docs directory for direct download portal
try {
  copyFileSync(zipName, zipDocsDest);
  const sizeKb = (statSync(zipDocsDest).size / 1024).toFixed(1);
  console.log(`[SYNC] Copied ${zipName} -> docs/${zipName} (${sizeKb} KB)`);
} catch (err) {
  console.error('[WARN] Failed to copy zip to docs:', err);
}

// Synchronize demo torture testbed to docs/demo-app.html
if (existsSync(demoAppSrc)) {
  try {
    copyFileSync(demoAppSrc, demoAppDest);
    console.log(`[SYNC] Copied test-pages/demo-app.html -> docs/demo-app.html`);
  } catch (err) {
    console.error('[WARN] Failed to copy demo-app.html to docs:', err);
  }
}
