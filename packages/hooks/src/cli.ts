#!/usr/bin/env node
import { defaultStateDir } from '@agentcrew/core';
import { handleEvent } from './handleEvent.js';
import { readStdin } from './stdin.js';

function parseArgs(argv: string[]): { evento: string; stateDir: string } {
  let evento = '';
  let stateDir = process.env.AGENTCREW_STATE_DIR || defaultStateDir();
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if ((a === '--evento' || a === '-e') && argv[i + 1]) {
      evento = argv[++i] ?? '';
    } else if (a === '--state-dir' && argv[i + 1]) {
      stateDir = argv[++i] ?? stateDir;
    }
  }
  return { evento, stateDir };
}

async function main(): Promise<void> {
  const { evento, stateDir } = parseArgs(process.argv);
  if (!evento) {
    process.stdout.write('{}');
    process.exit(0);
  }
  let raw = '';
  try {
    raw = await readStdin();
  } catch {
    raw = '';
  }
  const result = handleEvent(evento, raw, stateDir);
  process.stdout.write(result.stdout);
  process.exit(0);
}

main().catch(() => {
  process.stdout.write('{}');
  process.exit(0);
});
