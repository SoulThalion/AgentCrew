import { useEffect, useState } from 'react';

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
};

type DisplayOpt = { id: number; label: string; primary: boolean };

export function Settings() {
  const [s, setS] = useState<SettingsView>(empty);
  const [status, setStatus] = useState('');
  const [displays, setDisplays] = useState<DisplayOpt[]>([]);
  const [displayId, setDisplayId] = useState<number | null>(null);
  const [primaryId, setPrimaryId] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'Ajustes TTS';
    const api = window.agentcrew;
    if (!api) {
      setStatus('API no disponible (preload)');
      return;
    }
    void api.getSettings()
      .then((raw) => setS({ ...empty, ...(raw as SettingsView) }))
      .catch(() => setStatus('No se pudieron cargar ajustes'));
    void api.listDisplays()
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

  async function save() {
    const next = (await window.agentcrew.saveSettings(s)) as SettingsView;
    setS({ ...empty, ...next });
    setStatus('Guardado');
  }

  async function test() {
    setStatus('Reproduciendo…');
    const r = (await window.agentcrew.testVoice('Prueba de voz AgentCrew.')) as {
      ok: boolean;
      source: string;
    };
    setStatus(r.ok ? `OK (${r.source})` : `Falló (${r.source})`);
  }

  return (
    <div
      className="bg-zinc-900 p-4 text-sm text-zinc-100"
      style={{ minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}
    >
      <h1 className="mb-3 text-lg font-semibold">Ajustes TTS</h1>

      <label className="mb-3 block">
        <span className="text-zinc-400">Pantalla de la franja</span>
        <select
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 p-2"
          value={displayId ?? ''}
          onChange={(e) => {
            const v = e.target.value === '' ? null : Number(e.target.value);
            const id = v == null || (primaryId != null && v === primaryId) ? null : v;
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
            pegala acá. También: env <code className="text-zinc-400">FISH_API_KEY</code>.
          </p>
          <button
            type="button"
            className="w-full rounded bg-sky-700 px-3 py-2 text-sm hover:bg-sky-600"
            onClick={async () => {
              setStatus('Abriendo portal Fish…');
              const r = await window.agentcrew.openFishPortal();
              setStatus(r.ok ? 'Portal abierto — pegá la API key' : 'No se abrió portal');
            }}
          >
            Conectar Fish (portal)
          </button>
          <input
            className="w-full rounded border border-zinc-700 bg-zinc-800 p-2"
            placeholder="API key Fish"
            value={s.fishApiKey}
            onChange={(e) => setS({ ...s, fishApiKey: e.target.value })}
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

      <div className="flex gap-2">
        <button
          type="button"
          className="rounded bg-sky-600 px-3 py-2 font-medium hover:bg-sky-500"
          onClick={() => void save()}
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
      {status ? <p className="mt-3 text-xs text-zinc-400">{status}</p> : null}
    </div>
  );
}
