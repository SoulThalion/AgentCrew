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

  it('issue #9: sticky Memory + prompt que matchea Jira → clear sticky', () => {
    writeEstado(dir, 'jira', 'subagentes');
    writeTitulo(dir, 'jira', 'Codebase Memory MCP usage, anclado');
    writePrompt(dir, 'jira', 'Jira ticket 4216 review follow-up');
    matchAndSaveTitles(dir, [
      'Codebase Memory MCP usage, anclado',
      'Jira ticket 4216 review',
    ]);
    expect(readTitulo(dir, 'jira').trim()).not.toMatch(/Codebase Memory/i);
  });

  it('issue #10: prompt ticket 4220 suelta sticky AgentCrew y no lo reescribe', () => {
    const prompt =
      'Vamos a entrar en el ticket 4220, solo pide migrar la pantalla de Cobros';
    writeEstado(dir, 'work', 'trabajando');
    writeTitulo(dir, 'work', 'AgentCrew repository installation');
    writePrompt(dir, 'work', prompt);
    const tabs = ['AgentCrew repository installation', 'Ticket 4220 migration plan'];
    matchAndSaveTitles(dir, tabs);
    expect(readTitulo(dir, 'work').trim()).toBe('Ticket 4220 migration plan');
    matchAndSaveTitles(dir, tabs);
    expect(readTitulo(dir, 'work').trim()).toBe('Ticket 4220 migration plan');
  });

  it('issue #10: solo el tab malo en UI → clear y no re-asignar byTitulo', () => {
    writeEstado(dir, 'work', 'trabajando');
    writeTitulo(dir, 'work', 'AgentCrew repository installation');
    writePrompt(
      dir,
      'work',
      'Vamos a entrar en el ticket 4220, solo pide migrar la pantalla de Cobros',
    );
    const tabs = ['AgentCrew repository installation'];
    matchAndSaveTitles(dir, tabs);
    expect(readTitulo(dir, 'work').trim()).toBe('');
    matchAndSaveTitles(dir, tabs);
    expect(readTitulo(dir, 'work').trim()).toBe('');
  });

  it('issue #11: focused AgentCrew + activo sin titulo toma ese tab', () => {
    writeEstado(dir, 'here', 'trabajando');
    writePrompt(dir, 'here', 'y además cuando se inicia el trabajo en este chat');
    matchAndSaveTitles(dir, ['*AgentCrew repository installation']);
    expect(readTitulo(dir, 'here').trim()).toBe('AgentCrew repository installation');
  });

  it('issue #11: Implement the plan en sticky AgentCrew pasa al tab focused', () => {
    const prompt = 'Implement the plan as specified, it is attached for your reference';
    writeEstado(dir, 'ticket', 'planificando');
    writeTitulo(dir, 'ticket', 'AgentCrew repository installation');
    writePrompt(dir, 'ticket', prompt);
    const tabs = ['AgentCrew repository installation', '*Ticket 4220 migration plan'];
    matchAndSaveTitles(dir, tabs);
    expect(readTitulo(dir, 'ticket').trim()).toBe('Ticket 4220 migration plan');
    matchAndSaveTitles(dir, tabs);
    expect(readTitulo(dir, 'ticket').trim()).toBe('Ticket 4220 migration plan');
  });

  it('issue #11: plan build toma el tab aunque otro prompt mencione el ticket', () => {
    writeEstado(dir, 'report', 'esperando');
    writeTitulo(dir, 'report', 'Ticket 4220 migration plan');
    writePrompt(
      dir,
      'report',
      'sigue pasando lo mismo con el chat de ticket 4220, el sprite no cambia',
    );
    writeEstado(dir, 'plan', 'trabajando');
    writePrompt(
      dir,
      'plan',
      'Implement the plan as specified, it is attached for your reference',
    );
    const tabs = [
      'Codebase Memory MCP usage, anclado',
      'AgentCrew repository installation',
      '*Ticket 4220 migration plan',
    ];
    matchAndSaveTitles(dir, tabs);
    expect(readTitulo(dir, 'plan').trim()).toBe('Ticket 4220 migration plan');
    expect(readTitulo(dir, 'report').trim()).not.toBe('Ticket 4220 migration plan');
    matchAndSaveTitles(dir, tabs);
    expect(readTitulo(dir, 'plan').trim()).toBe('Ticket 4220 migration plan');
  });

  it('issue #14: plan-build pasa al Ticket y el focused ajeno se queda con su chat', () => {
    writeEstado(dir, 'here', 'esperando');
    writePrompt(dir, 'here', 'AgentCrew repository installation sigue con sprites cruzados');
    writeEstado(dir, 'plan', 'subagentes');
    writeTitulo(dir, 'plan', 'AgentCrew repository installation');
    writePrompt(
      dir,
      'plan',
      'Implement the plan as specified, it is attached for your reference',
    );
    const tabs = [
      'Codebase Memory MCP usage, anclado',
      '*AgentCrew repository installation',
      'Ticket 4220 migration plan',
    ];
    matchAndSaveTitles(dir, tabs);
    expect(readTitulo(dir, 'plan').trim()).toBe('Ticket 4220 migration plan');
    expect(readTitulo(dir, 'here').trim()).toBe('AgentCrew repository installation');
    matchAndSaveTitles(dir, tabs);
    expect(readTitulo(dir, 'plan').trim()).toBe('Ticket 4220 migration plan');
    expect(readTitulo(dir, 'here').trim()).toBe('AgentCrew repository installation');
  });

  it('issue #11: Implement the plan no suelta el sticky del tab focused', () => {
    const prompt = 'Implement the plan as specified, it is attached for your reference';
    writeEstado(dir, 'ticket', 'planificando');
    writeTitulo(dir, 'ticket', 'Ticket 4220 migration plan');
    writePrompt(dir, 'ticket', prompt);
    const tabs = ['*Ticket 4220 migration plan', 'AgentCrew repository installation'];
    matchAndSaveTitles(dir, tabs);
    expect(readTitulo(dir, 'ticket').trim()).toBe('Ticket 4220 migration plan');
  });

  it('follow-up prompt no limpia sticky del mismo chat', () => {
    writeEstado(dir, 'side', 'trabajando');
    writeTitulo(dir, 'side', 'Sidebar footer consumption sync');
    writePrompt(
      dir,
      'side',
      'revisa que le pasa a los agentes de la barra',
    );
    matchAndSaveTitles(dir, [
      'Sidebar footer consumption sync',
      'MiraiWay phase 4',
    ]);
    expect(readTitulo(dir, 'side').trim()).toBe('Sidebar footer consumption sync');
  });
});
