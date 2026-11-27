# Dominio

## Agente / chat

Unidad visible = conversación Cursor (`conversation_id` / `session_id`). Un slot en la franja.

## Estados de UI (`pose`)

| Valor | Significado | Color (legacy) |
|-------|-------------|----------------|
| `trabajando` | Agente activo | `#4FA3FF` |
| `subagentes` | Task/subagentes en curso | `#F27B4A` |
| `planificando` | Modo plan / pensamiento | `#A68BFF` |
| `leyendo` | Read/Grep/Glob… | `#A68BFF` |
| `esperando` | Pregunta / aprobación / búsqueda | `#FFB020` |
| `terminado` | Stop completed | `#3DD68C` |
| `atento` | Pendiente atención | `#A68BFF` |
| `error` | Stop error | `#FF5C5C` |
| `detenido` | Aborted | `#8A8A8A` |
| `vacio` | Slot vacío | `#8A8A8A` |

## Prioridad de orden en franja

Menor número = más arriba / más urgente:

`esperando|atento` (0) → `error` (1) → activos (2) → `terminado` (3) → `detenido` (4)

## Modo compositor

`agent` | `plan` (archivo `modo-<id>.txt`). Influye en estado tras herramientas (planificando vs trabajando).

## Tipos de aviso (audio)

`fin` | `error` | `pregunta` | `aprobacion` | `busqueda` | `plan` (+ variantes de voz)

Pipeline: texto → hash → `voces/frase-<hash>.mp3` → cache runtime → proveedor activo (Fish **o** ElevenLabs, Settings D10) → fallback OS. Ver D6 + `12-tts-proveedores.md`.

## Conceptos de control

- **Mute** (`mudo.txt`): silencia avisos (timestamp o flag)
- **Volumen** (`volumen.txt`, 0–100): el slider de Ajustes y la bandeja escriben el mismo archivo; la reproducción del MP3 lo aplica
- **Cuando avisar** (`cuando.txt`): p.ej. `siempre` vs umbral inactividad (~120 s)
- **Vigilante**: proceso/loop que suena tras idle si hay pendiente
- **Run** (`run-<id>.txt`): turno agent en curso

No inventar estados nuevos sin actualizar este doc + `core` + UI.
