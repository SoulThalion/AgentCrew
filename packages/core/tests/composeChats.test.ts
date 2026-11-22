import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  composeChats,
  writeEstado,
  writeTitulo,
  markVisto,
  clearRun,
} from '../src/index.js';

describe('composeChats', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentcrew-compose-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('una fila por chat UI; sin estado → detenido', () => {
    writeEstado(dir, 'a1', 'trabajando');
    writeTitulo(dir, 'a1', 'Chat activo');
    const list = composeChats(dir, {
      uiTitles: ['Chat activo', 'Otro idle'],
      focusedTitles: ['Chat activo'],
    });
    expect(list).toHaveLength(2);
    expect(list[0]?.state).toBe('trabajando');
    expect(list[0]?.title).toBe('Chat activo');
    expect(list[1]?.state).toBe('detenido');
    expect(list[1]?.title).toBe('Otro idle');
  });

  it('terminado sin leer → terminado (no detenido)', () => {
    writeEstado(dir, 'fin', 'terminado');
    writeTitulo(dir, 'fin', 'Hecho');
    clearRun(dir, 'fin');
    const list = composeChats(dir, {
      uiTitles: ['Hecho'],
      focusedTitles: [],
    });
    expect(list[0]?.state).toBe('terminado');
  });

  it('terminado leído + no foco → detenido', () => {
    writeEstado(dir, 'fin', 'terminado');
    writeTitulo(dir, 'fin', 'Hecho');
    markVisto(dir, 'fin');
    const list = composeChats(dir, {
      uiTitles: ['Hecho'],
      focusedTitles: [],
    });
    expect(list[0]?.state).toBe('detenido');
  });

  it('título duplicado: solo el activo en franja (sin orphan terminado)', () => {
    writeEstado(dir, 'old', 'terminado');
    writeTitulo(dir, 'old', 'Mismo');
    writeEstado(dir, 'neu', 'trabajando');
    writeTitulo(dir, 'neu', 'Mismo');
    const list = composeChats(dir, {
      uiTitles: ['Mismo'],
      focusedTitles: ['Mismo'],
    });
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('neu');
    expect(list[0]?.state).toBe('trabajando');
  });

  it('título duplicado + otro chat enfocado: terminado unread se ve (no detenido)', () => {
    writeEstado(dir, 'old', 'terminado');
    writeTitulo(dir, 'old', 'Mismo');
    writeEstado(dir, 'neu', 'terminado');
    writeTitulo(dir, 'neu', 'Mismo');
    clearRun(dir, 'old');
    clearRun(dir, 'neu');
    const list = composeChats(dir, {
      uiTitles: ['Mismo', 'Otro abierto'],
      focusedTitles: ['Otro abierto'],
    });
    expect(list).toHaveLength(2);
    const row = list.find((a) => a.title === 'Mismo');
    expect(row?.state).toBe('terminado');
    expect(row?.id === 'old' || row?.id === 'neu').toBe(true);
    expect(list.some((a) => a.title === 'Otro abierto' && a.state === 'atento')).toBe(
      true,
    );
    expect(list.filter((a) => a.title === 'Mismo')).toHaveLength(1);
  });

  it('terminado unread sin título UI sigue orphan (sin match 1:1)', () => {
    writeEstado(dir, 'cerrado', 'terminado');
    writeTitulo(dir, 'cerrado', 'Ya no está abierto');
    writeEstado(dir, 'otro', 'terminado');
    writeTitulo(dir, 'otro', 'Tampoco abierto');
    const list = composeChats(dir, {
      uiTitles: ['Chat idle'],
      focusedTitles: [],
    });
    expect(list.some((a) => a.title === 'Chat idle' && a.state === 'detenido')).toBe(
      true,
    );
    expect(list.some((a) => a.id === 'cerrado' && a.state === 'terminado')).toBe(
      true,
    );
    expect(list.some((a) => a.id === 'otro' && a.state === 'terminado')).toBe(true);
  });

  it('idle enfocado sin agente → atento', () => {
    const list = composeChats(dir, {
      uiTitles: ['Solo UI'],
      focusedTitles: ['Solo UI'],
    });
    expect(list[0]?.state).toBe('atento');
  });

  it('activo con título duplicado rellena UI libre (no placeholder detenido)', () => {
    writeEstado(dir, 'proj', 'trabajando');
    writeTitulo(dir, 'proj', 'Project');
    writeEstado(dir, 'mirai', 'trabajando');
    writeTitulo(dir, 'mirai', 'Project'); // sticky malo
    const list = composeChats(dir, {
      uiTitles: ['MiraiWay phase 4', 'Project'],
      focusedTitles: ['Project'],
    });
    const mirai = list.find((a) => a.title === 'MiraiWay phase 4');
    const proj = list.find((a) => a.title === 'Project');
    expect(mirai?.state).toBe('trabajando');
    expect(mirai?.id === 'proj' || mirai?.id === 'mirai').toBe(true);
    expect(proj?.state).toBe('trabajando');
    expect(proj?.id).not.toBe(mirai?.id);
    expect(list.filter((a) => a.id.startsWith('ui:'))).toHaveLength(0);
  });
});
