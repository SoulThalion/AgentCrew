# AGENTS

Proyecto **AgentCrew** (panel de agentes Cursor). Antes de implementar, lee solo [docs/00-resumen.md](./docs/00-resumen.md).

`estado.md`, `README.md`, `11-contexto-agentes.md` y el resto de `docs/` se abren solo si el resumen no basta. Dominio y archivos de estado, si hace falta ampliar: `docs/04-dominio.md` y `docs/05-contrato-estado.md`.

Responde en español. Caveman activo.

## Stack objetivo

- `apps/panel` — Electron + React + TypeScript + Vite + Tailwind
- `packages/core` — dominio (estados, prioridad, contrato)
- `packages/hooks` — CLI Node para hooks Cursor
- `packages/dock-windows` | `dock-macos` | `dock-linux` — solo dock
- Estado en `~/.cursor/hooks/state/`

Legacy PowerShell = solo referencia local opcional (ver `docs/02-legacy-powershell.md`). No ampliarlo ni asumirlo en el repo.

Audio: `voces/` + `@agentcrew/tts` + Settings Fish/ElevenLabs. Hooks → `sonar-*.txt` → panel. Ver `docs/12-tts-proveedores.md`.

## Rules siempre

`caveman.mdc`, `qa-todo-gate.mdc` (QA modelo barato), `token-thrift.mdc`, `panel-agentes.mdc`, `regresiones-issues.mdc`.  
UI: `tailwind-first-styles.mdc`, `theme-light-dark.mdc`, `frontend-component-size.mdc`.

## Skills

| Cuándo | Skill |
|--------|--------|
| Feature | `lean-build` |
| Bug mínimo | `surgical-patch` |
| Solo validar | `verify-and-stop` |
| main/preload/IPC | `electron-best-practices`, `electron-development` |
| UI React+Vite | `react-vite-best-practices`, `modern-web-guidance`, `frontend-design` |
| Workspaces | `typescript-monorepo` |
| Look nativo | `native-feel-cross-platform-desktop` |
| IPC/hooks/secretos | `security-and-hardening`, `security-best-practices` |
| Docs agentes | `writing-for-agents` |

## Dock

Ver `docs/10-dock-plataformas.md`. Windows reserva; Mac/Wayland límites honestos.

Fases: `docs/09-roadmap.md`.
