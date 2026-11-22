# Visión

## Qué es

**AgentCrew** (panel-agentes): franja estrecha en el borde del escritorio. Un personaje por agente/conversación de Cursor. Color y pose = estado (trabajando, esperando, error…). Alarmas/voz cuando pide atención o termina.

## Para quién

Usuario que deja varios agentes Cursor en marcha y necesita ver de un vistazo quién espera respuesta, sin mirar cada chat.

## Propuesta de valor

1. **Visibilidad** de estados concurrentes
2. **Reserva de espacio** donde el OS lo permita (Windows AppBar) para que ventanas no tapen la franja
3. **Avisos** (sonido/TTS) configurables (mute, umbral inactividad)
4. **Click** → enfocar el chat Cursor correspondiente (best-effort por SO)

## Fuera de visión (por ahora)

- Sustituir la UI de Cursor
- Orquestar agentes (eso es Cursor / AgentCrew)
- Multi-usuario / servidor en la nube
- Rediseño visual mayor respecto al legacy (paridad primero)

## Éxito MVP

En Windows: instalar → hooks Cursor → franja derecha con estados vivos + sonido al esperar/terminar + AppBar. Mac/Linux: misma UI y hooks; dock sticky con límites documentados.
