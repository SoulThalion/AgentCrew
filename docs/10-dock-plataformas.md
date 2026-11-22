# Dock por plataforma

Objetivo común: franja sticky en un borde. **Reserva de área de trabajo** solo donde el OS lo permita.

## Windows

- API: `SHAppBarMessage` (`ABM_NEW` → `ABM_QUERYPOS` → `ABM_SETPOS`; `ABM_REMOVE` al salir)
- Paquete: `packages/dock-windows` (koffi o N-API) desde main process
- Arranque: **pantalla principal** (no cursor). Usuario cambia monitor en Settings → `panel-prefs.json` (`displayId`)
- Criterio: ventanas maximizadas **no** cubren la franja

## macOS

- Sin API pública para alterar `NSScreen.visibleFrame` (solo Dock del sistema)
- Electron: `type: 'panel'`, always-on-top / nivel status
- Criterio MVP: franja visible y sticky; ventanas maximizadas **pueden solapar**
- Opcional futuro: Accessibility para reubicar ventanas (permiso usuario; no MVP)

## Linux

- **X11:** `_NET_WM_STRUT_PARTIAL` (reserva)
- **Wayland:** sin strut universal; always-on-top / protocolo compositor; documentar límite
- Criterio: X11 ≈ reserva; Wayland = best-effort documentado en README usuario

## Selección en runtime

```text
process.platform === 'win32' → dock-windows
process.platform === 'darwin' → dock-macos
else → dock-linux
```

No fingir paridad Mac/Wayland de AppBar en marketing ni en `estado.md`.
