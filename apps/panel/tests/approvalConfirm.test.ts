import { describe, expect, it } from 'vitest';
import {
  approvalSonarDecision,
  commandSnippet,
  matchCommandRunning,
  readShellCommand,
  SHELL_APPROVAL_BACKGROUND_MS,
} from '../src/electron/approvalConfirm.js';

describe('approval sonar issue #12', () => {
  it('card visible → sonar', () => {
    expect(
      approvalSonarDecision({ ageMs: 2000, uiVisible: true, commandRunning: false }),
    ).toBe('speak');
  });

  it('auto-run con proceso → no sonar (#8)', () => {
    expect(
      approvalSonarDecision({ ageMs: 8000, uiVisible: false, commandRunning: true }),
    ).toBe('suppress');
  });

  it('sin card y sin proceso, tras espera → sonar (#12)', () => {
    expect(
      approvalSonarDecision({
        ageMs: SHELL_APPROVAL_BACKGROUND_MS,
        uiVisible: false,
        commandRunning: false,
      }),
    ).toBe('speak');
  });

  it('sin card todavía dentro de la espera → esperar', () => {
    expect(
      approvalSonarDecision({ ageMs: 2000, uiVisible: false, commandRunning: false }),
    ).toBe('wait');
  });

  it('sin comando para comparar → no adivinar', () => {
    expect(
      approvalSonarDecision({ ageMs: 9000, uiVisible: false, commandRunning: null }),
    ).toBe('wait');
  });

  it('proceso anterior al shell no cuenta', () => {
    const since = 5_000_000;
    const procs = [
      { t: since - 10_000, c: 'powershell.exe npm test -w @agentcrew/core' },
    ];
    expect(matchCommandRunning('npm test -w @agentcrew/core', procs, since)).toBe(false);
  });

  it('proceso nuevo con el comando → auto-run', () => {
    const since = 5_000_000;
    const procs = [{ t: since + 400, c: 'cmd.exe /c npm test -w @agentcrew/core' }];
    expect(matchCommandRunning('npm test -w @agentcrew/core', procs, since)).toBe(true);
  });

  it('comando corto no se usa como prueba', () => {
    expect(commandSnippet('npm t')).toBe('');
    expect(matchCommandRunning('npm t', [], 0)).toBe(null);
  });

  it('lee el comando bajo el timestamp', () => {
    expect(readShellCommand('2026-11-27T12:00:00.000Z\nnpm test -w core')).toBe(
      'npm test -w core',
    );
  });
});
