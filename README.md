# AgentCrew

Franja desktop para ver agentes [Cursor](https://cursor.com): hooks → estado → UI + avisos de voz.

## Requisitos

- Windows 10/11 (AppBar nativo; macOS/Linux: sticky sin reserva de pantalla)
- Node.js 20+
- [Cursor](https://cursor.com)

## Instalación rápida (Windows)

**Sin clonar** (PowerShell; requiere [Node 20+](https://nodejs.org)):

```powershell
irm https://raw.githubusercontent.com/SoulThalion/AgentCrew/main/installer/bootstrap.ps1 | iex
```

Instala en `%LOCALAPPDATA%\AgentCrew` (build + hooks + watcher). Con flags:

```powershell
$b = "$env:TEMP\agentcrew-boot.ps1"
irm https://raw.githubusercontent.com/SoulThalion/AgentCrew/main/installer/bootstrap.ps1 -OutFile $b
& $b -Panel          # arranca panel al terminar
& $b -Ref v0.1.0     # tag concreto
```

**Con git:**

```bash
git clone https://github.com/SoulThalion/AgentCrew.git
cd AgentCrew
npm run install:all
# Abre Cursor: el watcher levanta el panel solo.
# (opcional) npm run panel:start
```

Solo el `.exe` del panel (sin hooks): `npm run panel:dist` → `apps/panel/release/`, o Releases en GitHub cuando publiquemos.

O paso a paso:

```bash
npm install
npm test
npm run build
npm run install-hooks    # reinicia Cursor después
npm run install-watch    # Startup: panel ↔ Cursor IDE
npm run panel:start      # franja manual si no usas watch
```

El instalador copia hooks a `~/.cursor/hooks/`, fusiona `hooks.json` e instala el **watcher** (abre panel al abrir Cursor, lo cierra al cerrar el IDE). Detalle: [docs/15-cursor-watch.md](./docs/15-cursor-watch.md). Estado runtime: `~/.cursor/hooks/state/`.

## Uso

- La franja muestra agentes activos (colores = estado).
- Click en un agente → enfoca el chat en Cursor (Windows).
- Click en **AC** (arriba) → ajustes TTS:
  - Proveedor: ninguno / **Fish** / **ElevenLabs**
  - API keys (guardadas con `safeStorage`)
  - Probar voz / mute / volumen
- Frases conocidas usan MP3 en `voces/` (sin llamar API).
- Bandeja del sistema: mute, volumen, aviso voz/sonido, muestra de sprites.

## Límites dock

| OS | Comportamiento |
|----|----------------|
| Windows | AppBar — reserva área al maximizar |
| macOS | Sticky; ventanas pueden solapar |
| Linux | Sticky; Wayland sin strut fiable |

## Docs

- [docs/estado.md](./docs/estado.md)
- [docs/09-roadmap.md](./docs/09-roadmap.md)
- [docs/12-tts-proveedores.md](./docs/12-tts-proveedores.md)
- [AGENTS.md](./AGENTS.md)

## Scripts

| Comando | Qué hace |
|---------|----------|
| `npm run install:all` | deps + voces + build + hooks + watcher |
| `npm run install-watch` | solo watcher Startup ↔ Cursor |
| `npm run panel:start` | panel producción local |
| `npm run panel:dist` | `.exe` (nsis + portable) → `apps/panel/release/` |
| `npm run panel` | panel + Vite HMR |
| `npm test` | tests core/hooks/tts/dock |

## Licencia

Ver [LICENSE](./LICENSE).
