# Contrato de estado (`hooks/state`)

Directorio por defecto: `~/.cursor/hooks/state/` (o `packages/hooks` → `state` bajo instalación).

Escritura **atómica** (temp + replace). Caducidad legacy: runs ~3 h; estados visibles stale ~3 h; limpia diaria de frases/prompts.

## Por conversación (`<id>` = id seguro)

| Archivo | Contenido |
|---------|-----------|
| `estado-<id>.txt` | `valor\|ISO8601` (ver `04-dominio.md`) |
| `modo-<id>.txt` | `agent` \| `plan` |
| `run-<id>.txt` | timestamp ISO (turno activo) |
| `prompt-<id>.txt` | prompt recortado (~180 chars), UTF-8 |
| `frase-<id>.txt` | última frase para UI/voz |
| `titulo-<id>.txt` | título chat |
| `ultima-<id>.txt` | `cierre` \| `pregunta` |
| `aprobacion-<id>.txt` | flag espera aprobación Shell |
| `busqueda-<id>.txt` | flag espera WebSearch |
| `shell-<id>.txt` | Shell en curso |
| `sub-<id>-<toolId>.txt` | subagente activo |
| `visto-<id>.txt` | UI ya mostró aviso |

## Globales

| Archivo | Uso |
|---------|-----|
| `espera.txt` | tick\|tipo — espera atención |
| `pendiente.txt` | tick\|tipo — aviso diferido por idle |
| `avisado.txt` / `aviso.txt` | control de aviso |
| `cuando.txt` | política de aviso |
| `mudo.txt` | mute |
| `volumen.txt` | 0–100 |
| `ui-tipo.txt` | `busqueda` \| `aprobacion` \| `pregunta` |
| `mostrar.txt` | señal “traer panel al frente” |
| `cerrar.txt` | señal “cerrar panel” (watcher / manual) |
| `panel.pid` | PID proceso panel Electron |
| `cursor-watch.pid` | PID del watcher (single-instance) |
| `watch-off.txt` | desactiva watcher follow Cursor |
| `cursor-watch.log` | log del watcher IDE↔panel |
| `uso.txt` | `Inc N%\|Otr M%` — consumo Cursor (panel) |
| `uso-avisos.txt` | `IncUmbral\|OtrUmbral` — último umbral de uso anunciado por voz (50/65/80/90/95/100) |
| `debug.log` | log truncado |
| `vigilante.pid` | PID loop idle |

## Lectura para el panel

`packages/core` debe exponer algo tipo `listAgents(stateDir): AgentSlot[]` con: id, estado, título, frase, orden, cuentaSubagentes.

Cualquier cambio de nombre de archivo = bump de contrato + migrar hooks + panel a la vez.
