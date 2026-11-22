# Estado del proyecto

Última actualización: 2026-11-21

## Hecho

- [x] Análisis legacy PowerShell/WPF — `Downloads/panel-agentes`
- [x] Repo **AgentCrew** + docs/rules/skills
- [x] Stack Electron + React + TS + Vite + Tailwind
- [x] **Fase 1** `@agentcrew/core` + tests
- [x] **Fase 2** hooks Node (bundle esbuild) + smoke live
- [x] **Fase 3** `apps/panel` franja + lista agentes
- [x] **Fase 4** `@agentcrew/dock-windows` AppBar
- [x] **Fase 5** `dock-macos` + `dock-linux` (sticky / límites honestos)
- [x] **Fase 6** `@agentcrew/tts` (MP3 locales → Fish/ElevenLabs) + Settings UI + safeStorage + sonar hooks + focus Cursor (Win)
- [x] **Fase 7** `installer/install.mjs` + 54 MP3 en `voces/` + README

## En curso

- (post-MVP: focus Mac/Linux)

## Siguiente paso recomendado

1. Relanzar panel desde `AgentCrew-cleanbuild` o sync dist → `apps/panel`
2. Hover sprite → ficha; click → Abrir chat UIA; bandeja → Ajustes TTS
3. Empaquetar: `npm run panel:dist` → `apps/panel/release/`

## Bloqueos / abiertos

- [x] Repo = AgentCrew; legacy = Downloads/panel-agentes
- [x] TTS multi-proveedor documentado (D10)
- [x] Personajes canvas (CharacterFace poses/formas)
- [x] Fish portal + API key (OAuth REST no existe)
- [x] electron-builder .exe (nsis + portable)
- [x] Footer fixed + hover ficha + Abrir chat (no SW_RESTORE ciego)
- [x] Ajustes TTS vía `?page=settings` + `--agentcrew-page=settings`
- [x] Título UI = prompt/titulo (no UUID); stop raro → detenido; run no revive stale
- [x] Click agente async (no congela AppBar); FindAll + match fuzzy; guarda titulo-*
- [x] Títulos UI vía TabItem `, Chat Editors` (Cursor actual; ya no `Open agent`)
- [ ] Focus Cursor Mac/Linux
- [ ] QA subagente (límite modelo)

## Cómo actualizar

Al cerrar chat con progreso: marcar aquí y `09-roadmap.md`.
