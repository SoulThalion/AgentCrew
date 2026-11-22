# AgentCrew

Franja desktop para ver agentes [Cursor](https://cursor.com): hooks → estado → UI + avisos de voz.

## Instalación rápida (Windows)

```bash
cd C:\Users\eomer\AgentCrew
npm run install:all
# reinicia Cursor
npm run panel:start
```

O paso a paso:

```bash
npm install
npm test
npm run build
npm run install-hooks    # reinicia Cursor después
npm run panel:start      # franja Electron
```

Legacy PowerShell (solo referencia): `C:\Users\eomer\Downloads\panel-agentes`

## Uso

- La franja muestra agentes activos (colores = estado).
- Click en un agente → enfoca Cursor (Windows).
- Click en **AC** (arriba) → ajustes TTS:
  - Proveedor: ninguno / **Fish** / **ElevenLabs**
  - API keys (guardadas con `safeStorage`)
  - Probar voz / mute / volumen
- Frases conocidas usan MP3 en `voces/` (sin llamar API).

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
| `npm run install:all` | deps + voces + build + hooks |
| `npm run panel:start` | panel producción local |
| `npm run panel:dist` | `.exe` (nsis + portable) → `apps/panel/release/` |
| `npm run panel` | panel + Vite HMR |
| `npm test` | tests core/hooks/tts/dock |
