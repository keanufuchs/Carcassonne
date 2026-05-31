import { useState } from 'react';
import type { Player } from '../../core/types';

interface Props {
  players: Player[];
  onRestart: () => void;
}

export function EndGameScreen({ players, onRestart }: Props) {
  const [showMap, setShowMap] = useState(false);
  const sorted = [...players].sort((a, b) => b.score - a.score);

  if (showMap) {
    return (
      <button
        onClick={() => setShowMap(false)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 100,
          background: '#1a1a2e', color: '#ffd700',
          border: '2px solid #4a4a6a', borderRadius: 8,
          padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}
      >
        Back to Results
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
    }}>
      <div style={{
        background: '#1a1a2e', borderRadius: 12,
        padding: '36px 48px', minWidth: 340,
        border: '2px solid #4a4a6a',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
      }}>
        <h2 style={{ color: '#ffd700', margin: 0, fontSize: 26 }}>Game Over</h2>
        <p style={{ color: '#ccc', margin: 0 }}>
          {sorted[0].name} wins with {sorted[0].score} points!
        </p>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#666', width: 20, textAlign: 'right', fontSize: 13 }}>{i + 1}.</span>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
              <span style={{ flex: 1, color: i === 0 ? '#ffd700' : '#ccc', fontSize: 14 }}>{p.name}</span>
              <span style={{ fontWeight: 700, color: i === 0 ? '#ffd700' : '#eee', fontSize: 16 }}>{p.score}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 4 }}>
          <button
            onClick={() => setShowMap(true)}
            style={{
              flex: 1,
              background: '#2a2a4a', color: '#aaa',
              border: '1px solid #4a4a6a', borderRadius: 6,
              padding: '10px 0', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            }}
          >
            View Map
          </button>
          <button
            onClick={onRestart}
            style={{
              flex: 1,
              background: '#4a4a8a', color: '#eee',
              border: 'none', borderRadius: 6,
              padding: '10px 0', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            }}
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
}
