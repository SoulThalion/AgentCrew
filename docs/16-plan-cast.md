# Plan — Cast a Google Home / Nest (opcional)

Objetivo: reproducir avisos TTS de AgentCrew en un altavoz Cast (Google Home / Nest / Chromecast Audio), **activable/desactivable** en Settings. PC sigue siendo default.

**Audio:** siempre el **mismo MP3** de `voces/` / cache AgentCrew (Fish/ElevenLabs si aplica). **Prohibido** TTS/voz de Google (`notify` de google-home-notifier, Google Cloud TTS, etc.). Solo Cast `DefaultMediaReceiver` + URL HTTP al MP3.

Relacionado: `docs/12-tts-proveedores.md`, `packages/tts`, Settings panel.

## Decisión de producto

| Preferencia | Valor MVP |
|-------------|-----------|
| Protocolo | **Google Cast V2** (`Default Media Receiver`) — play URL MP3 |
| On/off | Toggle **Cast** en Settings (default **off**) |
| Dispositivo | Nombre o IP guardados; botón **Buscar dispositivos** |
| Local + Cast | Toggle **También en PC** (default **on**): Cast on + local on = ambos; Cast on + local off = solo Home |
| Mute global | `muted` sigue silenciando **todo** (PC y Cast) |
| Modo `aviso=sonido` | Solo WAV en PC; Cast **no** (MVP). Solo frases `voz` / `speakTipo` con MP3 |
| Multi-altavoz | Fuera de MVP (un dispositivo) |
| Offline / sin LAN | Cast falla → log + PC si “También en PC”; si solo Cast → fallo silencioso + status Settings |

**No** usar Assistant Broadcast ni APIs Google Home cloud (no aptas para TTS libre).

## Restricción técnica clave

Cast **no** reproduce `C:\…\frase.mp3`. Necesita **URL HTTP** alcanzable desde el altavoz (misma LAN).

MVP: servidor HTTP efímero en el proceso Electron (main), sirve solo archivos bajo `voces/` + cache TTS, bind `0.0.0.0` puerto fijo/configurable, URL `http://<LAN-IP>:<port>/…`.

Riesgos:

- Firewall Windows puede bloquear inbound → doc + mensaje Settings
- IP LAN mal detectada (VPN/varios NIC) → override manual “IP anuncio”
- Altavoz y PC en VLANs distintas → no soportado

## Arquitectura

```text
speakTipo / resolveAndSpeak
  → resolve path MP3 (igual que hoy)
  → si cast.enabled: cast.play(httpUrl)
  → si playLocal (o !cast.enabled): playMp3 local
```

Paquete nuevo (lean): `packages/cast` (`@agentcrew/cast`)

| Módulo | Rol |
|--------|-----|
| `discover.ts` | mDNS `_googlecast._tcp` → `{ name, host, port }[]` |
| `playUrl.ts` | Conectar host → launch DefaultMediaReceiver → load MP3 URL |
| `httpServe.ts` | (o en panel) servir path → URL relativa; panel aporta base URL |
| `types.ts` | `CastSettings`, `CastDevice` |

Alternativa libs (elegir en C1 tras spike ½ día):

1. **`castv2-client` + `bonjour-service`** — maduro, mismo stack que `google-home-notifier`
2. **`@lox-audioserver/node-googlecast`** — TS moderno, menos batallas; validar Windows

**No** depender de `google-home-notifier` entero (trae TTS Google ajeno); reutilizar solo patrón Cast + nuestro MP3.

HTTP serve: preferible en **panel main** (ya tiene paths `voces`/`cache`), no en hooks. Cast solo desde proceso panel.

## Settings (contrato)

Extender `TtsSettings` **o** bloque hermano `CastSettings` en mismo store (`settingsStore` + safeStorage no hace falta para Cast):

```ts
castEnabled: boolean;       // default false
castPlayLocal: boolean;     // default true — “También en este PC”
castDeviceName: string;     // fuzzy match discovery
castDeviceHost: string;     // IP preferida si hay
castHttpPort: number;       // default p.ej. 18741
castAnnounceIp: string;     // '' = auto LAN
```

UI Settings (sección **Cast / Google Home**):

1. Switch **Enviar avisos al altavoz Cast**
2. Switch **También reproducir en este PC** (disabled si Cast off)
3. Campo dispositivo / IP
4. Botón **Buscar** → lista seleccionable
5. Botón **Probar** → frase corta vía Cast (y local según toggles)
6. Texto ayuda: misma Wi‑Fi, firewall, no cloud Google

IPC: `cast:discover`, `cast:test`, `settings:get/save` ya existentes ampliados.

