# Contexto para agentes / chats nuevos

Leer también `docs/README.md` y `docs/estado.md`.

## Qué es este repo

**panel-agentes**: franja desktop multiplataforma que muestra estados de agentes Cursor (hooks → archivos state → UI). Origen: scripts PowerShell/WPF solo Windows.

## Decisiones ya tomadas

- Electron + React + TypeScript + Vite + Tailwind
- Monorepo: `apps/panel` + `packages/core|hooks|dock-*`
- Un panel; tres adaptadores de dock
- Hooks Node; legacy PS = referencia
- Windows AppBar real; Mac/Wayland sin reserva pública
- TTS: MP3 locales + Settings Fish (API key) y ElevenLabs (`12-tts-proveedores.md`)
- Español + caveman; QA gate modelo barato

## Estado del código (al crear docs)

2026-11-21: hay **docs + rules/skills + legacy PS**. Aún no monorepo Electron.

## Cómo trabajar

1. Actualizar `estado.md` y checkboxes de `09-roadmap.md` al avanzar
2. Decisión nueva → `03-decisiones.md`
3. Estados/archivos → `04-dominio.md` / `05-contrato-estado.md` (no inventar)
4. Skills: lean-build / surgical-patch / electron-* / react-vite según capa
5. No ampliar PowerShell salvo hotfix temporal documentado
6. Bug o issue → invariantes del mismo eje en [17-regresiones-issues.md](./17-regresiones-issues.md)

## Prompt corto para chat nuevo

```
Continúa AgentCrew (panel de agentes Cursor). Lee docs/README.md y docs/estado.md.
Objetivo: [Fase 1 core | hooks Node | Electron UI | dock Win | …].
Stack: Electron+React+TS monorepo. Legacy PowerShell solo referencia (docs/02-legacy-powershell.md).
Responde en español. Caveman + QA gate.
```

## Carpetas

| Rol | Ruta |
|-----|------|
| **Repo (este proyecto)** | raíz del clone (`AgentCrew/`) |
| Legacy referencia | copia local opcional; no vive en el repo |

Abrir el clone de **AgentCrew** en Cursor.
