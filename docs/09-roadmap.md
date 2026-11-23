# Roadmap

## Fase 0 — Contexto (hecha)

- [x] Análisis legacy, stack, rules/skills, docs, repo AgentCrew

## Fase 1 — Core + contrato (hecha)

- [x] npm workspaces + `@agentcrew/core` + tests

## Fase 2 — Hooks Node (hecha)

- [x] `@agentcrew/hooks` + bundle install + smoke live

## Fase 3 — Panel Electron (hecha)

- [x] `apps/panel` React franja + poll state + single-instance

## Fase 4 — Dock Windows (hecha)

- [x] `@agentcrew/dock-windows` AppBar SHAppBarMessage

## Fase 5 — Dock Mac / Linux (hecha)

- [x] `@agentcrew/dock-macos` — always-on-top / all workspaces (sin reserva OS)
- [x] `@agentcrew/dock-linux` — sticky + `isWayland()` documentado
- [x] Panel elige dock por `process.platform`

**Criterio:** app arranca en los tres; límites honestos. ✅

## Fase 6 — Audio + focus + Settings TTS (hecha)

- [x] `voces/` 54 MP3 desde legacy (hash SHA256-16)
- [x] `@agentcrew/tts` — local → Fish/ElevenLabs → beep
- [x] Settings UI (click AC) + `safeStorage` keys
- [x] Hooks escriben `sonar-*.txt`; panel reproduce
- [x] Click agente → focus Cursor (Windows)

**Criterio:** MP3 locales sin API; Settings Fish/ElevenLabs; focus Win. ✅

## Fase 7 — Instalador + pulido (hecha MVP)

- [x] `installer/install.mjs` (+ `--panel`)
- [x] README usuario (hooks, panel, TTS)
- [x] Personajes canvas CharacterFace (poses + formas)
- [x] Fish portal (API key; sin OAuth REST)
- [x] Empaquetado electron-builder (.exe nsis + portable)

## Post-MVP

- [x] Watcher abrir/cerrar panel con IDE Cursor (`15-cursor-watch.md`)

## Prioridad próximo chat

1. Focus Cursor Mac/Linux
2. Icono/firma code-sign del .exe
3. Paridad animaciones legacy (obra/subagentes)

Hecho reciente: Cast Google Home (MP3 AgentCrew, Settings) — `docs/16-plan-cast.md`
