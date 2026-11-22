# TTS — proveedores y cuenta del usuario

Complementa D6 / D10. Voces precache en `voces/` primero; proveedores solo si falta MP3 o el usuario regenera.

## Objetivo UX

Pantalla/ajustes en el panel (o ventana Settings) donde el usuario **conecta su propia cuenta**:

1. Elige proveedor: **Fish Audio** | **ElevenLabs** | ninguno (solo MP3 locales + fallback OS)
2. Pega credenciales / completa flujo de conexión
3. Elige voz (voice id / modelo) y prueba (“decir frase de ejemplo”)
4. Guarda en almacén local cifrado o OS keychain — **nunca en git ni en `voces/`**

## Fish Audio

| Método | Uso |
|--------|-----|
| **API key** | Settings (safeStorage) y/o env `FISH_API_KEY` / `FISH_AUDIO_API_KEY` |
| **Portal (conectar)** | Botón Settings → `shell.openExternal` a `https://fish.audio/app/api-keys` → usuario crea key y pega. **No hay OAuth para REST TTS** (2026): Fish OAuth solo aplica al MCP server, no al endpoint `/v1/tts` |

Campos Settings: API key, `reference_id` / voz, modelo (`s2.1-pro-free` / `s2.1-pro`…), idioma `es`.
## ElevenLabs

| Campo | Notas |
|-------|--------|
| API key | Cuenta del usuario |
| Voice ID | Selector o pegar id |
| Model | p.ej. `eleven_multilingual_v2` (configurable) |
| Formato | MP3 → misma carpeta cache runtime (no pisar `voces/` de assets salvo export explícito) |

Compatible en paralelo con Fish: un **proveedor activo** a la vez (setting `tts.provider`).

## Orden de reproducción

1. Asset `voces/frase-<hash>.mp3` (commit / instalador)
2. Cache runtime del proveedor activo (`state/cache/tts-…` o similar)
3. Llamada API proveedor activo → guardar cache
4. Fallback TTS del sistema (OneCore / say / espeak)

## Abstracción código

```text
packages/core o packages/tts/
  TtsProvider: synthesize(text) → Buffer | path
  FishProvider
  ElevenLabsProvider
  LocalMp3Resolver (hash + voces/)
```

Hooks/panel llaman al resolver, no a Fish/Eleven directo.

## Seguridad

- Keys solo en storage de app / env local (`docs/03-decisiones.md` D10)
- No loguear keys; UI con show/hide
- Skills `security-*` al implementar Settings
