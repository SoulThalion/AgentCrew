# Hooks Cursor

Fuente: `hooks.json` (fusionado en `~/.cursor/hooks.json` al instalar).

Cada entrada: comando CLI Node (objetivo) con timeout corto; stdin = JSON del evento.

## Mapa evento → acción (legacy → port)

| Evento Cursor | Matcher / nota | Acción dominio |
|---------------|----------------|----------------|
| `sessionStart` | — | noop / `{}` |
| `beforeSubmitPrompt` | — | prompt → estado trabajando/planificando; marcar run; asegurar panel |
| `preToolUse` SwitchMode | SwitchMode | modo; estado `esperando` |
| `preToolUse` AskQuestion | AskQuestion | espera |
| `beforeShellExecution` | — | `shell-*` (incluye comando) + aprobación candidata + `esperando`; panel sonar tras grace+UIA, o sin card si el comando no arrancó (#8/#12) |
| `afterShellExecution` | — | limpia `shell-*` + aprobación; vuelve trabajando |
| `preToolUse` Shell smart | `request_smart_mode_approval` | `esperando` + sonar `aprobacion` inmediato |
| `postToolUseFailure` Shell | Shell | reject/deny → quita espera |
| `preToolUse` Shell | Shell | si smart approval → aprobación + espera + sonar |
| `preToolUse` WebSearch | WebSearch | búsqueda + espera + sonar |
| `preToolUse` Task | Task | marcar subagente |
| `preToolUse` Read\|Grep\|Glob… | lectura | estado `leyendo` |
| `postToolUse` AskQuestion\|… | fin espera parcial | quitar flags; volver a trabajar/plan |
| `postToolUse` Task | fin subagente | quitar sub; ajustar estado |
| `postToolUse` (resto) | herramienta-fin | leyendo→trabajando/plan |
| `afterAgentResponse` | — | frase; si pregunta → espera |
| `afterAgentThought` | — | trabajando→planificando solo si chat tracked (prompt/run) |
| `stop` | — | terminado/error/detenido + sonar; ignora id sin prompt/run |
| `sessionEnd` | — | limpiar archivos del id |
| `subagentStop` | — | **no** hookear: Cursor manda `conversation_id` del padre |

## CLI objetivo

```text
node packages/hooks/dist/cli.js --evento <nombre>
```

Stdout: JSON que Cursor espera (`{"continue":true}`, `{"permission":"allow"}`, `{}`).

Errores: nunca tumbar el hook; log + respuesta segura (legacy `exit 0` / allow).

## Instalación

`installer/` / `npm run install-hooks` bundle Node + merge `~/.cursor/hooks.json`.
Al merge **quita** legacy `alarma-agente.ps1` / `agentcrew-hook` viejo (issue #6: doble TTS).
Ver fase instalador en `09-roadmap.md`.
