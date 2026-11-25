# Watcher Cursor ↔ panel

Cursor **no** expone hook “IDE abierto”. Para abrir/cerrar el sidebar con el IDE usamos un **watcher** de proceso.

## Comportamiento

| Evento | Qué pasa |
|--------|----------|
| Login Windows | Startup lanza `agentcrew-cursor-watch.mjs` (oculto) |
| Aparece `Cursor.exe` | Watcher arranca el panel si no corre |
| Desaparece Cursor (~10 s grace) | Watcher escribe `cerrar.txt`; panel también `app.quit()` |
| `tasklist`/`ps` falla (timeout) | **Fail-open**: reusa cache / asume vivo (issue #4; paridad panel) |
| Vuelve a abrir Cursor | Watcher arranca panel **o** escribe `mostrar.txt` si ya corría oculto |
| `npm run install-watch` | **Mata** watcher viejo y lanza uno nuevo (antes el lock lo bloqueaba) |
| Usuario **Salir** (bandeja / quit) | `panel-user-closed.txt` → watcher **no** relanza hasta que Cursor se apague y vuelva |

El watcher **sigue vivo** sin Cursor (espera el próximo arranque del IDE).

Nota: cerrar la ventana de Cursor no siempre mata `Cursor.exe` (procesos en background). El watcher mira el proceso, no la UI.

## Archivos

| Ruta | Rol |
|------|-----|
| `~/.cursor/hooks/agentcrew-cursor-watch.mjs` | Loop poll ~2 s |
| `~/.cursor/hooks/panel-launch.json` | Cómo lanzar Electron / `AgentCrew.exe` |
| `~/…/Startup/AgentCrew-CursorWatch.vbs` | Autostart Windows |
| `state/panel.pid` | PID del panel (¿ya corre?) |
| `state/panel-user-closed.txt` | Latch tras Salir manual; se borra en edge Cursor up |
| `state/cursor-watch.pid` | PID del watcher (una sola instancia) |
| `state/cerrar.txt` | Señal opcional → panel sale |
| `state/watch-off.txt` | Desactiva follow (no auto-start / no auto-quit) |
| `state/cursor-watch.log` | Log truncado del watcher |

## Instalar

```bash
npm run install-watch
# o: npm run install:all  (incluye watch)
```

Requisitos: `apps/panel/dist-electron/main.js` (dev) **o** `apps/panel/release/win-unpacked/AgentCrew.exe`.

Si corres el panel desde `AgentCrew-cleanbuild`, el instalador lo detecta como fallback.

## Desactivar

1. Crear `~/.cursor/hooks/state/watch-off.txt` (vacío vale), **o**
2. Borrar `AgentCrew-CursorWatch.vbs` del folder Startup, **o**
3. Env `AGENTCREW_FOLLOW_CURSOR=0` (solo desactiva auto-quit del panel).

## macOS / Linux

Sin Startup VBS: añade al login `node ~/.cursor/hooks/agentcrew-cursor-watch.mjs`. Misma lógica `ps` / nombre `Cursor`.
