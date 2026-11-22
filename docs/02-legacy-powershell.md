# Legacy PowerShell (origen)

Fuente a migrar (no ampliar). **No vive en este repo.**

Ruta: `C:\Users\eomer\Downloads\panel-agentes`  
(scripts `.ps1` + `voces/` + `hooks.json`).

Este repo (**AgentCrew**) es el destino de la migración Electron/TS.

## Piezas

| Archivo | Rol |
|---------|-----|
| `panel-agentes.ps1` (~3430 líneas) | UI WPF: franja, personajes Canvas, AppBar, poll de state, focus Cursor |
| `alarma-agente.ps1` (~1323) | Hooks: stdin → estado/audio/vigilante inactividad |
| `alarma-plan.ps1` | Aviso al cerrar plan (`CreatePlan`) |
| `abrir-panel.ps1` | Arranca panel o señal `mostrar.txt` |
| `instalar.ps1` | Copia a `~/.cursor/hooks` + fusiona `hooks.json` |
| `hooks.json` | Eventos Cursor → comandos PowerShell |
| `voces/frase-*.mp3` | ~54 MP3 precacheados (`frase-` + SHA256-16 UTF-8). **Reutilizar en AgentCrew (D6)** |

## Flujo legacy

```text
Cursor hook → alarma-agente.ps1 → state/*.txt (+ audio)
panel-agentes.ps1 (poll) → lee state → pinta franja
```

## Deuda conocida

- Encoding / mojibake (reparadores ad-hoc)
- Paths hardcodeados (usuario Adriel en `abrir-panel.ps1`)
- UI dibujada a mano en script (mantenimiento caro)
- Solo Windows

## Uso en migración

1. Extraer reglas de estado/eventos a `packages/core` + tests
2. Reemplazar `alarma-agente.ps1` por CLI Node
3. Reemplazar `panel-agentes.ps1` por Electron
4. **Copiar `voces/` entero** a AgentCrew; conservar algoritmo de hash (D6)
5. Cuando MVP Node pase smoke en Windows, dejar PS solo como referencia en Downloads
