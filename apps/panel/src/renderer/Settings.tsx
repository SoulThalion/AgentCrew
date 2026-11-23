import { useEffect, useRef, useState } from 'react';

type CastDeviceOpt = { name: string; host: string; port: number };

type SettingsView = {
  provider: 'none' | 'fish' | 'elevenlabs';
  muted: boolean;
  volume: number;
  fishApiKey: string;
  fishReferenceId: string;
  fishModel: string;
  elevenApiKey: string;
  elevenVoiceId: string;
  elevenModel: string;
  castEnabled: boolean;
  castPlayLocal: boolean;
  castDeviceName: string;
  castDeviceHost: string;
  castHttpPort: number;
  castAnnounceIp: string;
  hasFishKey?: boolean;
  hasElevenKey?: boolean;
};

const empty: SettingsView = {
  provider: 'none',
  muted: false,
  volume: 80,
  fishApiKey: '',
  fishReferenceId: '',
  fishModel: 's2.1-pro-free',
  elevenApiKey: '',
  elevenVoiceId: '',
  elevenModel: 'eleven_multilingual_v2',
  castEnabled: false,
  castPlayLocal: true,
  castDeviceName: '',
  castDeviceHost: '',
  castHttpPort: 18741,
  castAnnounceIp: '',
};

type DisplayOpt = { id: number; label: string; primary: boolean };

