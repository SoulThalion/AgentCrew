import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(root, '..');
const require = createRequire(import.meta.url);
const electronPath = require('electron');

function run(cmd, args, opts = {}) {
  return spawn(cmd, args, {
    cwd: appRoot,
    stdio: 'inherit',
    shell: true,
    ...opts,
  });
}

// build electron main/preload first
const tsc = spawn('npx', ['tsc', '-p', 'tsconfig.electron.json'], {
  cwd: appRoot,
  stdio: 'inherit',
  shell: true,
});

tsc.on('exit', (code) => {
  if (code !== 0) process.exit(code ?? 1);

  const vite = run('npx', ['vite', '--port', '5173']);
  const wait = spawn(
    'npx',
    ['wait-on', 'http://127.0.0.1:5173', '--timeout', '60000'],
    { cwd: appRoot, shell: true, stdio: 'inherit' },
  );

  wait.on('exit', (wcode) => {
    if (wcode !== 0) {
      vite.kill();
      process.exit(wcode ?? 1);
    }
    const electron = spawn(electronPath, ['.'], {
      cwd: appRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        AGENTCREW_PANEL_DEV: '1',
        ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
      },
    });
    electron.on('exit', (ecode) => {
      vite.kill();
      process.exit(ecode ?? 0);
    });
  });
});
