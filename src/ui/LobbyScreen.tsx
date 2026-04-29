import type { LobbyInfo } from '../controller/NetworkController';

const COLORS = ['#e63946', '#2a9d8f', '#e9c46a', '#457b9d', '#6a0572'];

interface Props {
  lobbyInfo: LobbyInfo;
  onStart: () => void;
  gameId: string;
}

export function LobbyScreen({ lobbyInfo, onStart, gameId }: Props) {
  const inviteUrl = `${window.location.origin}${window.location.pathname}?game=${gameId}`;
  const canStart = lobbyInfo.isHost && lobbyInfo.players.length >= 2;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0e0e1a', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#1a1a2e', borderRadius: 14, padding: '36px 44px', minWidth: 360, border: '2px solid #3a3a6a', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h1 style={{ color: '#ffd700', margin: 0, fontSize: 28, letterSpacing: 2, textAlign: 'center' }}>Carcassonne</h1>

        <div>
          <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Game Code</div>
          <div style={{ fontFamily: 'monospace', fontSize: 32, fontWeight: 700, letterSpacing: 8, color: '#ffd700', textAlign: 'center', background: '#12122a', borderRadius: 8, padding: '10px 0', marginTop: 6 }}>
            {gameId}
          </div>
        </div>

        <div>
          <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Invite Link</div>
          <div style={{ fontSize: 12, color: '#6a8ab8', wordBreak: 'break-all', background: '#12122a', borderRadius: 6, padding: '8px 10px' }}>{inviteUrl}</div>
          <button
            onClick={() => navigator.clipboard.writeText(inviteUrl).catch(() => undefined)}
            style={{ marginTop: 6, background: '#252540', color: '#aaa', border: '1px solid #444', borderRadius: 5, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}
          >
            Copy Link
          </button>
        </div>

        <div>
          <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Players ({lobbyInfo.players.length}/5)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {lobbyInfo.players.map(p => (
              <div key={p.index} style={{ display: 'flex', alignItems: 'center', gap: 8, color: p.index === 0 ? '#ffd700' : '#ccc', fontSize: 14 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[p.index] ?? '#888', flexShrink: 0 }} />
                {p.name}
                {p.index === 0 && <span style={{ fontSize: 11, color: '#ffd700' }}>(host)</span>}
              </div>
            ))}
          </div>
        </div>

        {lobbyInfo.isHost ? (
          <button
            onClick={onStart}
            disabled={!canStart}
            style={{ background: canStart ? '#4a3a8a' : '#252530', color: canStart ? '#eee' : '#555', border: 'none', borderRadius: 7, padding: '12px', cursor: canStart ? 'pointer' : 'not-allowed', fontSize: 15, fontWeight: 700 }}
          >
            {canStart ? 'Start Game' : 'Waiting for players…'}
          </button>
        ) : (
          <div style={{ color: '#666', fontSize: 13, textAlign: 'center' }}>Waiting for host to start…</div>
        )}
      </div>
    </div>
  );
}
