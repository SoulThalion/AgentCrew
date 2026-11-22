import { useEffect, useState } from 'react';
import { AgentSprite } from './AgentSprite';
import { Settings } from './Settings';

type AgentView = {
  id: string;
  state: string;
  title: string;
  phrase: string;
  order: number;
  subagentCount: number;
  color: string;
  label: string;
  /** Chat UI enfocado (paridad Fondo-Fila legacy #2A2D35). */
  focused?: boolean;
};

type UsoView = { incluido: string; otros: string };

const USO_DEFAULT: UsoView = { incluido: 'Inc -', otros: 'Otr -' };

const DEMO: AgentView[] = [
  { id: 'd-trab', state: 'trabajando', title: 'Trabajando', phrase: '', order: 0, subagentCount: 0, color: '#4FA3FF', label: 'Trabajando' },
  { id: 'd-sub', state: 'subagentes', title: 'Subagentes', phrase: 'Otros agentes trabajan.', order: 1, subagentCount: 3, color: '#F27B4A', label: 'Subagentes' },
  { id: 'd-plan', state: 'planificando', title: 'Plan', phrase: 'Modo plan.', order: 2, subagentCount: 0, color: '#A68BFF', label: 'Planificando' },
  { id: 'd-ley', state: 'leyendo', title: 'Leyendo', phrase: 'Lee archivos.', order: 3, subagentCount: 0, color: '#A68BFF', label: 'Leyendo' },
  { id: 'd-esp', state: 'esperando', title: 'Espera', phrase: 'Te pregunta.', order: 4, subagentCount: 0, color: '#FFB020', label: 'Esperando tu respuesta' },
  { id: 'd-ate', state: 'atento', title: 'Atento', phrase: 'Chat enfocado.', order: 5, subagentCount: 0, color: '#A68BFF', label: 'Pendiente', focused: true },
  { id: 'd-fin', state: 'terminado', title: 'Fin', phrase: 'Acabó.', order: 6, subagentCount: 0, color: '#3DD68C', label: 'Terminado' },
  { id: 'd-err', state: 'error', title: 'Error', phrase: 'Stop error.', order: 7, subagentCount: 0, color: '#FF5C5C', label: 'Error' },
  { id: 'd-det', state: 'detenido', title: 'Detenido', phrase: 'Leído.', order: 8, subagentCount: 0, color: '#8A8A8A', label: 'Detenido' },
];

function parsePayload(raw: string): { agents: AgentView[]; uso: UsoView } {
  try {
    const data = JSON.parse(raw) as {
      agents?: AgentView[];
      uso?: Partial<UsoView>;
    };
    const agents = Array.isArray(data.agents) ? data.agents : [];
    const uso: UsoView = {
      incluido:
        typeof data.uso?.incluido === 'string' && data.uso.incluido
          ? data.uso.incluido
          : USO_DEFAULT.incluido,
      otros:
        typeof data.uso?.otros === 'string' && data.uso.otros
          ? data.uso.otros
          : USO_DEFAULT.otros,
    };
    return { agents, uso };
  } catch {
    return { agents: [], uso: USO_DEFAULT };
  }
}

function isSettingsRoute(): boolean {
  if (window.agentcrewBoot?.page === 'settings') return true;
  const q = new URLSearchParams(window.location.search);
  return q.get('page') === 'settings' || window.location.hash.includes('settings');
}

