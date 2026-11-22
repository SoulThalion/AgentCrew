# UI del panel

## Composición

- Franja vertical ~72 px en borde derecho
- Sprite canvas 56×66 por agente = `Nuevo-Sprite` legacy (obra, lupa, humo, Zzz, minis…)
- Footer: Mudo | Muestra | Cerrar (MDL2)
- Bandeja sistema: mute/volumen/cuando/aviso/probar (como NotifyIcon legacy)

## Interacción

| Acción | Efecto |
|--------|--------|
| Click personaje | Enfocar ventana/chat Cursor (OS-specific) |
| Footer Mudo / Muestra / x | Silenciar / demo poses / Parar franja |
| Bandeja (tray) | Preferencias aviso + volumen + TTS settings |
| Señal `mostrar.txt` | Traer franja al frente |

## Settings (TTS)

Ventana o panel de ajustes (no en el hero de la franja):

- Proveedor: Fish | ElevenLabs | Ninguno
- Fish: API key (dev), voice/`reference_id`, modelo; leer también env `FISH_AUDIO_API_KEY` si el campo vacío
- ElevenLabs: API key, voice id, modelo
- Botón “Probar voz”
- Mute / volumen / política de aviso

## Visual

- Colores y etiquetas: `04-dominio.md`
- Animación ligera por pose (parpadeo, etc.) — paridad gradual con legacy
- Tema: rule `theme-light-dark` (franja oscura legacy; adaptar tokens)
- Tailwind first; componentes ≤ ~300–400 líneas (`frontend-component-size`)

## MVP UI (fase temprana)

Lista vertical de slots con color de estado + inicial/avatar simple. Personajes elaborados = fase pulido.

## Accesibilidad

Contraste de colores de estado; tooltips con texto, no solo color.
