# Regresiones (issues GitHub)

Catálogo de invariantes. Al arreglar un issue, los del **mismo eje** siguen en verde. Repo: [SoulThalion/AgentCrew](https://github.com/SoulThalion/AgentCrew/issues).

Dos ejes que ya se pisaron:

- **Sticky / foco:** #2 → #3 → #5 → #9 → #10 → #11 → #14
- **Voz aprobación:** #8 → #12 → #13

## Invariantes

| # | Qué debe seguir cierto | Prueba | Peligro al tocar |
|---|------------------------|--------|------------------|
| 1 | El panel no se cierra solo mientras Cursor sigue abierto por un ciclo de ~30–60 s | watcher (manual) | `cerrar.txt`, reinicio del panel |
| 2 | Un slot por tab UI. Tres sticky iguales con prompts distintos no se cruzan | `composeChats` «issue #2» | `byTitulo`, sticky compartido |
| 3 | Activo sin sticky no pinta `trabajando` en un pin idle | `composeChats` «issue #3» | bind de huérfano al focused |
| 4 | `tasklist` flake no escribe `cerrar.txt` con Cursor vivo | watcher | probe de proceso |
| 5 | Chat nuevo sin match de prompt no escribe título en el pin focused idle | `learnTitles` «activo huérfano + foco idle»; `composeChats` «issue #5» | focused-claim, `vacatedFocus` |
| 6 | `install-hooks` quita `alarma-agente.ps1` (doble TTS) | `scripts/tests/install-hooks-legacy.test.mjs` | merge de `hooks.json` |
| 7 | Cast elige NIC en la misma /24 que el dispositivo | `lanIp` «issue #7» | `pickLanIp` |
| 8 | Card Run visible → sonar `aprobacion`. Auto-run con proceso → silencio. Smart suena ya en el hook | `approvalConfirm` «auto-run»; hooks «aprobacion smart» | `approvalSonarDecision` |
| 9 | Prosa larga que solo menciona un título no hace fuzzy. Follow-up corto no suelta el sticky | `composeChats` «prosa larga»; `learnTitles` «follow-up» | `fuzzyTitleMatch`, pre-pass |
| 10 | «ticket/jira» + id ≥3 en prompt largo matchea ese tab y suelta el sticky de otro | `composeChats` «issue #10»; `learnTitles` «issue #10» | `strongTicket` |
| 11 | «Implement the plan…» en el tab Ticket focused se queda. Si el focused es ese Ticket y el ocupante solo lo menciona, el plan lo toma. Un solo tab + activo sin título → ese activo | `composeChats` / `learnTitles` «issue #11» | `isPlanBoilerplate`, focused-claim |
| 12 | Sin card y sin shell nuevo, tras la espera (~4 s) → sonar. `?` dentro de una URL no es pregunta | `approvalConfirm` «sin card y sin proceso»; hooks «? en URL» | gracia, `looksLikeQuestion` |
| 13 | PowerShell/cmd/bash nuevo (aunque el texto del comando no esté en `CommandLine`) → silencio. La sonda WMI/UIA del panel no cuenta | `approvalConfirm` «powershell nuevo»; «sonda WMI» | `userShellStarted` |
| 14 | El plan-build va al único tab Ticket. El focused que no es ese Ticket se queda con su chat | `composeChats` / `learnTitles` «issue #14» | rehome del plan, `isTicketTab` |

## Tensiones aceptadas

- **#12 y #13.** Un shell de usuario arrancado tras el marker cuenta como auto-run para ese candidato. Aprobación real sin card sigue sonando solo si no hay ese shell. Card visible sigue sonando (#8).
- **#11 y #14.** El plan solo se fuerza al focused si ese título es tab Ticket (`isTicketTab`). Si el focused es otro chat, el plan pasa al Ticket y el chat que estaba ahí recupera el focused.
- **#5 y #14.** El bind del chat que recupera el focused solo corre si el plan acaba de salir de ese tab (`vacatedFocus`). Un pin idle vacío no recibe un chat nuevo.

## Al añadir un issue

1. Fila nueva en esta tabla, con el test que la fija.
2. Si el fix cambia un invariante de arriba, reescribe esa fila en el mismo cambio.
3. Corre los tests de las filas del mismo eje.
