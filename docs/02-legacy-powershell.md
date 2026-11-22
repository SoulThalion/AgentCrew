# Legacy PowerShell (origen)

Fuente histórica a migrar (no ampliar). **No vive en este repo.**

Si conservas una copia local del panel WPF original, úsala solo como referencia de comportamiento (sprites, avisos, AppBar). No la trates como dependencia del build.

Scripts típicos del legacy: `panel-agentes.ps1`, `alarma-agente.ps1`, `alarma-plan.ps1`, `abrir-panel.ps1`, `instalar.ps1`, más `hooks.json` y `voces/frase-*.mp3`.

Este repo (**AgentCrew**) es el destino de la migración Electron/TS.

## Piezas

| Archivo | Rol |
|---------|-----|
| `panel-agentes.ps1` | UI WPF: franja, personajes Canvas, AppBar, poll de state, focus Cursor |
| `alarma-agente.ps1` | Hooks: stdin → estado/audio/vigilante inactividad |
| `alarma-plan.ps1` | Aviso al cerrar plan (`CreatePlan`) |
| `abrir-panel.ps1` | Arranca panel o señal `mostrar.txt` |
| `instalar.ps1` | Copia a `~/.cursor/hooks` + fusiona `hooks.json` |
| `hooks.json` | Eventos Cursor → comandos PowerShell |
| `voces/frase-*.mp3` | MP3 precacheados (`frase-` + SHA256-16 UTF-8). **Reutilizar en AgentCrew (D6)** |

## Flujo legacy

```text
Cursor hook → alarma-agente.ps1 → state/*.txt (+ audio)
panel-agentes.ps1 (poll) → lee state → pinta franja
```

## Deuda conocida

- Encoding / mojibake (reparadores ad-hoc)
- Paths hardcodeados de usuario en scripts antiguos
- UI dibujada a mano en script (mantenimiento caro)
- Solo Windows

## Uso en migración

1. Extraer reglas de estado/eventos a `packages/core` + tests
2. Reemplazar `alarma-agente.ps1` por CLI Node
3. Reemplazar `panel-agentes.ps1` por Electron