export function Settings() {
  const [s, setS] = useState<SettingsView>(empty);
  const [status, setStatus] = useState('');
  const [displays, setDisplays] = useState<DisplayOpt[]>([]);
  const [displayId, setDisplayId] = useState<number | null>(null);
  const [primaryId, setPrimaryId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [castDevices, setCastDevices] = useState<CastDeviceOpt[]>([]);
  const sRef = useRef(s);
  const readyRef = useRef(false);
  const lastSavedRef = useRef('');
  sRef.current = s;
  readyRef.current = ready;

  useEffect(() => {
    document.title = 'Ajustes TTS';
    const api = window.agentcrew;
    if (!api) {
      setStatus('API no disponible (preload)');
      return;
    }
    void api
      .getSettings()
      .then((raw) => {
        const loaded = { ...empty, ...(raw as SettingsView) };
        setS(loaded);
        lastSavedRef.current = JSON.stringify(loaded);
        setReady(true);
      })
      .catch(() => setStatus('No se pudieron cargar ajustes'));
    void api
      .listDisplays()
      .then((raw) => {
        const d = raw as {
          displays?: DisplayOpt[];
          currentId?: number;
          primaryId?: number;
        };
        setDisplays(Array.isArray(d.displays) ? d.displays : []);
        setDisplayId(d.currentId ?? null);
        setPrimaryId(d.primaryId ?? null);
      })
      .catch(() => setStatus('No se pudieron listar pantallas'));
  }, []);

  async function save(quiet = false) {
    const api = window.agentcrew;
    if (!api || !readyRef.current) return;
    const prev = sRef.current;
    try {
      const next = (await api.saveSettings(prev)) as SettingsView;
      // No pisar key en edición con máscara ********
      const merged: SettingsView = {
        ...empty,
        ...next,
        fishApiKey:
          prev.fishApiKey === '********' ? next.fishApiKey : prev.fishApiKey,
        elevenApiKey:
          prev.elevenApiKey === '********'
            ? next.elevenApiKey
            : prev.elevenApiKey,
      };
      setS(merged);
      lastSavedRef.current = JSON.stringify(merged);
      if (!quiet) setStatus('Guardado');
      else setStatus('Guardado automáticamente');
    } catch {
      setStatus('Error al guardar');
    }
  }

  function flushIfReady() {
    if (!readyRef.current) return;
    const snap = JSON.stringify(sRef.current);
    if (snap === lastSavedRef.current) return;
    void window.agentcrew?.saveSettings(sRef.current);
  }

  // Autosave al cambiar (debounce)
  useEffect(() => {
    if (!ready) return;
    const snap = JSON.stringify(s);
    if (snap === lastSavedRef.current) return;
    const t = window.setTimeout(() => {
      void save(true);
    }, 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al mutar s
  }, [s, ready]);

  useEffect(() => {
    const onHide = () => flushIfReady();
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
      flushIfReady();
    };
  }, []);

  async function test() {
    setStatus('Reproduciendo…');
    await save(true);
    const r = (await window.agentcrew.testVoice('Prueba de voz AgentCrew.')) as {
      ok: boolean;
      source: string;
    };
    setStatus(r.ok ? `OK (${r.source})` : `Falló (${r.source})`);
  }

  async function discoverCast() {
    setStatus('Buscando Cast…');
    const r = await window.agentcrew.discoverCast();
    setCastDevices(r.devices || []);
    if (!r.ok) {
      setStatus(r.error || 'Discover falló');
      return;
    }
    setStatus(r.devices.length ? `${r.devices.length} dispositivo(s)` : 'Ninguno en la red');
  }

  async function testCast() {
    setStatus('Cast: reproduciendo MP3 AgentCrew…');
    await save(true);
    const r = await window.agentcrew.testCast();
    if (r.ok && r.device) {
      setStatus(`Cast OK → ${r.device.name} (${r.device.host})`);
    } else {
      setStatus(r.error || 'Cast falló');
    }
  }

  function selectCastDevice(host: string) {
    const d = castDevices.find((x) => x.host === host);
    if (!d) {
      setS({ ...s, castDeviceHost: host });
      return;
    }
    setS({ ...s, castDeviceHost: d.host, castDeviceName: d.name });
  }

  return (
    <div
      className="flex flex-col bg-zinc-900 text-sm text-zinc-100"
      style={{ height: '100vh', width: '100%', boxSizing: 'border-box' }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <h1 className="mb-3 text-lg font-semibold">Ajustes TTS</h1>

        <label className="mb-3 block">
          <span className="text-zinc-400">Pantalla de la franja</span>
          <select
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 p-2"
            value={displayId ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value);
              const id =
                v == null || (primaryId != null && v === primaryId) ? null : v;
              void window.agentcrew.setDisplay(id).then((raw) => {
                setDisplays(raw.displays);
                setDisplayId(raw.currentId);
                setPrimaryId(raw.primaryId);
                setStatus('Franja movida');
              });
            }}
          >
            {displays.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-3 block">
          <span className="text-zinc-400">Proveedor</span>
          <select
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 p-2"
            value={s.provider}
            onChange={(e) =>
              setS({ ...s, provider: e.target.value as SettingsView['provider'] })
            }
          >
            <option value="none">Ninguno (solo MP3 locales)</option>
            <option value="fish">Fish Audio</option>
            <option value="elevenlabs">ElevenLabs</option>
          </select>
        </label>

        <label className="mb-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={s.muted}
            onChange={(e) => setS({ ...s, muted: e.target.checked })}
          />
          Silenciar
        </label>

        <label className="mb-3 block">
          <span className="text-zinc-400">Volumen ({s.volume})</span>
          <input
            type="range"
            min={0}
            max={100}
            value={s.volume}
            className="mt-1 w-full"
            onChange={(e) => setS({ ...s, volume: Number(e.target.value) })}
          />
        </label>

        {s.provider === 'fish' ? (
          <div className="mb-3 space-y-2 rounded border border-zinc-700 p-3">
            <div className="text-xs text-zinc-400">
              Fish {s.hasFishKey ? '(key presente)' : '(sin key)'}
            </div>
            <p className="text-[11px] leading-snug text-zinc-500">
              Fish REST autentica con API key (no OAuth). Abrí el portal, creá la key y
              pegala acá. Se guarda sola al pegar/editar; también con Guardar. Env:{' '}
              <code className="text-zinc-400">FISH_API_KEY</code>.
            </p>
            <button
              type="button"
              className="w-full rounded bg-sky-700 px-3 py-2 text-sm hover:bg-sky-600"
              onClick={async () => {
                setStatus('Abriendo portal Fish…');
                const r = await window.agentcrew.openFishPortal();
                setStatus(
                  r.ok ? 'Portal abierto — pegá la API key' : 'No se abrió portal',
                );
              }}
            >
              Conectar Fish (portal)
            </button>
            <input
              className="w-full rounded border border-zinc-700 bg-zinc-800 p-2"
              placeholder="API key Fish"
              value={s.fishApiKey}
              onChange={(e) => setS({ ...s, fishApiKey: e.target.value })}
              onBlur={() => void save(true)}
            />
            <input
              className="w-full rounded border border-zinc-700 bg-zinc-800 p-2"
              placeholder="reference_id / voz"
              value={s.fishReferenceId}
              onChange={(e) => setS({ ...s, fishReferenceId: e.target.value })}
            />
            <input
              className="w-full rounded border border-zinc-700 bg-zinc-800 p-2"
              placeholder="modelo"
              value={s.fishModel}
              onChange={(e) => setS({ ...s, fishModel: e.target.value })}
            />
          </div>
        ) : null}

        {s.provider === 'elevenlabs' ? (
          <div className="mb-3 space-y-2 rounded border border-zinc-700 p-3">
            <div className="text-xs text-zinc-400">
              ElevenLabs {s.hasElevenKey ? '(key presente)' : '(sin key)'}
            </div>
            <input
              className="w-full rounded border border-zinc-700 bg-zinc-800 p-2"
              placeholder="API key ElevenLabs"
              value={s.elevenApiKey}
              onChange={(e) => setS({ ...s, elevenApiKey: e.target.value })}
              onBlur={() => void save(true)}
            />
            <input
              className="w-full rounded border border-zinc-700 bg-zinc-800 p-2"
              placeholder="Voice ID"
              value={s.elevenVoiceId}
              onChange={(e) => setS({ ...s, elevenVoiceId: e.target.value })}
            />
            <input
              className="w-full rounded border border-zinc-700 bg-zinc-800 p-2"
              placeholder="modelo"
              value={s.elevenModel}
              onChange={(e) => setS({ ...s, elevenModel: e.target.value })}
            />
          </div>
        ) : null}

        <div className="mb-3 space-y-2 rounded border border-zinc-700 p-3">
          <div className="text-xs font-medium text-zinc-300">Cast / Google Home</div>
          <p className="text-[11px] leading-snug text-zinc-500">
            Mismo MP3 AgentCrew (no voz Google). Misma Wi‑Fi. Firewall puede bloquear el
            puerto {s.castHttpPort}.
          </p>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={s.castEnabled}
              onChange={(e) => setS({ ...s, castEnabled: e.target.checked })}
            />
            Enviar avisos al altavoz Cast
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={s.castPlayLocal}
              disabled={!s.castEnabled}
              onChange={(e) => setS({ ...s, castPlayLocal: e.target.checked })}
            />
            También reproducir en este PC
          </label>
          <label className="block">
            <span className="text-zinc-400">Dispositivo</span>
            <select
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 p-2 disabled:opacity-50"
              disabled={!s.castEnabled}
              value={s.castDeviceHost}
              onChange={(e) => selectCastDevice(e.target.value)}
            >
              <option value="">— elegir tras buscar —</option>
              {s.castDeviceHost &&
              !castDevices.some((d) => d.host === s.castDeviceHost) ? (
                <option value={s.castDeviceHost}>
                  {s.castDeviceName || s.castDeviceHost} ({s.castDeviceHost})
                </option>
              ) : null}
              {castDevices.map((d) => (
                <option key={d.host} value={d.host}>
                  {d.name} ({d.host})
                </option>
              ))}
            </select>
          </label>
          <input
            className="w-full rounded border border-zinc-700 bg-zinc-800 p-2 disabled:opacity-50"
            placeholder="IP manual (opcional)"
            disabled={!s.castEnabled}
            value={s.castDeviceHost}
            onChange={(e) =>
              setS({ ...s, castDeviceHost: e.target.value.trim() })
            }
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded bg-zinc-700 px-3 py-2 text-sm hover:bg-zinc-600 disabled:opacity-50"
              disabled={!s.castEnabled}
              onClick={() => void discoverCast()}
            >
              Buscar
            </button>
            <button
              type="button"
              className="rounded bg-zinc-700 px-3 py-2 text-sm hover:bg-zinc-600 disabled:opacity-50"
              disabled={!s.castEnabled || !s.castDeviceHost}
              onClick={() => void testCast()}
            >
              Probar Cast
            </button>
          </div>
        </div>

        {status ? <p className="mb-2 text-xs text-zinc-400">{status}</p> : null}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-zinc-700 bg-zinc-900 p-3">
        <button
          type="button"
          className="rounded bg-sky-600 px-3 py-2 font-medium hover:bg-sky-500"
          onClick={() => void save(false)}
        >
          Guardar
        </button>
        <button
          type="button"
          className="rounded bg-zinc-700 px-3 py-2 hover:bg-zinc-600"
          onClick={() => void test()}
        >
          Probar voz
        </button>
      </div>
    </div>
  );
}
