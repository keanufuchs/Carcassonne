import { useState } from 'react';

interface Props {
  initialGameId?: string;
  onCreateGame: (playerName: string) => Promise<void>;
  onJoinGame: (gameId: string, playerName: string) => Promise<void>;
  onStartLocal: (names: string[]) => void;
}

type Tab = 'create' | 'join' | 'local';

const inputStyle: React.CSSProperties = {
  background: '#252540', color: '#eee',
  border: '1px solid #444', borderRadius: 5,
  padding: '7px 10px', fontSize: 14, outline: 'none',
  width: '100%', boxSizing: 'border-box',
};

function PrimaryBtn({ enabled, onClick, children }: { enabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={!enabled}
      style={{
        background: enabled ? '#4a3a8a' : '#252530',
        color: enabled ? '#eee' : '#555',
        border: 'none', borderRadius: 7, padding: '12px',
        cursor: enabled ? 'pointer' : 'not-allowed',
        fontSize: 15, fontWeight: 700, width: '100%',
      }}
    >{children}</button>
  );
}

export function SetupScreen({ initialGameId, onCreateGame, onJoinGame, onStartLocal }: Props) {
  const [tab, setTab]   = useState<Tab>(initialGameId ? 'join' : 'create');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode]     = useState(initialGameId ?? '');
  const [joinName, setJoinName]     = useState('');
  const [localNames, setLocalNames] = useState(['Player 1', 'Player 2']);

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

  const tabBtn = (t: Tab): React.CSSProperties => ({
    flex: 1, padding: '8px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    border: 'none', borderRadius: 6,
    background: tab === t ? '#3a3a6a' : 'transparent',
    color: tab === t ? '#ffd700' : '#777',
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0e0e1a', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#1a1a2e', borderRadius: 14, padding: '36px 44px', minWidth: 340, border: '2px solid #3a3a6a', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ color: '#ffd700', margin: 0, fontSize: 28, letterSpacing: 2 }}>Carcassonne</h1>
          <p style={{ color: '#666', margin: '6px 0 0', fontSize: 12 }}>Base Game</p>
        </div>

        <div style={{ display: 'flex', gap: 4, background: '#12122a', borderRadius: 8, padding: 4 }}>
          <button style={tabBtn('create')} onClick={() => switchTab('create')}>Create</button>
          <button style={tabBtn('join')}   onClick={() => switchTab('join')}>Join</button>
          <button style={tabBtn('local')}  onClick={() => switchTab('local')}>Local</button>
        </div>

        {tab === 'create' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Your Name</label>
            <input style={inputStyle} value={createName} placeholder="Enter your name" autoFocus
              onChange={e => setCreateName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()} />
            <PrimaryBtn enabled={!!createName.trim() && !busy} onClick={handleCreate}>
              {busy ? 'Creating…' : 'Create Game'}
            </PrimaryBtn>
          </div>
        )}

        {tab === 'join' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Game Code</label>
            <input
              style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: 6, textTransform: 'uppercase', fontSize: 20, textAlign: 'center' }}
              value={joinCode} placeholder="ABCDE" maxLength={5}
              onChange={e => setJoinCode(e.target.value.toUpperCase())} />
            <label style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Your Name</label>
            <input style={inputStyle} value={joinName} placeholder="Enter your name"
              onChange={e => setJoinName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()} />
            <PrimaryBtn enabled={joinCode.length === 5 && !!joinName.trim() && !busy} onClick={handleJoin}>
              {busy ? 'Joining…' : 'Join Game'}
            </PrimaryBtn>
          </div>
        )}

        {tab === 'local' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Players ({localNames.length}/5)</label>
            {localNames.map((name, i) => (
              <div key={i} style={{ display: 'flex', gap: 6 }}>
                <input style={inputStyle} value={name} placeholder={`Player ${i + 1}`}
                  onChange={e => { const n = [...localNames]; n[i] = e.target.value; setLocalNames(n); }} />
                {localNames.length > 2 && (
                  <button onClick={() => setLocalNames(localNames.filter((_, idx) => idx !== i))}
                    style={{ background: '#3a1a1a', color: '#f87171', border: '1px solid #5a2a2a', borderRadius: 5, cursor: 'pointer', padding: '0 10px', fontSize: 16 }}>✕</button>
                )}
              </div>
            ))}
            {localNames.length < 5 && (
              <button onClick={() => setLocalNames([...localNames, `Player ${localNames.length + 1}`])}
                style={{ background: 'transparent', color: '#6a8ab8', border: '1px dashed #4a6a9a', borderRadius: 5, padding: '7px', cursor: 'pointer', fontSize: 13 }}>
                + Add Player
              </button>
            )}
            <PrimaryBtn enabled={localNames.every(n => n.trim())} onClick={() => onStartLocal(localNames.map(n => n.trim()).filter(Boolean))}>
              Start Local Game
            </PrimaryBtn>
          </div>
        )}

        {error && <div style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>{error}</div>}
      </div>
    </div>
  );
}
