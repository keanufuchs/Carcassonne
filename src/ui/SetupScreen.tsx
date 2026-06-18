import { useState, useRef, useEffect } from 'react';
import { GameShowcase } from './GameShowcase';
import { MeepleIcon } from './board/MeepleIcon';
import { getAvailableModels, getDefaultModel } from '../ai/models';
import { CustomSelect } from './CustomSelect';
import { SimpleSelect } from './SimpleSelect';
import './styles/menu.css';

export type AIMode = 'human' | 'random' | 'heuristic' | 'intelligent';

const AI_DEFAULT_NAMES: Record<AIMode, string> = {
  human: '',
  random: 'Random AI',
  heuristic: 'Heuristic AI',
  intelligent: 'Reasoning AI',
};

function aiDefaultName(mode: AIMode) { return AI_DEFAULT_NAMES[mode]; }

const AI_MODELS = getAvailableModels();

export interface PlayerSetup {
  name: string;
  aiMode: AIMode;
  /** Reasoning-AI model id (only meaningful when aiMode === 'intelligent'). */
  aiModel?: string;
}

interface Props {
  initialGameId?: string;
  onCreateGame: (playerName: string) => Promise<void>;
  onJoinGame: (gameId: string, playerName: string) => Promise<void>;
  onStartLocal: (players: PlayerSetup[]) => void;
}

type Tab = 'local' | 'create' | 'join';

const MEEPLE_COLORS = ['#c4583a', '#5f9444', '#d8a93f', '#4d6275', '#8a6fa0'];

/** Decorative meeples drifting in the background. */
const FLOATERS = [
  { color: '#c4583a', size: 58, top: '13%', left: '60%', r: '-12deg', dur: '7.5s' },
  { color: '#5f9444', size: 46, top: '78%', left: '52%', r: '10deg', dur: '8.5s' },
  { color: '#d8a93f', size: 54, top: '20%', left: '88%', r: '14deg', dur: '6.8s' },
  { color: '#4d6275', size: 42, top: '74%', left: '90%', r: '-8deg', dur: '9.2s' },
];

