import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeEstado, writePrompt, writeTitulo, readTitulo } from '@agentcrew/core';
import { matchAndSaveTitles } from '../src/electron/learnTitles.js';

describe('matchAndSaveTitles issue #5', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentcrew-learn-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('activo huérfano + foco idle sin prompt match → no escribe titulo al pin', () => {
    writeEstado(dir, 'neu', 'trabajando');
    writePrompt(dir, 'neu', 'Implement currency and date columns in the grid');
    matchAndSaveTitles(dir, [
      'Codebase Memory MCP usage, anclado',
      '*Jira ticket 4216 review',
      'Feature table formatting',
    ]);
    expect(readTitulo(dir, 'neu').trim()).toBe('');
    expect(fs.existsSync(path.join(dir, 'titulo-neu.txt'))).toBe(false);
  });

  it('activo huérfano + prompt fuzzy único → sticky en ese tab', () => {
    writeEstado(dir, 'vivo', 'trabajando');
    writePrompt(dir, 'vivo', 'Sidebar footer sync layout');
    matchAndSaveTitles(dir, [
      '*Sidebar footer sync',
      'MiraiWay phase 4',
    ]);
    expect(readTitulo(dir, 'vivo').trim()).toBe('Sidebar footer sync');
  });

  it('pool surplus activo no asigna a freeUi por orden sin prompt match', () => {
    writeEstado(dir, 'a', 'terminado');
    writeTitulo(dir, 'a', 'Same sticky');
    writePrompt(dir, 'a', 'Same sticky');
    // b activo con sticky duplicado → entra en pool (surplus)
    writeEstado(dir, 'b', 'trabajando');
    writeTitulo(dir, 'b', 'Same sticky');
    writePrompt(dir, 'b', 'Completely unrelated prompt about whales');
    matchAndSaveTitles(dir, ['Same sticky', 'Free other tab']);
    expect(readTitulo(dir, 'b').trim()).not.toBe('Free other tab');
  });
});
