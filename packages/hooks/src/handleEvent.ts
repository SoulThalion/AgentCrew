import fs from 'node:fs';
import path from 'node:path';
import {
  clearAprobacion,
  clearBusqueda,
  clearErrorPending,
  clearRun,
  clearShell,
  clearSubagentes,
  countSubagentes,
  defaultStateDir,
  ensureStateDir,
  fileAprobacion,
  fileUltima,
  hasRun,
  markAprobacion,
  markBusqueda,
  markErrorPending,
  markRun,
  markShell,
  markSubagente,
  prefixSubagentes,
  readEstado,
  readModo,
  removeFile,
  safeId,
  writeEstado,
  writeFrase,
  writeModo,
  writePrompt,
  writeUltima,
  type AgentState,
} from '@agentcrew/core';
import {
  asksSmartApproval,
  conversationId,
  field,
  lastSentence,
  looksLikeQuestion,
} from './stdin.js';

export type HookResult = {
  stdout: string;
  /** Para logs / tests */
  note?: string;
};

function modeFromRaw(raw: string): 'agent' | 'plan' | null {
  const m = field(raw, 'composer_mode').toLowerCase();
  if (m === 'agent' || m === 'plan') return m;
  // SwitchMode payload a veces trae mode en tool input
  if (/["']plan["']/.test(raw) && /SwitchMode|mode/i.test(raw)) {
    if (/"plan"|'plan'|mode["']?\s*:\s*["']plan/.test(raw)) return 'plan';
  }
  if (/"agent"|mode["']?\s*:\s*["']agent/.test(raw)) return 'agent';
  return null;
}

function afterToolWorkingState(stateDir: string, id: string): AgentState {
  if (countSubagentes(stateDir, id) > 0) return 'subagentes';
  if (readModo(stateDir, id) === 'plan') return 'planificando';
  return 'trabajando';
}

function clearOneSub(stateDir: string, id: string, toolId: string): void {
  if (toolId) {
    removeFile(path.join(stateDir, `${prefixSubagentes(id)}${safeId(toolId)}.txt`));
  }
  if (countSubagentes(stateDir, id) > 0) return;
  const cur = readEstado(stateDir, id);
  if (cur?.state !== 'subagentes') return;
  writeEstado(stateDir, id, afterToolWorkingState(stateDir, id));
}

function clearSessionFiles(stateDir: string, id: string): void {
  const sid = safeId(id);
  const prefixes = [
    'modo-',
    'prompt-',
    'estado-',
    'ultima-',
    'frase-',
    'aprobacion-',
    'busqueda-',
    'visto-',
    'titulo-',
  ];
  for (const p of prefixes) {
    removeFile(path.join(stateDir, `${p}${sid}.txt`));
  }
  clearRun(stateDir, id);
  clearShell(stateDir, id);
  clearSubagentes(stateDir, id);
  clearErrorPending(stateDir, id);
}

export function handleEvent(
  evento: string,
  raw: string,
  stateDir = defaultStateDir(),
): HookResult {
  ensureStateDir(stateDir);
  const id = conversationId(raw);
  const modoEntrada = field(raw, 'composer_mode');
  if (modoEntrada && id) {
    const m = modoEntrada.toLowerCase();
    if (m === 'agent' || m === 'plan') writeModo(stateDir, id, m);
  }

  const allow = (): HookResult => ({ stdout: '{"permission":"allow"}' });
  const empty = (): HookResult => ({ stdout: '{}' });
  const cont = (): HookResult => ({ stdout: '{"continue":true}' });

  try {
    switch (evento) {
      case 'sessionStart':
        return empty();

      case 'prompt': {
        if (id) {
          writePrompt(stateDir, id, field(raw, 'prompt'));
          removeFile(fileUltima(stateDir, id));
          // Reintento tras stop/error espurio → cancela “error seguido”
          clearErrorPending(stateDir, id);
          removeFile(path.join(stateDir, `sonar-${safeId(id)}.txt`));
          const modo = readModo(stateDir, id);
          writeEstado(stateDir, id, modo === 'plan' ? 'planificando' : 'trabajando');
          if (modo === 'agent' || !modo) {
            markRun(stateDir, id);
          } else {
            clearRun(stateDir, id);
          }
        }
        return cont();
      }

      case 'switch': {
        const dest = modeFromRaw(raw);
        if (dest && id) {
          writeModo(stateDir, id, dest);
          if (dest === 'plan') clearRun(stateDir, id);
          if (dest === 'agent') markRun(stateDir, id);
          writeEstado(stateDir, id, 'esperando');
        }
        return allow();
      }

      case 'espera': {
        if (id) {
          writeEstado(stateDir, id, 'esperando');
          try {
            fs.writeFileSync(
              path.join(stateDir, `sonar-${safeId(id)}.txt`),
              'pregunta',
              'utf8',
            );
          } catch {
            /* ignore */
          }
        }
        return allow();
      }

      case 'aprobacion': {
        if (id) {
          markShell(stateDir, id);
          if (asksSmartApproval(raw)) {
            markAprobacion(stateDir, id);
            writeEstado(stateDir, id, 'esperando');
          }
        }
        return allow();
      }

      case 'busqueda': {
        if (id) {
          markBusqueda(stateDir, id);
          writeEstado(stateDir, id, 'esperando');
        }
        return allow();
      }

      case 'subagentes': {
        if (id) markSubagente(stateDir, id, field(raw, 'tool_use_id'));
        return allow();
      }

      case 'subagentes-fin': {
        if (id) clearOneSub(stateDir, id, field(raw, 'tool_use_id'));
        return empty();
      }

      case 'espera-fin': {
        if (!id) return empty();
        const tool = field(raw, 'tool_name');
        if (tool === 'Shell') clearShell(stateDir, id);
        if (tool === 'WebSearch') clearBusqueda(stateDir, id);
        const eraAprob = fs.existsSync(fileAprobacion(stateDir, id));
        if (eraAprob) clearAprobacion(stateDir, id);
        if (tool === 'Shell' && !eraAprob) return empty();
        writeEstado(stateDir, id, afterToolWorkingState(stateDir, id));
        return empty();
      }

      case 'pensamiento': {
        if (id) {
          const cur = readEstado(stateDir, id);
          if (cur?.state === 'trabajando') writeEstado(stateDir, id, 'planificando');
        }
        return empty();
      }

      case 'leyendo': {
        if (id) {
          const cur = readEstado(stateDir, id);
          const enCurso = hasRun(stateDir, id);
          if (
            cur?.state === 'trabajando' ||
            cur?.state === 'planificando' ||
            (enCurso && !cur)
          ) {
            writeEstado(stateDir, id, 'leyendo');
          }
        }
        return allow();
      }

      case 'herramienta-fin': {
        if (!id) return empty();
        const cur = readEstado(stateDir, id);
        let valor = cur?.state ?? '';
        if (!valor && hasRun(stateDir, id)) valor = 'leyendo';
        if (valor === 'leyendo') {
          writeEstado(stateDir, id, afterToolWorkingState(stateDir, id));
        } else if (valor === 'planificando' && readModo(stateDir, id) !== 'plan') {
          writeEstado(stateDir, id, 'trabajando');
        }
        return empty();
      }

      case 'respuesta': {
        if (!id) return empty();
        const texto = field(raw, 'text');
        const marca = looksLikeQuestion(texto) ? 'pregunta' : 'cierre';
        writeUltima(stateDir, id, marca);
        const frase = lastSentence(texto);
        if (frase) writeFrase(stateDir, id, frase);
        if (marca === 'pregunta') writeEstado(stateDir, id, 'esperando');
        return empty();
      }

      case 'stop': {
        if (!id) return empty();
        const status = field(raw, 'status').trim().toLowerCase();
        clearRun(stateDir, id);
        clearShell(stateDir, id);
        clearSubagentes(stateDir, id);
        clearBusqueda(stateDir, id);
        let tipoSonar = '';
        if (status === 'completed' || status === 'success') {
          clearErrorPending(stateDir, id);
          writeEstado(stateDir, id, 'terminado');
          tipoSonar = 'fin';
        } else if (status === 'error' || status === 'failed') {
          // Cursor a veces emite error + re-prompt inmediato. Sonar solo tras grace
          // (panel confirma error-pending ~6 s; legado “error seguido”).
          markErrorPending(stateDir, id);
          writeEstado(stateDir, id, 'detenido');
          // no sonar aquí
        } else {
          clearErrorPending(stateDir, id);
          // aborted / cancelled / vacío / desconocido → detenido (no dejar trabajando)
          writeEstado(stateDir, id, 'detenido');
        }
        if (tipoSonar) {
          try {
            fs.writeFileSync(
              path.join(stateDir, `sonar-${safeId(id)}.txt`),
              tipoSonar,
              'utf8',
            );
          } catch {
            /* ignore */
          }
        }
        return empty();
      }

      case 'sessionEnd': {
        if (id) clearSessionFiles(stateDir, id);
        return empty();
      }

      default:
        return empty();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    try {
      fs.appendFileSync(
        path.join(stateDir, 'debug.log'),
        `${new Date().toISOString()} hooks error evento=${evento} ${msg}\n`,
      );
    } catch {
      /* ignore */
    }
    if (evento === 'prompt') return cont();
    if (
      ['switch', 'aprobacion', 'busqueda', 'espera', 'subagentes', 'leyendo'].includes(
        evento,
      )
    ) {
      return allow();
    }
    return empty();
  }
}
