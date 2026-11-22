import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/** WAVs legacy (alarma-agente.ps1). */
export const WAV_FIN = 'C:\\Windows\\Media\\Alarm01.wav';
export const WAV_ASK = 'C:\\Windows\\Media\\Windows Notify Messaging.wav';

export function wavForTipo(tipo: string): string {
  if (tipo === 'pregunta' || tipo === 'aprobacion' || tipo === 'busqueda') {
    return WAV_ASK;
  }
  return WAV_FIN;
}

function runPowerShell(scriptBody: string): Promise<boolean> {
  return new Promise((resolve) => {
    const script = path.join(
      os.tmpdir(),
      `agentcrew-play-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.ps1`,
    );
    try {
      fs.writeFileSync(script, scriptBody, 'utf8');
    } catch {
      resolve(false);
      return;
    }
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script],
      { windowsHide: true, stdio: 'ignore' },
    );
    child.on('exit', (code) => {
      try {
        fs.unlinkSync(script);
      } catch {
        /* ignore */
      }
      resolve(code === 0);
    });
    child.on('error', () => {
      try {
        fs.unlinkSync(script);
      } catch {
        /* ignore */
      }
      resolve(false);
    });
  });
}

/**
 * Reproduce MP3 vía MCI (legacy ReproductorMp3 / winmm).
 * WMPlayer.OCX fallaba: playState 0 → cierre sin audio.
 */
export function playMp3(filePath: string, _volume = 80): Promise<boolean> {
  if (!fs.existsSync(filePath)) return Promise.resolve(false);
  const platform = process.platform;
  if (platform === 'win32') {
    const escaped = filePath.replace(/'/g, "''");
    // Here-string @' '@: el C# llega literal; comillas de ruta con \"
    const ps = [
      "$ErrorActionPreference = 'Stop'",
      "Add-Type -TypeDefinition @'",
      'using System;',
      'using System.Runtime.InteropServices;',
      'using System.Text;',
      'public static class AgentCrewMci {',
      '  [DllImport("winmm.dll", CharSet = CharSet.Auto)]',
      '  public static extern int mciSendString(string comando, StringBuilder retorno, int largo, IntPtr ventana);',
      '  public static void Play(string ruta) {',
      '    string alias = "agentcrewvoz";',
      '    mciSendString("close " + alias, null, 0, IntPtr.Zero);',
      '    int abierto = mciSendString("open \\"" + ruta + "\\" type mpegvideo alias " + alias, null, 0, IntPtr.Zero);',
      '    if (abierto != 0) throw new InvalidOperationException("mci open " + abierto);',
      '    int tocado = mciSendString("play " + alias + " wait", null, 0, IntPtr.Zero);',
      '    mciSendString("close " + alias, null, 0, IntPtr.Zero);',
      '    if (tocado != 0) throw new InvalidOperationException("mci play " + tocado);',
      '  }',
      '}',
      "'@",
      `[AgentCrewMci]::Play('${escaped}')`,
    ].join('\n');
    return runPowerShell(ps);
  }
  return new Promise((resolve) => {
    let child;
    if (platform === 'darwin') {
      child = spawn('afplay', [filePath], { stdio: 'ignore' });
    } else {
      child = spawn(
        'ffplay',
        ['-nodisp', '-autoexit', '-loglevel', 'quiet', filePath],
        { stdio: 'ignore' },
      );
    }
    child.on('exit', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

/** SoundPlayer PlaySync — paridad Tocar-Wav legacy. */
export function playWav(filePath: string): Promise<boolean> {
  if (!fs.existsSync(filePath)) return Promise.resolve(false);
  if (process.platform !== 'win32') {
    return playMp3(filePath);
  }
  const escaped = filePath.replace(/'/g, "''");
  const ps = [
    "$ErrorActionPreference = 'Stop'",
    `$player = New-Object System.Media.SoundPlayer '${escaped}'`,
    '$player.PlaySync()',
  ].join('\n');
  return runPowerShell(ps);
}

export function playSystemBeep(): void {
  if (process.platform === 'win32') {
    spawn(
      'powershell.exe',
      ['-NoProfile', '-Command', '[console]::Beep(880,200)'],
      { windowsHide: true, stdio: 'ignore' },
    );
  } else if (process.platform === 'darwin') {
    spawn('afplay', ['/System/Library/Sounds/Ping.aiff'], { stdio: 'ignore' });
  } else {
    spawn('paplay', ['/usr/share/sounds/freedesktop/stereo/complete.oga'], {
      stdio: 'ignore',
    });
  }
}
