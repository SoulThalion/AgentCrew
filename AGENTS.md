# AGENTS

Proyecto **AgentCrew** (panel de agentes Cursor). Antes de implementar, lee:

1. [docs/estado.md](./docs/estado.md)
2. [docs/README.md](./docs/README.md)
3. [docs/11-contexto-agentes.md](./docs/11-contexto-agentes.md)

Responde en español. Caveman activo. No inventes estados ni contrato de archivos: usa `docs/04-dominio.md` y `docs/05-contrato-estado.md`.

## Stack objetivo

- `apps/panel` — Electron + React + TypeScript + Vite + Tailwind
- `packages/core` — dominio (estados, prioridad, contrato)
- `packages/hooks` — CLI Node para hooks Cursor
- `packages/dock-windows` | `dock-macos` | `dock-linux` — solo dock
- Estado en `~/.cursor/hooks/state/`

Legacy PowerShell = `C:\Users\eomer\Downloads\panel-agentes` (solo referencia; ver `docs/02-legacy-powershell.md`). No ampliarlo.

Audio: `voces/` + `@agentcrew/tts` + Settings Fish/ElevenLabs. Hooks → `sonar-*.txt` → panel. Ver `docs/12-tts-proveedores.md`.

## Rules siempre

`caveman.mdc`, `qa-todo-gate.mdc` (QA modelo barato), `token-thrift.mdc`, `panel-agentes.mdc`.  
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
