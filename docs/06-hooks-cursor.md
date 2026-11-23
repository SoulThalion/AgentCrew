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
| `beforeShellExecution` | — | marca aprobación + `esperando` (sonar tras grace en panel) |
| `afterShellExecution` | — | auto-run / ya ejecutó → quita flag (sin aviso) |
| `postToolUseFailure` Shell | Shell | reject/deny → quita espera |
| `preToolUse` Shell | Shell | si smart approval → aprobación + espera + sonar |
| `preToolUse` WebSearch | WebSearch | búsqueda + espera + sonar |
| `preToolUse` Task | Task | marcar subagente |
| `preToolUse` Read\|Grep\|Glob… | lectura | estado `leyendo` |
| `postToolUse` AskQuestion\|… | fin espera parcial | quitar flags; volver a trabajar/plan |
| `postToolUse` Task | fin subagente | quitar sub; ajustar estado |
| `postToolUse` (resto) | herramienta-fin | leyendo→trabajando/plan |
| `afterAgentResponse` | — | frase; si pregunta → espera |
| `afterAgentThought` | — | trabajando→planificando (solo ese caso) |
| `stop` | — | terminado/error/detenido + sonar |
| `sessionEnd` | — | limpiar archivos del id |

## CLI objetivo

```text
node packages/hooks/dist/cli.js --evento <nombre>
```

Stdout: JSON que Cursor espera (`{"continue":true}`, `{"permission":"allow"}`, `{}`).

Errores: nunca tumbar el hook; log + respuesta segura (legacy `exit 0` / allow).

## Instalación

`installer/` copia hooks + `hooks.json` + arranca panel. Ver fase instalador en `09-roadmap.md`.