## Flujo runtime

1. Panel arranca → si `castEnabled`, asegura HTTP server up
2. `consumeSonar` → `speakTipo` / `enqueueSpeak`
3. Resolver MP3 path
4. Si Cast on: `fileToCastUrl(path)` → `playCast(host, url)` (timeout corto, no bloquear cola >3–5 s)
5. Si local on: `playMp3` como hoy
6. Errores Cast: no tumbar cola; opcional status tray “Cast: sin dispositivo”

Cola: Cast y local pueden ir en paralelo; si Cast tarda, no retrasar local (Promise.allSettled).

## Fases de implementación

### C0 — Spike (½–1 día)

- [x] Script `scripts/cast-smoke.mjs` — HTTP + `castv2-client` + `bonjour-service` (MP3 AgentCrew, sin Google TTS)
- [x] Lib elegida: **`castv2-client` + `bonjour-service`** (no Google TTS)
- [x] Smoke Win: mDNS + play OK; HTTP con **Range 206** (sin eso → audio entrecortado en Cast)
- [ ] Confirmación humana: audio limpio en «Chromecast planta alta»

Comandos:

```bash
npm run cast:list
npm run cast:smoke -- --host <IP>
npm run cast:smoke -- --name "Chromecast"
```

**Stop C0:** usuario confirma audio correcto → pasar a C1.

### C1 — `@agentcrew/cast` + HTTP serve

- [x] Package `@agentcrew/cast` (discover / playMp3OnCast / CastHttpServer Range 206)
- [x] Tests httpServe + matchDevice
- [x] `castRuntime.ts` en panel + stop en `before-quit`
- [x] Smoke usa el package (`npm run cast:smoke`)

### C2 — Settings on/off + persistencia

- [x] `AppSettings` = TTS + Cast en `settingsStore`
- [x] UI sección Cast (enable, playLocal, device, Buscar, Probar Cast)
- [x] IPC `cast:discover` / `cast:test`
- [x] Defaults: Cast **off**

### C3 — Cablear `speakTipo` / `resolveAndSpeak`

- [x] `SpeakOptions.afterMp3` + `playLocal` en `@agentcrew/tts`
- [x] Panel `speakCastOpts()` según castEnabled / castPlayLocal
- [x] `aviso=sonido` / beep: sin Cast (solo WAV local)

### C4 — Docs + roadmap + QA

- [x] Cómo usar (abajo) + punteros estado/roadmap
- [x] QA C0–C3 PASS (modelo barato)

## Cómo usar

1. Abrir **Ajustes TTS** (click AC / Settings)
2. Sección **Cast / Google Home** → activar **Enviar avisos al altavoz Cast**
3. **Buscar** → elegir p.ej. `Chromecast planta alta`
4. **Probar Cast** (debe sonar MP3 AgentCrew)
5. Opcional: desmarcar **También reproducir en este PC**
6. Guardar; reiniciar panel si hacía falta

```bash
npm run cast:list
npm run cast:smoke -- --name "planta alta"
```

## Criterios de hecho (MVP)

1. Cast **off** → comportamiento idéntico al actual
2. Cast **on** + dispositivo OK + “También en PC” → frase en Home **y** PC
3. Cast **on** + “También en PC” off → solo Home
4. Sin dispositivo / timeout → no rompe panel; PC sigue si aplica
5. Mute → silencio total
6. Settings persisten entre reinicios

## Fuera de alcance (post-MVP)

- Varios Homes a la vez
- Agrupar “speakers” / multi-room
- Cast de WAV beep
- App Cast custom
- Cloud Google / OAuth
- macOS/Linux parity testing exhaustivo (código sí; QA manual Win primero)

## Riesgos y mitigación

| Riesgo | Mitigación |
|--------|------------|
| Lib Cast muerta / rompe Nest nuevo | Spike C0; abstracción `playUrl` propia |
| Firewall | Doc + puerto configurable + status error legible |
| VPN roba LAN IP | `castAnnounceIp` manual |
| Cola TTS lenta por Cast | timeout + no await estricto antes de local |
| Seguridad HTTP abierto en LAN | Solo paths bajo voces/cache; path opaco/hash; no directory listing |

## Orden sugerido de to-dos al ejecutar

1. `c0-spike` — smoke script Cast
2. `c1-pkg-http` — package + HTTP serve en panel
3. `c2-settings` — toggles + discover UI
4. `c3-wire-speak` — speakTipo/resolve
5. `c4-docs-qa` — docs + QA PASS

Un to-do a la vez; QA barato entre to-dos (`qa-todo-gate`).
