# AgentCrew

Franja desktop al borde de la pantalla para ver los agentes de [Cursor](https://cursor.com): estado en vivo, click para abrir el chat, avisos por voz o sonido, y consumo Inc/Otr.

```
Cursor (hooks) → ~/.cursor/hooks/state/ → panel Electron (AppBar) + TTS
```

## Requisitos

| Qué | Notas |
|-----|--------|
| **Windows 10/11** | AppBar nativo (reserva sitio al maximizar). macOS/Linux: sticky, sin reserva fiable |
| **Node.js 20+** | [nodejs.org](https://nodejs.org) |
| **Cursor** | IDE instalado; tras instalar hooks, **reinicia Cursor** |

---

## Instalación

### Opción A — Sin clonar (recomendado)

PowerShell:

```powershell
irm https://raw.githubusercontent.com/SoulThalion/AgentCrew/main/installer/bootstrap.ps1 | iex
```

Instala en `%LOCALAPPDATA%\AgentCrew` (deps, build, hooks, watcher).

```powershell
$b = "$env:TEMP\agentcrew-boot.ps1"
irm https://raw.githubusercontent.com/SoulThalion/AgentCrew/main/installer/bootstrap.ps1 -OutFile $b
& $b -Panel          # arranca el panel al terminar
& $b -Ref v0.1.0     # tag concreto
```

### Opción B — Con git

```bash
git clone https://github.com/SoulThalion/AgentCrew.git
cd AgentCrew
npm run install:all
```

Abre (o reinicia) Cursor: el **watcher** suele levantar el panel solo. Si no: `npm run panel:start`.

### Opción C — Paso a paso

```bash
npm install
npm run build
npm run install-hooks    # → ~/.cursor/hooks/ + hooks.json
npm run install-watch    # Startup Windows ↔ Cursor
npm run panel:start
```

### Qué instala

| Pieza | Dónde |
|--------|--------|
| Hooks Node | `~/.cursor/hooks/` (+ merge en `hooks.json`) |
| Estado runtime | `~/.cursor/hooks/state/` |
| Watcher | Startup: abre panel con Cursor, lo cierra al salir del IDE |
| Voces MP3 | carpeta `voces/` del repo / install |
| Panel | build Electron local (o `panel:dist` → `.exe`) |

Detalle watcher: [docs/15-cursor-watch.md](./docs/15-cursor-watch.md).

---

## Primer uso

1. Reinicia **Cursor** después de instalar hooks.
2. Abre uno o más chats/agentes.
3. Debería aparecer la **franja** a la derecha (o `npm run panel:start`).
4. Icono en la **bandeja** del sistema → preferencias rápidas.
5. Ajustes TTS (bandeja → Ajustes, o señal de ajustes) → conecta Fish/ElevenLabs si quieres voz más allá de los MP3 locales.

---

## La franja (sidebar)

### Qué muestra

- **Una fila por chat abierto** detectado en Cursor (tabs `…, Chat Editors`), más agentes activos/terminado-sin-leer que aún no tienen tab.
- Sprite animado según **estado** (color = tipo de trabajo).
- Fondo más claro en el chat **enfocado** (el tab activo).
- Hover → ficha: título, estado, última frase.
- Click → intenta **abrir/enfocar** ese chat en Cursor (Windows).

### Estados (resumen)

| Estado | Significado típico |
|--------|-------------------|
| Trabajando / Planificando / Leyendo / Subagentes | Agente en marcha |
| Esperando | Pregunta / espera tu respuesta |
| Terminado | Acabó y **aún no lo has “visto”** (abriendo el chat) |
| Detenido | Idle / terminado ya leído |
| Atento | Chat abierto/enfocado en idle |
| Error | Fallo / stop con error |

### Footer

| Elemento | Qué es |
|----------|--------|
| **Inc** / **Otr** | % consumo Cursor (incluido / otros modelos) |
| Mudo | Silencia avisos |
| Muestra | Demo de poses (sprites) |
| × | Cierra / para la franja |

---

## Bandeja del sistema

Clic derecho (o menú del icono AgentCrew):

| Opción | Efecto |
|--------|--------|
| Silenciar / volumen | Mute y nivel |
| Aviso **voz** / **sonido** | Frases MP3/TTS vs WAV del sistema |
| Avisar solo si estoy **inactivo** / **siempre** | Cuándo suenan los avisos |
| Probar voz | Dispara una frase de prueba |
| Ajustes TTS | Ventana de proveedor y API keys |
| Mostrar / ocultar franja | Visibilidad del panel |

---

## Avisos de voz y sonido

### Orden de reproducción (voz)

1. MP3 en `voces/frase-<hash>.mp3` (frases conocidas, sin API)
2. Caché del proveedor (Fish / ElevenLabs)
3. Llamada API al proveedor activo
4. Fallback: beep / WAV del sistema

### Frases típicas

- Fin de un agente: *«Señor, he terminado.»*
- Pregunta / aprobación / búsqueda / plan / error (variantes)
- Varios agentes: si **≥2** trabajaban y **todos** acaban, y sigues **inactivo ~2 min** (o modo “siempre”), suena: *«Señor, todos los agentes han terminado.»*
- Umbrales de consumo Inc/Otr (50 / 65 / 80 / 90 / 95 / 100 %)

Modo **sonido**: WAVs de Windows (alarma / notify), no TTS.

---

## Conectar servicios de voz (TTS)

Abre **Ajustes TTS** (bandeja → Ajustes). Hay barra fija **Guardar** / **Probar voz**; también auto-guarda al editar.

### Ninguno

Solo MP3 locales + sonidos de sistema. Sin API key.

### Fish Audio

1. Proveedor → **Fish Audio**
2. **Conectar Fish (portal)** → crea una API key en [fish.audio/app/api-keys](https://fish.audio/app/api-keys) (REST usa API key; **no** hay OAuth para TTS)
3. Pega la **API key** (se cifra con `safeStorage` de Electron)
4. Opcional: `reference_id` (voz), modelo (`s2.1-pro-free`, etc.)
5. Alternativa: variables de entorno `FISH_API_KEY` o `FISH_AUDIO_API_KEY`
6. **Probar voz** → debe oírse algo; en UI: “(key presente)”

Detalle: [docs/12-tts-proveedores.md](./docs/12-tts-proveedores.md).

### ElevenLabs

1. Proveedor → **ElevenLabs**
2. API key + **Voice ID** + modelo (p.ej. `eleven_multilingual_v2`)
3. Guardar / Probar voz

Un solo proveedor activo a la vez.

### Regenerar un MP3 con Fish (dev)

```bash
node scripts/gen-phrase-mp3.mjs todos
```

Usa la key de Ajustes y escribe en `voces/frase-<hash>.mp3`.

---

## Watcher Cursor ↔ panel

| Evento | Qué pasa |
|--------|----------|
| Abres Cursor | Watcher arranca el panel si no corre |
| Cierras Cursor (~10 s) | El panel hace quit |
| Login Windows | Startup lanza el watcher |

**Desactivar follow:** crea `~/.cursor/hooks/state/watch-off.txt`, o quita el `.vbs` de Startup, o `AGENTCREW_FOLLOW_CURSOR=0` (solo auto-quit del panel).

---

## Empaquetar .exe

```bash
npm run panel:dist
```

Salida: `apps/panel/release/` (NSIS + portable). El `.exe` solo es el panel; hooks/watcher siguen haciendo falta vía `install:all` / bootstrap.

---

## Scripts útiles

| Comando | Qué hace |
|---------|----------|
| `npm run install:all` | deps + voces + build + hooks + watcher |
| `npm run install-hooks` | Solo hooks |
| `npm run install-watch` | Solo watcher Startup |
| `npm run panel:start` | Panel (build + Electron) |
| `npm run panel` | Panel + Vite HMR (dev) |
| `npm run panel:dist` | Generar instaladores `.exe` |
| `npm test` | Tests core / hooks / tts / dock |

---

## Límites del dock

| OS | Comportamiento |
|----|----------------|
| Windows | AppBar — reserva área al maximizar |
| macOS | Always-on-top; otras ventanas pueden solapar |
| Linux | Sticky; Wayland sin strut fiable |

---

## Solución rápida de problemas

| Síntoma | Qué mirar |
|---------|-----------|
| No hay franja | `npm run panel:start`; watcher/Startup; reinicia Cursor tras hooks |
| Franja sin agentes | ¿Hooks instalados? ¿chats abiertos? Estado en `~/.cursor/hooks/state/` |
| Menos sprites que chats | El scrape UIA a veces no ve todos los tabs; orphans activos igual pueden salir |
| Sin voz | Avisos no mute; modo voz; MP3 en `voces/`; Fish key + Probar voz |
| Panel no sigue a Cursor | `install-watch`; quitar `watch-off.txt` |
| Ventilador / CPU alta del panel | Cerrar y relanzar tras update; scrape UIA ya es proceso PS persistente (no spawnea cada 2 s). Si sigue alto: menos chats Cursor abiertos |

---

## Documentación

| Doc | Contenido |
|-----|-----------|
| [docs/estado.md](./docs/estado.md) | Estado del proyecto (corto) |
| [docs/08-ui-panel.md](./docs/08-ui-panel.md) | UI franja / bandeja |
| [docs/12-tts-proveedores.md](./docs/12-tts-proveedores.md) | Fish / ElevenLabs |
| [docs/15-cursor-watch.md](./docs/15-cursor-watch.md) | Watcher |
| [docs/05-contrato-estado.md](./docs/05-contrato-estado.md) | Archivos en `state/` |
| [docs/09-roadmap.md](./docs/09-roadmap.md) | Roadmap |
| [AGENTS.md](./AGENTS.md) | Contexto para agentes de código |

## Licencia

Ver [LICENSE](./LICENSE).
