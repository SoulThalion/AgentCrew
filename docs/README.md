# AgentCrew — documentación

Panel de agentes Cursor (migración desde un panel PowerShell/WPF). Repo: este directorio. Legacy: ver [02-legacy-powershell.md](./02-legacy-powershell.md) (copia local opcional; no es dependencia).

Índice para no perder contexto entre chats. Orden si empiezas de cero:

| # | Documento | Para qué |
|---|-----------|----------|
| 0 | [estado.md](./estado.md) | Qué está hecho / pendiente ahora |
| 1 | [01-vision.md](./01-vision.md) | Qué es el producto y para quién |
| 2 | [02-legacy-powershell.md](./02-legacy-powershell.md) | Origen PowerShell / WPF a migrar |
| 3 | [03-decisiones.md](./03-decisiones.md) | Decisiones (stack, dock, IPC) |
| 4 | [04-dominio.md](./04-dominio.md) | Estados, prioridad, conceptos |
| 5 | [05-contrato-estado.md](./05-contrato-estado.md) | Archivos en `hooks/state/` |
| 6 | [06-hooks-cursor.md](./06-hooks-cursor.md) | Eventos Cursor → CLI |
| 7 | [07-arquitectura.md](./07-arquitectura.md) | Monorepo, procesos Electron |
| 8 | [08-ui-panel.md](./08-ui-panel.md) | Franja, personajes, interacción |
| 9 | [09-roadmap.md](./09-roadmap.md) | Fases de construcción |
| 10 | [10-dock-plataformas.md](./10-dock-plataformas.md) | AppBar / Mac / Linux |
| 11 | [11-contexto-agentes.md](./11-contexto-agentes.md) | Prompt para chats nuevos |
| 12 | [12-tts-proveedores.md](./12-tts-proveedores.md) | Fish + ElevenLabs, Settings, keys |
| 15 | [15-cursor-watch.md](./15-cursor-watch.md) | Abrir/cerrar panel con el IDE Cursor |

Raíz: [AGENTS.md](../AGENTS.md). Rules/skills: `.cursor/rules/`, `.agents/skills/`.

## Reglas de oro

1. **Un panel, tres docks.** UI compartida; solo `packages/dock-*` diverge por SO.
2. **Hooks delgados.** Cursor llama Node; lógica de dominio en `packages/core`.
3. **No inventar reserva de pantalla en macOS/Wayland.** Ver `10-dock-plataformas.md`.
4. **Legacy PS = referencia**, no ampliarlo. Paridad vía tests de `core` + contrato de estado.
