const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const distIndex = path.join(repoRoot, 'dist', 'index.html');

const frontendDir = path.join(repoRoot, 'frontend');
const frontendSrcDir = path.join(frontendDir, 'src');
const frontendPublicDir = path.join(frontendDir, 'public');
const frontendViteConfig = path.join(frontendDir, 'vite.config.js');
const frontendPkg = path.join(frontendDir, 'package.json');

function safeStatMtimeMs(p) {
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return 0;
  }
}

function maxMtimeMsInDir(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let max = 0;
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        max = Math.max(max, maxMtimeMsInDir(full));
      } else if (ent.isFile()) {
        max = Math.max(max, safeStatMtimeMs(full));
      }
    }
    return max;
  } catch {
    return 0;
  }
}

function shouldRebuildFrontend() {
  const distMtime = safeStatMtimeMs(distIndex);
  if (!distMtime) return true;

  const srcMtime = maxMtimeMsInDir(frontendSrcDir);
  const publicMtime = maxMtimeMsInDir(frontendPublicDir);
  const cfgMtime = safeStatMtimeMs(frontendViteConfig);
  const pkgMtime = safeStatMtimeMs(frontendPkg);

  const latest = Math.max(srcMtime, publicMtime, cfgMtime, pkgMtime);
  return latest > distMtime;
}

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    cwd: repoRoot,
    ...opts,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  const skipWebBuild = String(process.env.SKIP_WEB_BUILD || '').toLowerCase() === 'true';

  if (!skipWebBuild) {
    const needBuild = !fs.existsSync(distIndex) || shouldRebuildFrontend();
    if (needBuild) {
      console.log('[start] building Vue frontend (dist missing or frontend changed)...');
      run('npm', ['run', 'build:web']);
    }
  }

  run('node', ['server.js']);
}

main();
