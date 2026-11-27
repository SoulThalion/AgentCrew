# Resumen AgentCrew

Lectura única antes de implementar o de arreglar un issue. El resto de `docs/` solo si esta página no basta para el caso.

## Qué es

Franja desktop de agentes Cursor: hooks Node → `~/.cursor/hooks/state/` → panel Electron. Un panel, tres docks. Windows reserva área (AppBar). Mac y Wayland no tienen reserva pública. Legacy PowerShell no se amplía.

Stack: `apps/panel`, `packages/core`, `packages/hooks`, `packages/dock-*`. TTS: `voces/` + Fish/ElevenLabs. Español, caveman, QA con modelo barato.

## Issues

Dos ejes que ya se pisaron. Al arreglar uno, los tests del mismo eje siguen en verde. Si el fix cambia una fila, se reescribe aquí en el mismo cambio.

- **Sticky / foco:** #2 → #3 → #5 → #9 → #10 → #11 → #14 → #15
- **Voz aprobación:** #8 → #12 → #13 → #16

| # | Qué sigue cierto | Prueba |
|---|------------------|--------|
| 1 | El panel no se cierra solo mientras Cursor sigue abierto (~30–60 s) | watcher (manual) |
| 2 | Un slot por tab UI. Tres sticky iguales no se cruzan | `composeChats` «issue #2» |
| 3 | Activo sin sticky no pinta `trabajando` en un pin idle | `composeChats` «issue #3» |
| 4 | `tasklist` flake no escribe `cerrar.txt` con Cursor vivo | watcher |
| 5 | Chat nuevo sin match de prompt no escribe título en el pin focused idle | `learnTitles` «foco idle»; `composeChats` «issue #5» |
| 6 | `install-hooks` quita `alarma-agente.ps1` | `install-hooks-legacy.test.mjs` |
| 7 | Cast elige NIC en la misma /24 que el dispositivo | `lanIp` «issue #7» |
| 8 | Card Run+Skip con el texto de este comando, y sin proceso → sonar. Auto-run con proceso → silencio. Smart suena en el hook | `approvalConfirm` «card de este comando»; hooks «aprobacion smart» |
| 9 | Prosa larga que solo menciona un título no hace fuzzy. Follow-up corto no suelta el sticky | `composeChats` «prosa larga»; `learnTitles` «follow-up» |
| 10 | «ticket/jira» + id ≥3 matchea ese tab y suelta el sticky de otro | `composeChats` / `learnTitles` «issue #10» |
| 11 | «Implement the plan…» se queda en el Ticket focused. Si el ocupante solo menciona el ticket, el plan lo toma. Un solo tab + activo sin título → ese activo | `composeChats` / `learnTitles` «issue #11» |
| 12 | `?` dentro de una URL no es pregunta. Sin card y sin shell de usuario, tras ~4 s → sonar (Run en otra ventana) | hooks «? en URL»; `approvalConfirm` «tras la espera» |
| 13 | PowerShell/cmd/bash nuevo → silencio, también si UIA ve Run en otra ventana. La sonda WMI/UIA del panel no cuenta | `approvalConfirm` «powershell nuevo»; «sonda WMI» |
| 14 | El plan-build va al único tab Ticket. El focused que no es ese Ticket se queda con su chat | `composeChats` / `learnTitles` «issue #14» |
| 15 | Quien ya tiene el sticky del tab focused no lo pierde ante un chat ajeno, salvo plan-build en tab Ticket o prompt que sí matchea | `composeChats` / `learnTitles` «issue #15» |
| 16 | Run/Skip de otra ventana no suena al momento. Card de este comando sin proceso → sonar. Con proceso → silencio. Sin shell, tras la espera, sí suena (#12) | `approvalConfirm` «Run/Skip ajeno»; «card de este comando»; «tras la espera» |

Tensiones ya aceptadas:

- **#12 y #16.** Run/Skip ajeno no dispara al momento. Si a los ~4 s no arrancó shell, sí suena: es el Run de una ventana que UIA no muestra.
- **#8 y #16.** La card con el texto de este comando suena ya. Un Run/Skip sin ese texto no cuenta como esa card.
- **#13 y #16.** Con proceso no suena aunque esa card sea la del comando.
- **#11 y #14.** El plan solo se fuerza al focused si ese título es tab Ticket. Si el focused es otro chat, el plan pasa al Ticket.
- **#5 y #14.** El chat que recupera el focused solo se ata si el plan acaba de salir de ese tab. Un pin idle vacío no recibe un chat nuevo.

Issue nuevo: fila en esta tabla, con su test. Luego los tests del eje.

## Audio

- Volumen del slider (0–100) se guarda en `volumen.txt` y el MP3 lo usa. Sin ese archivo, no se sustituye el valor de ajustes por 100. Pruebas: `playVolume`, `statePrefsVolume`.

## Ampliar

| Duda | Documento |
|------|-----------|
| Hecho / pendiente / siguiente paso | [estado.md](./estado.md) |
| Índice del resto | [README.md](./README.md) |
| Estados y prioridad | [04-dominio.md](./04-dominio.md) |
| Archivos de `hooks/state/` | [05-contrato-estado.md](./05-contrato-estado.md) |
| Decisiones de stack o dock | [03-decisiones.md](./03-decisiones.md) |
| TTS, watcher, cast | [12](./12-tts-proveedores.md), [15](./15-cursor-watch.md), [16](./16-plan-cast.md) |
