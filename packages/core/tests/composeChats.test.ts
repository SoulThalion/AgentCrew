import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  composeChats,
  writeEstado,
  writeTitulo,
  writePrompt,
  writeFrase,
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
    writePrompt(dir, 'a1', 'Chat activo');
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
    writePrompt(dir, 'neu', 'Mismo');
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

  it('activo sin sticky + huérfanos viejos → bind al UI libre (no orphan doble)', () => {
    writeEstado(dir, 'vivo', 'leyendo');
    writePrompt(dir, 'vivo', 'Ha aparecido otro sprite Terminado');
    writeFrase(dir, 'vivo', 'ultima frase del asistente');
    // sin titulo sticky
    writeEstado(dir, 'viejo', 'terminado');
    writeTitulo(dir, 'viejo', 'Project technology stack advice'); // cerrado, no en UI
    writePrompt(dir, 'viejo', 'otra cosa');
    writeEstado(dir, 'otro', 'terminado');
    writeTitulo(dir, 'otro', 'MiraiWay phase 4');
    writePrompt(dir, 'otro', 'MiraiWay phase 4');
    const list = composeChats(dir, {
      uiTitles: ['Sidebar footer sync', 'MiraiWay phase 4'],
      focusedTitles: ['Sidebar footer sync'],
    });
    const tab = list.find((a) => a.title === 'Sidebar footer sync');
    expect(tab?.id).toBe('vivo');
    expect(tab?.phrase).toBe('ultima frase del asistente');
    expect(list.filter((a) => a.id === 'vivo')).toHaveLength(1);
    expect(list.some((a) => a.id === 'vivo' && a.title.startsWith('Ha aparecido'))).toBe(
      false,
    );
  });

  it('fuzzy prompt↔UI asigna activo; sticky malo no pinta tab idle', () => {
    writeEstado(dir, 'proj', 'trabajando');
    writeTitulo(dir, 'proj', 'Project');
    writePrompt(dir, 'proj', 'Project');
    writeEstado(dir, 'mirai', 'trabajando');
    writeTitulo(dir, 'mirai', 'Project'); // sticky malo
    writePrompt(dir, 'mirai', 'MiraiWay phase 4 implement');
    const list = composeChats(dir, {
      uiTitles: ['MiraiWay phase 4', 'Project'],
      focusedTitles: ['Project'],
    });
    const mirai = list.find((a) => a.title === 'MiraiWay phase 4');
    const proj = list.find((a) => a.title === 'Project');
    expect(mirai?.id).toBe('mirai');
    expect(mirai?.state).toBe('trabajando');
    expect(proj?.id).toBe('proj');
    expect(proj?.state).toBe('trabajando');
  });

  it('issue #3: activo sin sticky no se pinta en tab fijado idle', () => {
    writeEstado(dir, 'jira', 'trabajando');
    writePrompt(dir, 'jira', 'Analiza el ticket de Jira 4224');
    // sin titulo sticky
    writeEstado(dir, 'mem', 'terminado');
    writeTitulo(dir, 'mem', 'Codebase Memory MCP usage');
    clearRun(dir, 'mem');
    const list = composeChats(dir, {
      uiTitles: [
        'Codebase Memory MCP usage, anclado',
        'Jira ticket 4224 analysis',
      ],
      focusedTitles: ['Codebase Memory MCP usage, anclado'],
    });
    const pinned = list.find((a) => a.title.includes('Codebase Memory'));
    const jira = list.find((a) => a.title.includes('Jira'));
    expect(pinned?.state).not.toBe('trabajando');
    expect(jira?.id).toBe('jira');
    expect(jira?.state).toBe('trabajando');
  });

  it('issue #2: 3 sticky iguales + prompts distintos → un slot por tab, sin cruzar', () => {
    writeEstado(dir, 'a3559', 'trabajando');
    writeTitulo(dir, 'a3559', 'AgentCrew repository installation');
    writePrompt(dir, 'a3559', 'AgentCrew repository installation');

    writeEstado(dir, 'fd61', 'terminado');
    writeTitulo(dir, 'fd61', 'AgentCrew repository installation'); // sticky malo
    writePrompt(dir, 'fd61', 'Compliance review for GW3');
    clearRun(dir, 'fd61');

    writeEstado(dir, '70a6', 'terminado');
    writeTitulo(dir, '70a6', 'AgentCrew repository installation');
    writePrompt(dir, '70a6', 'Ticket 4207 analysis');
    clearRun(dir, '70a6');

    const list = composeChats(dir, {
      uiTitles: [
        'AgentCrew repository installation',
        'Compliance review for GW3',
        'Ticket 4207 analysis',
      ],
      focusedTitles: ['AgentCrew repository installation'],
    });
    expect(list).toHaveLength(3);
    const ac = list.find((a) => a.title === 'AgentCrew repository installation');
    const gw = list.find((a) => a.title === 'Compliance review for GW3');
    const tix = list.find((a) => a.title === 'Ticket 4207 analysis');
    expect(ac?.id).toBe('a3559');
    expect(ac?.state).toBe('trabajando');
    expect(gw?.id).toBe('fd61');
    expect(gw?.state).toBe('terminado');
    expect(tix?.id).toBe('70a6');
    expect(tix?.state).toBe('terminado');
    expect(list.filter((a) => a.id.startsWith('ui:'))).toHaveLength(0);
  });
});
