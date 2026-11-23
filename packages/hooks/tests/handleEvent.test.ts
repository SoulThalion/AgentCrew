import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { handleEvent } from '../src/handleEvent.js';

describe('handleEvent', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentcrew-hooks-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('prompt → trabajando + continue', () => {
    const raw = JSON.stringify({
      conversation_id: 'c1',
      prompt: 'hola',
      composer_mode: 'agent',
    });
    const r = handleEvent('prompt', raw, dir);
    expect(r.stdout).toBe('{"continue":true}');
    const estado = fs.readFileSync(path.join(dir, 'estado-c1.txt'), 'utf8');
    expect(estado.startsWith('trabajando|')).toBe(true);
    expect(fs.existsSync(path.join(dir, 'run-c1.txt'))).toBe(true);
  });

  it('prompt plan → planificando', () => {
    const raw = JSON.stringify({
      conversation_id: 'p1',
      prompt: 'plan',
      composer_mode: 'plan',
    });
    handleEvent('prompt', raw, dir);
    expect(fs.readFileSync(path.join(dir, 'estado-p1.txt'), 'utf8').startsWith('planificando|')).toBe(
      true,
    );
  });

  it('stop completed → terminado + sonar fin', () => {
    handleEvent(
      'prompt',
      JSON.stringify({ conversation_id: 's1', prompt: 'x', composer_mode: 'agent' }),
      dir,
    );
    const r = handleEvent(
      'stop',
      JSON.stringify({ conversation_id: 's1', status: 'completed' }),
      dir,
    );
    expect(r.stdout).toBe('{}');
    expect(fs.readFileSync(path.join(dir, 'estado-s1.txt'), 'utf8').startsWith('terminado|')).toBe(
      true,
    );
    expect(fs.readFileSync(path.join(dir, 'sonar-s1.txt'), 'utf8').trim()).toBe('fin');
  });

  it('respuesta ? + stop → solo sonar pregunta (no fin)', () => {
    handleEvent(
      'prompt',
      JSON.stringify({ conversation_id: 'pq1', prompt: 'x', composer_mode: 'agent' }),
      dir,
    );
    handleEvent(
      'respuesta',
      JSON.stringify({ conversation_id: 'pq1', text: '¿Lo revisas?' }),
      dir,
    );
    expect(fs.readFileSync(path.join(dir, 'sonar-pq1.txt'), 'utf8').trim()).toBe('pregunta');
    handleEvent(
      'stop',
      JSON.stringify({ conversation_id: 'pq1', status: 'completed' }),
      dir,
    );
    expect(fs.readFileSync(path.join(dir, 'estado-pq1.txt'), 'utf8').startsWith('esperando|')).toBe(
      true,
    );
    expect(fs.readFileSync(path.join(dir, 'sonar-pq1.txt'), 'utf8').trim()).toBe('pregunta');
  });

  it('espera AskQuestion + stop → solo sonar pregunta (no fin)', () => {
    handleEvent(
      'prompt',
      JSON.stringify({ conversation_id: 'aq1', prompt: 'x', composer_mode: 'agent' }),
      dir,
    );
    handleEvent(
      'espera',
      JSON.stringify({ conversation_id: 'aq1', tool_name: 'AskQuestion' }),
      dir,
    );
    expect(fs.readFileSync(path.join(dir, 'sonar-aq1.txt'), 'utf8').trim()).toBe('pregunta');
    handleEvent(
      'stop',
      JSON.stringify({ conversation_id: 'aq1', status: 'completed' }),
      dir,
    );
    expect(fs.readFileSync(path.join(dir, 'estado-aq1.txt'), 'utf8').startsWith('esperando|')).toBe(
      true,
    );
    expect(fs.readFileSync(path.join(dir, 'sonar-aq1.txt'), 'utf8').trim()).toBe('pregunta');
  });

  it('stop status raro/vacío → detenido (no deja trabajando)', () => {
    handleEvent(
      'prompt',
      JSON.stringify({ conversation_id: 's2', prompt: 'x', composer_mode: 'agent' }),
      dir,
    );
    handleEvent(
      'stop',
      JSON.stringify({ conversation_id: 's2', status: 'cancelled' }),
      dir,
    );
    expect(fs.readFileSync(path.join(dir, 'estado-s2.txt'), 'utf8').startsWith('detenido|')).toBe(
      true,
    );
    expect(fs.existsSync(path.join(dir, 'run-s2.txt'))).toBe(false);
  });

  it('stop error → pending sin sonar; re-prompt cancela (error seguido)', () => {
    handleEvent(
      'prompt',
      JSON.stringify({ conversation_id: 'e1', prompt: 'x', composer_mode: 'agent' }),
      dir,
    );
    handleEvent(
      'stop',
      JSON.stringify({ conversation_id: 'e1', status: 'error' }),
      dir,
    );
    expect(fs.existsSync(path.join(dir, 'error-pending-e1.txt'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'sonar-e1.txt'))).toBe(false);
    expect(fs.readFileSync(path.join(dir, 'estado-e1.txt'), 'utf8').startsWith('detenido|')).toBe(
      true,
    );
    handleEvent(
      'prompt',
      JSON.stringify({ conversation_id: 'e1', prompt: 'x', composer_mode: 'agent' }),
      dir,
    );
    expect(fs.existsSync(path.join(dir, 'error-pending-e1.txt'))).toBe(false);
    expect(fs.readFileSync(path.join(dir, 'estado-e1.txt'), 'utf8').startsWith('trabajando|')).toBe(
      true,
    );
  });

  it('leyendo solo si trabajando', () => {
    handleEvent(
      'prompt',
      JSON.stringify({ conversation_id: 'l1', prompt: 'x', composer_mode: 'agent' }),
      dir,
    );
    const r = handleEvent(
      'leyendo',
      JSON.stringify({ conversation_id: 'l1' }),
      dir,
    );
    expect(r.stdout).toBe('{"permission":"allow"}');
    expect(fs.readFileSync(path.join(dir, 'estado-l1.txt'), 'utf8').startsWith('leyendo|')).toBe(
      true,
    );
  });

  it('respuesta con ? → esperando', () => {
    handleEvent(
      'prompt',
      JSON.stringify({ conversation_id: 'q1', prompt: 'x', composer_mode: 'agent' }),
      dir,
    );
    handleEvent(
      'respuesta',
      JSON.stringify({ conversation_id: 'q1', text: '¿Sigues?' }),
      dir,
    );
    expect(fs.readFileSync(path.join(dir, 'estado-q1.txt'), 'utf8').startsWith('esperando|')).toBe(
      true,
    );
  });
});
