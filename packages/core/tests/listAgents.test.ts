import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  listAgents,
  writeEstado,
  writeTitulo,
  writeFrase,
  writePrompt,
  writeUltima,
  markRun,
  clearRun,
  markSubagente,
  writeModo,
  markVisto,
  isVisto,
} from '../src/index.js';

describe('listAgents + stateStore', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentcrew-core-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('escribe estado y lista ordenado por prioridad', () => {
    writeEstado(dir, 'chat-a', 'trabajando');
    writePrompt(dir, 'chat-a', 'tarea a');
    writeTitulo(dir, 'chat-a', 'Alpha');
    writeFrase(dir, 'chat-a', 'voy');
    writeEstado(dir, 'chat-b', 'esperando');
    writeTitulo(dir, 'chat-b', 'Beta');

    const list = listAgents(dir);
    expect(list).toHaveLength(2);
    expect(list[0]?.id).toBe('chat-b');
    expect(list[0]?.state).toBe('esperando');
    expect(list[0]?.order).toBe(0);
    expect(list[1]?.id).toBe('chat-a');
    expect(list[1]?.title).toBe('Alpha');
    expect(list[1]?.phrase).toBe('voy');
  });

  it('run sin estado → trabajando (o planificando)', () => {
    markRun(dir, 'solo-run');
    writeModo(dir, 'solo-run', 'plan');
    const list = listAgents(dir);
    expect(list).toHaveLength(1);
    expect(list[0]?.state).toBe('planificando');
  });

  it('subagentes cuenta archivos sub-', () => {
    writePrompt(dir, 'padre', 'tarea con QA');
    markSubagente(dir, 'padre', 't1');
    markSubagente(dir, 'padre', 't2');
    const list = listAgents(dir);
    expect(list[0]?.state).toBe('subagentes');
    expect(list[0]?.subagentCount).toBe(2);
  });

  it('ignora .tmp', () => {
    writeEstado(dir, 'real', 'terminado');
    fs.writeFileSync(path.join(dir, 'estado-fake.txt.tmp'), 'trabajando|x');
    expect(listAgents(dir)).toHaveLength(1);
  });

  it('formato archivo estado valor|ISO', () => {
    writeEstado(dir, 'x', 'error', new Date('2026-01-15T12:00:00.000Z'));
    const raw = fs.readFileSync(path.join(dir, 'estado-x.txt'), 'utf8');
    expect(raw.startsWith('error|2026-01-15T12:00:00.000Z')).toBe(true);
  });

  it('título: prompt si no hay titulo-* (no UUID crudo)', () => {
    writeEstado(dir, 'abc-def-123', 'trabajando');
    writePrompt(dir, 'abc-def-123', 'Arreglar footer del panel AgentCrew');
    const list = listAgents(dir);
    expect(list[0]?.title).toBe('Arreglar footer del panel AgentCrew');
  });

  it('título aprendido gana a prompt', () => {
    writeEstado(dir, 'c1', 'trabajando');
    writePrompt(dir, 'c1', 'prompt largo');
    writeTitulo(dir, 'c1', 'Nombre UI Cursor');
    expect(listAgents(dir)[0]?.title).toBe('Nombre UI Cursor');
  });

  it('sin run + ultima cierre + trabajando → detenido', () => {
    writeEstado(dir, 'idle1', 'trabajando');
    writePrompt(dir, 'idle1', 'ya cerró');
    writeUltima(dir, 'idle1', 'cierre');
    clearRun(dir, 'idle1');
    expect(listAgents(dir)[0]?.state).toBe('detenido');
  });

  it('planificando sin prompt ni run → fantasma, no lista', () => {
    writeEstado(dir, 'ghost-qa', 'planificando');
    writeTitulo(dir, 'ghost-qa', 'MiraiWay phase 4');
    expect(listAgents(dir).map((a) => a.id)).not.toContain('ghost-qa');
    expect(fs.existsSync(path.join(dir, 'estado-ghost-qa.txt'))).toBe(false);
  });

  it('estado activo stale no revive por run-*', () => {
    const old = new Date(Date.now() - 4 * 3_600_000);
    writeEstado(dir, 'viejo', 'trabajando', old);
    markRun(dir, 'viejo', old);
    expect(listAgents(dir, { now: new Date() }).map((a) => a.id)).not.toContain('viejo');
  });

  it('terminado sin leer → terminado', () => {
    writeEstado(dir, 'fin1', 'terminado');
    expect(listAgents(dir)[0]?.state).toBe('terminado');
  });

  it('terminado leído → detenido', () => {
    writeEstado(dir, 'fin2', 'terminado');
    markVisto(dir, 'fin2');
    expect(isVisto(dir, 'fin2')).toBe(true);
    expect(listAgents(dir)[0]?.state).toBe('detenido');
  });

  it('terminado abierto → atento y marca visto', () => {
    writeEstado(dir, 'fin3', 'terminado');
    const list = listAgents(dir, { focusedIds: ['fin3'] });
    expect(list[0]?.state).toBe('atento');
    expect(isVisto(dir, 'fin3')).toBe(true);
  });

  it('terminado leído + cerrado → detenido; reabrir → atento', () => {
    writeEstado(dir, 'fin4', 'terminado');
    markVisto(dir, 'fin4');
    expect(listAgents(dir)[0]?.state).toBe('detenido');
    expect(listAgents(dir, { focusedIds: ['fin4'] })[0]?.state).toBe('atento');
  });
});
