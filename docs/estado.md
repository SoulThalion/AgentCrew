# Estado del proyecto

Última actualización: 2026-11-23

## Hecho

- [x] Análisis legacy PowerShell/WPF — ver `02-legacy-powershell.md`
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

- [x] Repo = AgentCrew; legacy fuera del repo (`02-legacy-powershell.md`)
- [x] TTS multi-proveedor documentado (D10)
- [x] Personajes canvas (CharacterFace poses/formas)
- [x] Fish portal + API key (OAuth REST no existe)
- [x] electron-builder .exe (nsis + portable)
- [x] Footer fixed + hover ficha + Abrir chat (no SW_RESTORE ciego)
- [x] Ajustes TTS vía `?page=settings` + `--agentcrew-page=settings`
- [x] Título UI = prompt/titulo (no UUID); stop raro → detenido; run no revive stale
- [x] Click agente async (no congela AppBar); FindAll + match fuzzy; guarda titulo-*
- [x] Títulos UI vía TabItem `, Chat Editors` (Cursor actual; ya no `Open agent`)
- [x] Franja = chats UI; sin duplicar activo+terminado mismo título (`composeChats`)
- [x] learnTitles: no cruzar foco UI con otro agente activo; títulos sticky si chat abierto
- [x] pickOne: varios mismo título → unread terminado visible (no placeholder detenido)
- [x] Activo con título sticky duplicado → rellena UI libre (MiraiWay no detenido)
- [x] Aviso lote: `todos` + MP3 `frase-41fe2b948184f7e8.mp3` (Fish) si multi acaba e idle
- [x] Bootstrap sin clone: `installer/bootstrap.ps1` + one-liner `irm … | iex`
- [x] Scrape UIA: todas ventanas Cursor; dedup título intacto (sin cruces/dup sprites)
- [x] README: uso completo (franja, bandeja, TTS Fish/Eleven, avisos, watcher, troubleshooting)
- [x] Footer Inc/Otr: no tumbar refresh si `usage-summary` 401 (periodo basta)
- [x] Avisos voz umbrales uso (50/65/80/90/95/100) + `uso-avisos.txt`
- [x] Watcher Cursor↔panel (Startup + auto-quit) — `docs/15-cursor-watch.md`
- [x] Salir manual → `panel-user-closed.txt` (no relanzar hasta Cursor edge up)
- [x] Issue #1: grace 12s + fail-open `isCursorAlive` (no bucle quit bajo carga)
- [x] Issue #1 RSS: dock place no-op si rect igual + debounce POSCHANGED; idleWin koffi (sin PS)
- [x] Issue #2: sticky unico + compose no cruza hermanos (prompt→otro tab)
- [x] Issue #3: error-pending 6s (no falso sonar) + compose fuzzy / sin fill tab idle
- [x] Sonar: stop+pregunta no duplica fin (ultima=pregunta → esperando, sin fin)
- [x] Sonar pregunta: respuesta+AskQuestion → un solo aviso (no doble voz)
- [x] Issue #5: sticky/activo no pinta pin focused idle sin prompt↔título
- [x] Issue #6: install-hooks quita `alarma-agente.ps1` (doble TTS)
- [x] Pending approval voz: solo con card y sin proceso; auto-run no suena (#8/#13/#16)
- [x] RAM main: hover sin loadURL repetido; dock place solo ABN_POSCHANGED; tasklist filtrado
- [x] Perf: scrape UIA PS persistente; poll 1.6s; scrape 6–13s; RAF solo poses animadas
- [x] **Cast** (MP3 AgentCrew, Settings on/off + dispositivo) — `16-plan-cast.md` C0–C3
- [x] Watcher: install mata viejo; Cursor down→cerrar.txt; up→mostrar.txt
- [x] Fantasmas Planificando (Task/QA): `isTrackedChat` + prune `isGhostBusyState`; no `subagentStop→sessionEnd`
- [x] Sprite doble Terminado/sin frase: bind activo huérfano↔UI libre (ignora sticky de chats cerrados)
- [x] Issue #4: watcher fail-open si `tasklist` flake (+ grace 10s + cache probe)
- [x] Arranque: `panelRunning` exige electron/AgentCrew; `mostrar` reengancha dock tras Parar
- [x] Issue #7: Cast `pickLanIp` NIC misma /24 + timeout play + skip mDNS si host + Settings IP anuncio
- [x] Issue #8/#13/#16: voz de aprobación solo con card y sin proceso; auto-run no suena
- [x] Issue #14: plan-build se ancla al tab Ticket, no al focused ajeno
- [x] Issue #15: un chat ajeno no quita el sticky del tab focused
- [x] Issue #9: sticky contaminado solo si prompt → otro tab UI; fuzzy sin prosa; follow-up no limpia
- [x] Volumen TTS: slider 0–100 en `volumen.txt` y en el MP3 (antes siempre 100)
- [ ] Focus Cursor Mac/Linux
- [ ] QA subagente (límite modelo)

## Cómo actualizar

Al cerrar chat con progreso: marcar aquí y `09-roadmap.md`.