export function App() {
  const [agents, setAgents] = useState<AgentView[]>([]);
  const [uso, setUso] = useState<UsoView>(USO_DEFAULT);
  const [settings, setSettingsMode] = useState(isSettingsRoute());
  const [muestra, setMuestra] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const onHash = () => setSettingsMode(isSettingsRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (settings) return;
    const api = window.agentcrew;
    if (!api) return;
    const apply = (raw: string) => {
      const p = parsePayload(raw);
      setAgents(p.agents);
      setUso(p.uso);
    };
    void api.listAgents().then(apply);
    void api.getPanelPrefs().then((p) => {
      setMuted(Boolean(p.muted));
      setMuestra(Boolean(p.muestra));
    });
    const offPrefs = api.onPrefsUpdate((p) => {
      setMuted(Boolean(p.muted));
      setMuestra(Boolean(p.muestra));
    });
    const offAgents = api.onAgentsUpdate(apply);
    return () => {
      offPrefs();
      offAgents();
    };
  }, [settings]);

  if (settings) return <Settings />;

  const list = muestra ? DEMO : agents;
  const FOOTER_H = 62;

  return (
    <div
      className="flex flex-col select-none"
      style={{ background: '#1E1F24', height: '100vh', width: '100%', minHeight: '100%' }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-0.5 pt-2 pb-1">
        {list.length === 0 ? (
          <div className="px-1 text-center text-[10px] leading-tight text-zinc-500">
            Sin agentes
          </div>
        ) : (
          list.map((a) => (
            <button
              key={a.id}
              type="button"
              className={
                a.focused
                  ? 'mb-1 flex w-full flex-col items-center focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500'
                  : 'mb-1 flex w-full flex-col items-center hover:bg-white/5 focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500'
              }
              style={
                a.focused
                  ? { background: '#2A2D35', borderRadius: 6 }
                  : undefined
              }
              onMouseEnter={(e) => {
                const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                void window.agentcrew.showHoverCard({
                  title: a.title,
                  state: a.label,
                  stateColor: a.color,
                  phrase: a.phrase || (muestra ? '' : 'Sin frase todavía'),
                  anchorX: r.left,
                  anchorY: r.top,
                  anchorH: r.height,
                });
              }}
              onMouseLeave={() => {
                void window.agentcrew.hideHoverCard();
              }}
              onClick={() => {
                void window.agentcrew.hideHoverCard();
                if (!muestra) {
                  const id = a.id.startsWith('ui:') ? '' : a.id;
                  void window.agentcrew.focusAgent({ id, title: a.title });
                }
              }}
            >
              <AgentSprite
                pose={a.state}
                color={a.color}
                subagentCount={a.subagentCount || 2}
              />
            </button>
          ))
        )}
      </div>

      {/* Footer legacy: uso Inc/Otr + Mudo | Muestra | Cerrar */}
      <div
        data-footer="mando"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          background: '#25262C',
        }}
      >
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.13)',
            padding: '4px 2px 3px',
            textAlign: 'center',
            fontFamily: 'Segoe UI, sans-serif',
            fontSize: 11,
            lineHeight: 1.25,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
          title="Consumo Cursor"
        >
          <div style={{ color: '#7EB6FF' }} title="Incluido">
            {uso.incluido}
          </div>
          <div style={{ color: '#E2B34C', marginTop: 1 }} title="Otros modelos">
            {uso.otros}
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            height: 32,
            borderTop: '1px solid rgba(255,255,255,0.22)',
          }}
        >
        <button
          type="button"
          title={muted ? 'Activar avisos' : 'Silenciar avisos'}
          aria-label={muted ? 'Activar avisos' : 'Silenciar avisos'}
          onClick={() => {
            void window.agentcrew.toggleMute().then((r) => setMuted(Boolean(r.muted)));
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            minWidth: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
            {muted ? (
              <path
                fill="#FF5C5C"
                d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"
              />
            ) : (
              <path
                fill="#C8C8C8"
                d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
              />
            )}
          </svg>
        </button>
        <button
          type="button"
          title={muestra ? 'Volver a los agentes' : 'Ver estados'}
          aria-label={muestra ? 'Volver a los agentes' : 'Ver estados'}
          onClick={() => {
            const next = !muestra;
            setMuestra(next);
            void window.agentcrew.setMuestra(next);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            minWidth: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
            <path
              fill={muestra ? '#7EB6FF' : '#C8C8C8'}
              d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"
            />
          </svg>
        </button>
        <button
          type="button"
          title="Parar el panel"
          aria-label="Parar el panel"
          onClick={() => void window.agentcrew.stopPanel()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#C8C8C8',
            padding: 0,
            minWidth: 0,
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1,
            fontFamily: 'Segoe UI, Arial, sans-serif',
          }}
        >
          ×
        </button>
        </div>
      </div>
      {/* Spacer: lista no tapa footer fixed */}
      <div style={{ height: FOOTER_H, flexShrink: 0 }} aria-hidden />
    </div>
  );
}