export function SetupScreen({ initialGameId, onCreateGame, onJoinGame, onStartLocal }: Props) {
  const [tab, setTab]   = useState<Tab>(initialGameId ? 'join' : 'local');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode]     = useState(initialGameId ?? '');
  const [joinName, setJoinName]     = useState('');
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    local: null,
    create: null,
    join: null,
  });
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  useEffect(() => {
    function updateIndicator() {
      const activeBtn = tabRefs.current[tab];
      if (activeBtn) {
        setIndicatorStyle({
          left: activeBtn.offsetLeft,
          width: activeBtn.offsetWidth,
          opacity: 1,
        });
      }
    }

    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [tab]);

  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>('auto');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newHeight = entry.contentRect.height;
        setHeight(newHeight);
        if (isMounted.current) {
          setIsTransitioning(true);
        }
      }
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  const [localPlayers, setLocalPlayers] = useState<PlayerSetup[]>([
    { name: 'Player 1', aiMode: 'human' },
    { name: 'Random AI', aiMode: 'random' },
  ]);

  function switchTab(t: Tab) { setTab(t); setError(''); }

  async function handleCreate() {
    if (!createName.trim() || busy) return;
    setBusy(true); setError('');
    try { await onCreateGame(createName.trim()); }
    catch (e) { setError(String(e)); setBusy(false); }
  }

  async function handleJoin() {
    if (joinCode.length !== 5 || !joinName.trim() || busy) return;
    setBusy(true); setError('');
    try { await onJoinGame(joinCode.toUpperCase(), joinName.trim()); }
    catch (e) { setError(String(e)); setBusy(false); }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'local', label: 'Local' },
    { id: 'create', label: 'Create' },
    { id: 'join', label: 'Join' },
  ];

  return (
    <div className="menu-screen">
      <GameShowcase />
      <div className="menu-veil" />

      {FLOATERS.map((f, i) => (
        <div
          key={i}
          className="menu-meeple"
          style={{ top: f.top, left: f.left, ['--r' as string]: f.r, ['--dur' as string]: f.dur }}
        >
          <MeepleIcon color={f.color} size={f.size} />
        </div>
      ))}

      <div className="menu-stage">
        <header className="hero-head">
          <h1 className="hero-title">Carcas<span className="accent">sonne</span></h1>
          <p className="hero-sub">Build cities, claim roads, outwit your rivals.</p>
        </header>

        <div
          className="card menu-card"
          style={{
            height: height === 'auto' ? 'auto' : `${height + 56}px`,
            transition: isTransitioning ? 'height 0.28s cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
            overflow: isTransitioning ? 'hidden' : 'visible',
          }}
          onTransitionEnd={() => setIsTransitioning(false)}
        >
          <div ref={contentRef}>
            <div className="seg" role="tablist">
            <div className="seg-indicator" style={indicatorStyle} />
            {tabs.map(t => (
              <button
                key={t.id}
                ref={el => { tabRefs.current[t.id] = el; }}
                role="tab"
                aria-selected={tab === t.id}
                className="seg-btn"
                onClick={() => switchTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'create' && (
            <div className="stack">
              <div>
                <label className="field-label">Your Name</label>
                <input className="input" value={createName} placeholder="Enter your name" autoFocus
                  onChange={e => setCreateName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()} />
              </div>
              <button className="btn btn-primary btn-block" disabled={!createName.trim() || busy} onClick={handleCreate}>
                {busy ? 'Creating…' : 'Create Game'}
              </button>
            </div>
          )}

          {tab === 'join' && (
            <div className="stack">
              <div>
                <label className="field-label">Game Code</label>
                <input
                  className="input input-code"
                  value={joinCode} placeholder="ABCDE" maxLength={5}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())} />
              </div>
              <div>
                <label className="field-label">Your Name</label>
                <input className="input" value={joinName} placeholder="Enter your name"
                  onChange={e => setJoinName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()} />
              </div>
              <button className="btn btn-primary btn-block"
                disabled={!(joinCode.length === 5 && joinName.trim()) || busy} onClick={handleJoin}>
                {busy ? 'Joining…' : 'Join Game'}
              </button>
            </div>
          )}

          {tab === 'local' && (
            <div className="stack">
              <label className="field-label">Players ({localPlayers.length}/5)</label>
              <div className="player-rows">
                {localPlayers.map((p, i) => (
                  <div key={i} className="player-entry">
                    <div className="player-row">
                      <span style={{ flexShrink: 0 }}>
                        <MeepleIcon color={MEEPLE_COLORS[i] ?? '#888'} size={22} />
                      </span>
                      <input className="input" value={p.name} placeholder={`Player ${i + 1}`}
                        onChange={e => {
                          const n = [...localPlayers];
                          n[i] = { ...n[i], name: e.target.value };
                          setLocalPlayers(n);
                        }} />
                      <CustomSelect
                        value={p.aiMode}
                        onChange={newMode => {
                          const n = [...localPlayers];
                          const isDefaultName = Object.values(AI_DEFAULT_NAMES).includes(n[i].name) || n[i].name === `Player ${i + 1}`;
                          const name = newMode === 'human' ? (isDefaultName ? `Player ${i + 1}` : n[i].name)
                            : (isDefaultName ? aiDefaultName(newMode) : n[i].name);
                          const aiModel = newMode === 'intelligent' ? (n[i].aiModel ?? getDefaultModel()) : undefined;
                          n[i] = { ...n[i], aiMode: newMode, name, aiModel };
                          setLocalPlayers(n);
                        }}
                      />
                      {localPlayers.length > 2 && (
                        <button className="row-remove" title="Remove player"
                          onClick={() => setLocalPlayers(localPlayers.filter((_, idx) => idx !== i))}>✕</button>
                      )}
                    </div>
                    {p.aiMode === 'intelligent' && AI_MODELS.length > 1 && (
                      <div className="player-row player-model-row">
                        <span style={{ flexShrink: 0, width: 22 }} aria-hidden="true" />
                        <label className="model-label">Model</label>
                        <SimpleSelect
                          title="Reasoning-AI model"
                          value={p.aiModel ?? getDefaultModel()}
                          options={AI_MODELS.map(m => ({ value: m, label: m }))}
                          onChange={model => {
                            const n = [...localPlayers];
                            n[i] = { ...n[i], aiModel: model };
                            setLocalPlayers(n);
                          }}
                        />
                        {localPlayers.length > 2 && (
                          <span className="row-remove-spacer" aria-hidden="true" />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {localPlayers.length < 5 && (
                <button className="add-player"
                  onClick={() => setLocalPlayers([...localPlayers, { name: 'Random AI', aiMode: 'random' }])}>
                  + Add Player
                </button>
              )}
              <button className="btn btn-primary btn-block" data-testid="start-game-btn"
                disabled={!localPlayers.every(p => p.name.trim())}
                onClick={() => onStartLocal(localPlayers)}>
                Start Local Game
              </button>
            </div>
          )}

          {error && <div className="error-banner">{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
