/**
 * Smoke: filtro legacy del merge install-hooks (issue #6).
 * Ejecutar: node --test scripts/tests/install-hooks-legacy.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { isLegacyHookCommand } from '../legacy-hooks.mjs';

test('detecta alarma-agente.ps1', () => {
  assert.equal(
    isLegacyHookCommand(
      'powershell -File C:\\Users\\x\\Downloads\\panel-agentes\\hooks\\alarma-agente.ps1',
    ),
    true,
  );
});

test('detecta agentcrew-hook viejo', () => {
  assert.equal(
    isLegacyHookCommand('node ./hooks/agentcrew-hook.mjs --evento prompt'),
    true,
  );
});

test('no marca comandos ajenos', () => {
  assert.equal(isLegacyHookCommand('echo hello'), false);
});
