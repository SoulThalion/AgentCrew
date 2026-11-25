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

  it('respuesta con ? en URL → cierre, no pregunta', () => {
    handleEvent(
      'prompt',
      JSON.stringify({ conversation_id: 'url1', prompt: 'x', composer_mode: 'agent' }),
      dir,
    );
    handleEvent(
      'respuesta',
      JSON.stringify({
        conversation_id: 'url1',
        text: 'El callback redirige a `/settings?drive=connected`. Hace falta un dominio fijo.',
      }),
      dir,
    );
    expect(fs.readFileSync(path.join(dir, 'ultima-url1.txt'), 'utf8').trim()).toBe('cierre');
    expect(fs.existsSync(path.join(dir, 'sonar-url1.txt'))).toBe(false);
    handleEvent(
      'stop',
      JSON.stringify({ conversation_id: 'url1', status: 'completed' }),
      dir,
    );
    expect(fs.readFileSync(path.join(dir, 'estado-url1.txt'), 'utf8').startsWith('terminado|')).toBe(
      true,
    );
    expect(fs.readFileSync(path.join(dir, 'sonar-url1.txt'), 'utf8').trim()).toBe('fin');
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

  it('pensamiento sin prompt/run no crea planificando fantasma', () => {
    handleEvent(
      'pensamiento',
      JSON.stringify({ conversation_id: 'ghost1' }),
      dir,
    );
    expect(fs.existsSync(path.join(dir, 'estado-ghost1.txt'))).toBe(false);
    handleEvent(
      'prompt',
      JSON.stringify({ conversation_id: 'ok1', prompt: 'x', composer_mode: 'agent' }),
      dir,
    );
    handleEvent(
      'pensamiento',
      JSON.stringify({ conversation_id: 'ok1' }),
      dir,
    );
    expect(fs.readFileSync(path.join(dir, 'estado-ok1.txt'), 'utf8').startsWith('planificando|')).toBe(
      true,
    );
  });

  it('espera-fin / leyendo de Task sin prompt no crea fantasma', () => {
    handleEvent(
      'espera-fin',
      JSON.stringify({ conversation_id: 'qa1', tool_name: 'AskQuestion' }),
      dir,
    );
    handleEvent(
      'leyendo',
      JSON.stringify({ conversation_id: 'qa1' }),
      dir,
    );
    handleEvent(
      'herramienta-fin',
      JSON.stringify({ conversation_id: 'qa1' }),
      dir,
    );
    expect(fs.existsSync(path.join(dir, 'estado-qa1.txt'))).toBe(false);
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

  it('shell-antes auto-run: shell flag, sin esperando/aprobacion/sonar', () => {
    handleEvent(
      'prompt',
      JSON.stringify({ conversation_id: 'sh1', prompt: 'x', composer_mode: 'agent' }),
      dir,
    );
    const r = handleEvent(
      'shell-antes',
      JSON.stringify({ conversation_id: 'sh1', command: 'npm test' }),
      dir,
    );
    expect(r.stdout).toBe('{"permission":"allow"}');
    expect(fs.readFileSync(path.join(dir, 'estado-sh1.txt'), 'utf8').startsWith('trabajando|')).toBe(
      true,
    );
    expect(fs.existsSync(path.join(dir, 'shell-sh1.txt'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'aprobacion-sh1.txt'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'sonar-sh1.txt'))).toBe(false);
  });

  it('shell-despues limpia shell; estado sigue trabajando sin sonar', () => {
    handleEvent(
      'prompt',
      JSON.stringify({ conversation_id: 'sh2', prompt: 'x', composer_mode: 'agent' }),
      dir,
    );
    handleEvent(
      'shell-antes',
      JSON.stringify({ conversation_id: 'sh2', command: 'ls' }),
      dir,
    );
    handleEvent(
      'shell-despues',
      JSON.stringify({ conversation_id: 'sh2', command: 'ls', output: 'ok' }),
      dir,
    );
    expect(fs.existsSync(path.join(dir, 'shell-sh2.txt'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'aprobacion-sh2.txt'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'sonar-sh2.txt'))).toBe(false);
    expect(fs.readFileSync(path.join(dir, 'estado-sh2.txt'), 'utf8').startsWith('trabajando|')).toBe(
      true,
    );
  });

  it('tool-fail Shell limpia shell; no inventa aprobación', () => {
    handleEvent(
      'prompt',
      JSON.stringify({ conversation_id: 'sh3', prompt: 'x', composer_mode: 'agent' }),
      dir,
    );
    handleEvent(
      'shell-antes',
      JSON.stringify({ conversation_id: 'sh3', command: 'rm -rf /' }),
      dir,
    );
    handleEvent(
      'tool-fail',
      JSON.stringify({
        conversation_id: 'sh3',
        tool_name: 'Shell',
        failure_type: 'permission_denied',
      }),
      dir,
    );
    expect(fs.existsSync(path.join(dir, 'shell-sh3.txt'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'aprobacion-sh3.txt'))).toBe(false);
    expect(fs.readFileSync(path.join(dir, 'estado-sh3.txt'), 'utf8').startsWith('trabajando|')).toBe(
      true,
    );
  });

  it('aprobacion smart → esperando + sonar + said (no doble grace)', () => {
    handleEvent(
      'prompt',
      JSON.stringify({ conversation_id: 'sm1', prompt: 'x', composer_mode: 'agent' }),
      dir,
    );
    handleEvent(
      'aprobacion',
      JSON.stringify({
        conversation_id: 'sm1',
        tool_name: 'Shell',
        request_smart_mode_approval: true,
      }),
      dir,
    );
    expect(fs.readFileSync(path.join(dir, 'estado-sm1.txt'), 'utf8').startsWith('esperando|')).toBe(
      true,
    );
    expect(fs.readFileSync(path.join(dir, 'sonar-sm1.txt'), 'utf8').trim()).toBe('aprobacion');
    expect(fs.existsSync(path.join(dir, 'aprobacion-said-sm1.txt'))).toBe(true);
  });

  it('aprobacion Shell sin smart → no cambia a esperando', () => {
    handleEvent(
      'prompt',
      JSON.stringify({ conversation_id: 'sm2', prompt: 'x', composer_mode: 'agent' }),
      dir,
    );
    handleEvent(
      'aprobacion',
      JSON.stringify({ conversation_id: 'sm2', tool_name: 'Shell' }),
      dir,
    );
    expect(fs.readFileSync(path.join(dir, 'estado-sm2.txt'), 'utf8').startsWith('trabajando|')).toBe(
      true,
    );
    expect(fs.existsSync(path.join(dir, 'sonar-sm2.txt'))).toBe(false);
  });

  it('sessionEnd limpia estado del chat', () => {
    handleEvent(
      'prompt',
      JSON.stringify({ conversation_id: 'sub1', prompt: 'x', composer_mode: 'agent' }),
      dir,
    );
    expect(fs.existsSync(path.join(dir, 'estado-sub1.txt'))).toBe(true);
    handleEvent(
      'sessionEnd',
      JSON.stringify({ conversation_id: 'sub1' }),
      dir,
    );
    expect(fs.existsSync(path.join(dir, 'estado-sub1.txt'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'prompt-sub1.txt'))).toBe(false);
  });

  it('stop sin prompt/run no crea terminado fantasma', () => {
    handleEvent(
      'stop',
      JSON.stringify({ conversation_id: 'ghost-stop', status: 'completed' }),
      dir,
    );
    expect(fs.existsSync(path.join(dir, 'estado-ghost-stop.txt'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'sonar-ghost-stop.txt'))).toBe(false);
  });
});
