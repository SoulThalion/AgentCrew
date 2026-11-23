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
  hasPrompt,
  hasRun,
  markAprobacion,
  markAprobacionSaid,
  markBusqueda,
  markErrorPending,
  markRun,
  markShell,
  markSubagente,
  prefixSubagentes,
  readEstado,
  readModo,
  readText,
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

function sonarPath(stateDir: string, id: string): string {
  return path.join(stateDir, `sonar-${safeId(id)}.txt`);
}

function writeSonar(stateDir: string, id: string, tipo: string): void {
  try {
    fs.writeFileSync(sonarPath(stateDir, id), tipo, 'utf8');
  } catch {
    /* ignore */
  }
}

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

/** Chat real = prompt usuario o run activo. Task/QA subagentes → no. */
function isTrackedChat(stateDir: string, id: string): boolean {
  return Boolean(id) && (hasPrompt(stateDir, id) || hasRun(stateDir, id));
}

function clearOneSub(stateDir: string, id: string, toolId: string): void {
  if (toolId) {
    removeFile(path.join(stateDir, `${prefixSubagentes(id)}${safeId(toolId)}.txt`));
  }
  if (countSubagentes(stateDir, id) > 0) return;
  if (!isTrackedChat(stateDir, id)) return;
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
  clearAprobacion(stateDir, id);
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
        if (dest && id && isTrackedChat(stateDir, id)) {
          writeModo(stateDir, id, dest);
          if (dest === 'plan') clearRun(stateDir, id);
          if (dest === 'agent') markRun(stateDir, id);
          writeEstado(stateDir, id, 'esperando');
        }
        return allow();
      }

      case 'espera': {
        if (id && isTrackedChat(stateDir, id)) {
          // AskQuestion: marca pregunta para que stop no emita «fin» después.
          writeUltima(stateDir, id, 'pregunta');
          writeEstado(stateDir, id, 'esperando');
          writeSonar(stateDir, id, 'pregunta');
        }
        return allow();
      }

      case 'aprobacion': {
        // preToolUse Shell: solo smart-approval (retry tras Auto-review).
        if (id && isTrackedChat(stateDir, id)) {
          markShell(stateDir, id);
          if (asksSmartApproval(raw)) {
            markAprobacion(stateDir, id);
            markAprobacionSaid(stateDir, id);
            writeEstado(stateDir, id, 'esperando');
            writeSonar(stateDir, id, 'aprobacion');
          }
        }
        return allow();
      }

      case 'shell-antes': {
        // beforeShellExecution dispara en auto-run Y en Pending approval.
        // No hay señal fiable de card real aquí: afterShellExecution solo al
        // terminar el comando → grace 1.5s sonaba en comandos largos auto-run.
        // Voz/esperando solo vía preToolUse smart (aprobacion).
        if (id && isTrackedChat(stateDir, id)) {
          markShell(stateDir, id);
        }
        return allow();
      }

      case 'shell-despues': {
        if (!id || !isTrackedChat(stateDir, id)) return empty();
        clearShell(stateDir, id);
        if (fs.existsSync(fileAprobacion(stateDir, id))) {
          clearAprobacion(stateDir, id);
          writeEstado(stateDir, id, afterToolWorkingState(stateDir, id));
        }
        return empty();
      }

      case 'tool-fail': {
        // postToolUseFailure (reject / deny / error): soltar espera de shell.
        if (!id || !isTrackedChat(stateDir, id)) return empty();
        const tool = field(raw, 'tool_name');
        if (tool === 'Shell' || !tool) {
          clearShell(stateDir, id);
          if (fs.existsSync(fileAprobacion(stateDir, id))) {
            clearAprobacion(stateDir, id);
            writeEstado(stateDir, id, afterToolWorkingState(stateDir, id));
          }
        }
        return empty();
      }

      case 'busqueda': {
        if (id && isTrackedChat(stateDir, id)) {
          markBusqueda(stateDir, id);
          writeEstado(stateDir, id, 'esperando');
          writeSonar(stateDir, id, 'busqueda');
        }
        return allow();
      }

      case 'subagentes': {
        if (id && isTrackedChat(stateDir, id)) {
          markSubagente(stateDir, id, field(raw, 'tool_use_id'));
        }
        return allow();
      }

      case 'subagentes-fin': {
        if (id && isTrackedChat(stateDir, id)) {
          clearOneSub(stateDir, id, field(raw, 'tool_use_id'));
        }
        return empty();
      }

      case 'espera-fin': {
        if (!id || !isTrackedChat(stateDir, id)) return empty();
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
        // Solo chats reales (prompt/run). Subagentes Task sin prompt → fantasmas.
        if (id && isTrackedChat(stateDir, id)) {
          const cur = readEstado(stateDir, id);
          if (cur?.state === 'trabajando') writeEstado(stateDir, id, 'planificando');
        }
        return empty();
      }

      case 'leyendo': {
        if (id && isTrackedChat(stateDir, id)) {
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
        if (!id || !isTrackedChat(stateDir, id)) return empty();
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
        if (!id || !isTrackedChat(stateDir, id)) return empty();
        const texto = field(raw, 'text');
        const marca = looksLikeQuestion(texto) ? 'pregunta' : 'cierre';
        writeUltima(stateDir, id, marca);
        const frase = lastSentence(texto);
        if (frase) writeFrase(stateDir, id, frase);
        if (marca === 'pregunta') {
          writeEstado(stateDir, id, 'esperando');
          // Voz aquí (no en stop) para no duplicar con AskQuestion/espera ni con «fin».
          writeSonar(stateDir, id, 'pregunta');
        }
        return empty();
      }

      case 'stop': {
        // Subagente Task a veces emite stop con id propio sin prompt → no inventar slot.
        if (!id || !isTrackedChat(stateDir, id)) return empty();
        const status = field(raw, 'status').trim().toLowerCase();
        clearRun(stateDir, id);
        clearShell(stateDir, id);
        clearSubagentes(stateDir, id);
        clearBusqueda(stateDir, id);
        clearAprobacion(stateDir, id);
        let tipoSonar = '';
        if (status === 'completed' || status === 'success') {
          clearErrorPending(stateDir, id);
          const ultima = readText(fileUltima(stateDir, id))?.trim() ?? '';
          if (ultima === 'pregunta') {
            // Ya anunció pregunta (respuesta/espera). No «fin» ni segundo sonar.
            writeEstado(stateDir, id, 'esperando');
          } else {
            writeEstado(stateDir, id, 'terminado');
            tipoSonar = 'fin';
          }
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
        if (tipoSonar) writeSonar(stateDir, id, tipoSonar);
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
      [
        'switch',
        'aprobacion',
        'shell-antes',
        'busqueda',
        'espera',
        'subagentes',
        'leyendo',
      ].includes(evento)
    ) {
      return allow();
    }
    return empty();
  }
}
