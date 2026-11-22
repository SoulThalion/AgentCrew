# Decisiones de diseño

Formato ligero tipo ADR. Cambiar solo conscientemente y actualizar `estado.md`.

## D1 — Stack: Electron + React + TypeScript

**Decisión:** App desktop Electron; UI React+Vite+TS+Tailwind; lógica Node/TS.

**Contexto:** Autor en JS/TS; construcción con IA (mucho corpus Electron/React). Multiplataforma Win/Mac/Linux.

**Descartado:** PowerShell+WPF (solo Windows, UI frágil); C# WinUI (solo Win); Tauri+Rust (FFI/plugins caros con IA); tres apps nativas completas.

## D2 — Un panel + adaptadores de dock

**Decisión:** Una UI (`apps/panel`). Carpetas `packages/dock-windows|macos|linux` solo para reserva/anclaje.

**Por qué:** Evitar triplicar personajes, estados y alarmas.

## D3 — Hooks en Node, no PowerShell como lógica

**Decisión:** `packages/hooks` CLI lee stdin JSON de Cursor y escribe estado / dispara audio. Wrappers `.ps1`/`.sh` mínimos solo si Cursor lo exige.

**Por qué:** Misma lógica en los tres SO; tipado; tests.

## D4 — IPC por archivos tipados (contrato estable)

**Decisión:** Seguir usando `~/.cursor/hooks/state/` (migración: mismos nombres de fichero que legacy o capa de compat). Dominio en `packages/core` tipado; hacia JSON por agente si se migra sin romper panel.

**Por qué:** Cursor hooks ya son procesos cortos; archivos = IPC simple y durable.

## D5 — Reserva de pantalla: honestidad por OS

| OS | Comportamiento |
|----|----------------|
| Windows | `SHAppBarMessage` — reserva real (paridad legacy) |
| macOS | Panel always-on-top; **sin** API pública de `visibleFrame` |
| Linux | X11 struts; Wayland best-effort |

Detalle: `10-dock-plataformas.md`.

## D6 — Audio / TTS + reutilizar MP3 existentes

**Decisión:** Portar pipeline legacy a Node. **Obligatorio aprovechar los MP3 ya generados** en `Downloads/panel-agentes/voces/frase-*.mp3` (~54 archivos). No regenerar frases conocidas si el archivo existe.

**Convención de nombre (compatibilidad binaria):**

- Archivo: `voces/frase-<hash16>.mp3`
- `hash16` = primeros 16 hex de `SHA256(UTF-8(frase))` en minúsculas (misma fn `Hash-Frase` del legacy)
- Lookup: asset `voces/` → cache runtime → proveedor activo → fallback OS

**Repo:** copiar `voces/` al árbol AgentCrew. Commitear MP3 precacheados (assets). Proveedores solo frases nuevas / export.

**Mute / volumen** en settings/state. Detalle proveedores: D10 + `12-tts-proveedores.md`.

## D10 — Cuenta TTS del usuario (Fish + ElevenLabs)

**Decisión:** Settings in-app para que el usuario conecte **su** cuenta TTS.

| Proveedor | Conexión MVP | Extra |
|-----------|--------------|--------|
| **Fish Audio** | API key (Settings + env `FISH_API_KEY` / `FISH_AUDIO_API_KEY`) | Portal asistido (abrir API keys en browser + pegar). OAuth REST no existe en Fish; MCP OAuth no aplica al panel |
| **ElevenLabs** | API key + voice id (+ modelo) | Misma UI de Settings |
| Ninguno | Solo MP3 locales + fallback sistema | Default seguro sin cuenta |

**Un proveedor activo** a la vez (`tts.provider`: `fish` \| `elevenlabs` \| `none`).

**Storage:** credenciales en almacén local de la app (Electron `safeStorage` / keytar) o env de usuario; **nunca** en git. Abstracción `TtsProvider` (ver `12-tts-proveedores.md`).

**Descartado:** hardcodear una sola API key del autor; acoplar hooks solo a Fish.

## D7 — Instancia única

**Decisión:** Electron `requestSingleInstanceLock` (sustituye mutex `Local\CursorPanelAgentes`).

## D8 — Seguridad Electron

**Decisión:** `contextIsolation`, preload estrecho, sin `nodeIntegration` en renderer. Skills: `electron-best-practices`, `security-*`.

## D9 — Documentación estilo MiraiWay

**Decisión:** `docs/` con estado + roadmap + ADRs + contexto agentes. Agente lee `estado.md` primero.
