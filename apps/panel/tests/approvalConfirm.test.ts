import { describe, expect, it } from 'vitest';
import {
  approvalNeedle,
  approvalSonarDecision,
  commandSnippet,
  matchCommandRunning,
  needlesInApprovalCard,
  parseApprovalCardDump,
  readShellCommand,
  SHELL_APPROVAL_BACKGROUND_MS,
  userShellStarted,
} from '../src/electron/approvalConfirm.js';

const CMD = 'npm test -w @agentcrew/panel';

describe('approval sonar issue #12', () => {
  it('card de este comando y sin proceso → sonar (#8/#16)', () => {
    expect(
      approvalSonarDecision({ ageMs: 8000, cardForPending: true, commandRunning: false }),
    ).toBe('speak');
  });

  it('card de este comando pero ya corre → silencio (#16)', () => {
    expect(
      approvalSonarDecision({ ageMs: 8000, cardForPending: true, commandRunning: true }),
    ).toBe('suppress');
  });

  it('Run/Skip ajeno no es la card de este comando (#16)', () => {
    const names = ['Run', 'Skip', 'otro comando que no es el pendiente'];
    expect(needlesInApprovalCard(names, [CMD])).toEqual([]);
    expect(
      approvalSonarDecision({ ageMs: 2000, cardForPending: false, commandRunning: false }),
    ).toBe('wait');
  });

  it('sin card y sin shell, tras la espera → sonar (#12)', () => {
    expect(
      approvalSonarDecision({
        ageMs: SHELL_APPROVAL_BACKGROUND_MS,
        cardForPending: false,
        commandRunning: false,
      }),
    ).toBe('speak');
  });

  it('misma ventana: Run, Skip y el comando → esa card', () => {
    const names = ['Run', 'Skip', CMD];
    expect(needlesInApprovalCard(names, [CMD])).toEqual([approvalNeedle(CMD)]);
  });

  it('auto-run con proceso → no sonar (#8)', () => {
    expect(
      approvalSonarDecision({ ageMs: 8000, cardForPending: false, commandRunning: true }),
    ).toBe('suppress');
  });

  it('sin card todavía dentro de la espera → esperar', () => {
    expect(
      approvalSonarDecision({ ageMs: 2000, cardForPending: false, commandRunning: false }),
    ).toBe('wait');
  });

  it('sin comando para comparar → no adivinar', () => {
    expect(
      approvalSonarDecision({ ageMs: 9000, cardForPending: false, commandRunning: null }),
    ).toBe('wait');
  });

  it('dump UIA: solo la ventana con Run y Skip', () => {
    const groups = parseApprovalCardDump('##\nRun\nSkip\nnpm test -w @agentcrew/panel\n');
    expect(groups).toEqual([['Run', 'Skip', CMD]]);
    expect(parseApprovalCardDump('0')).toEqual([]);
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

  it('powershell nuevo sin el texto del comando → auto-run (#13)', () => {
    const since = 5_000_000;
    const procs = [
      {
        t: since + 300,
        c: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -NoProfile -Command "Get-Date"',
      },
    ];
    expect(userShellStarted(procs, since)).toBe(true);
    expect(matchCommandRunning('npm test -w @agentcrew/core', procs, since)).toBe(true);
  });

  it('sonda WMI no cuenta como shell del usuario', () => {
    const since = 5_000_000;
    const procs = [
      { t: since + 300, c: 'powershell.exe -Command Get-CimInstance Win32_Process' },
    ];
    expect(userShellStarted(procs, since)).toBe(false);
    expect(matchCommandRunning('npm test -w @agentcrew/core', procs, since)).toBe(false);
  });

  it('lee el comando bajo el timestamp', () => {
    expect(readShellCommand('2026-11-27T12:00:00.000Z\nnpm test -w core')).toBe(
      'npm test -w core',
    );
  });
});
