import type { LobbyInfo } from '../controller/NetworkController';
import { GameShowcase } from './GameShowcase';
import { MeepleIcon } from './board/MeepleIcon';
import './styles/menu.css';

const COLORS = ['#c4583a', '#5f9444', '#d8a93f', '#4d6275', '#8a6fa0'];

interface Props {
  lobbyInfo: LobbyInfo;
  onStart: () => void;
  gameId: string;
}

export function LobbyScreen({ lobbyInfo, onStart, gameId }: Props) {
  const inviteUrl = `${window.location.origin}${window.location.pathname}?game=${gameId}`;
  const canStart = lobbyInfo.isHost && lobbyInfo.players.length >= 2;

  return (
    <div className="menu-screen">
      <GameShowcase />
      <div className="menu-veil" />

      <div className="menu-stage">
        <header className="hero-head">
          <span className="hero-crest">
            <span className="dot" />
            <span className="eyebrow">Game Lobby</span>
          </span>
          <h1 className="hero-title" style={{ fontSize: 'clamp(40px, 6vw, 64px)' }}>Carcas<span className="accent">sonne</span></h1>
        </header>

        <div className="card menu-card">
          <div className="stack" style={{ marginTop: 0 }}>
            <div>
              <label className="field-label">Game Code</label>
              <div className="code-stamp">{gameId}</div>
            </div>

            <div>
              <label className="field-label">Invite Link</label>
              <div className="invite-link">{inviteUrl}</div>
              <button
                className="btn btn-sm btn-ghost"
                style={{ marginTop: 8 }}
                onClick={() => navigator.clipboard.writeText(inviteUrl).catch(() => undefined)}
              >
                Copy Link
              </button>
            </div>

            <div>
              <label className="field-label">Players ({lobbyInfo.players.length}/5)</label>
              <div className="player-rows">
                {lobbyInfo.players.map(p => (
                  <div key={p.index} className="lobby-player">
                    <MeepleIcon color={COLORS[p.index] ?? '#888'} size={20} />
                    <span>{p.name}</span>
                    {p.index === 0 && <span className="host-tag">Host</span>}
                  </div>
                ))}
              </div>
            </div>

            {lobbyInfo.isHost ? (
              <button className="btn btn-primary btn-block" onClick={onStart} disabled={!canStart}>
                {canStart ? 'Start Game' : 'Waiting for players…'}
              </button>
            ) : (
              <div className="waiting-note">Waiting for the host to start…</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
