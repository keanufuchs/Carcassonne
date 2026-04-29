import { useState } from 'react';

interface Props {
  onStart: (names: string[]) => void;
}

export function SetupScreen({ onStart }: Props) {
  const [names, setNames] = useState(['Player 1', 'Player 2']);

  const update = (i: number, v: string) => {
    const next = [...names];
    next[i] = v;
    setNames(next);
  };

  const addPlayer    = () => names.length < 5 && setNames([...names, `Player ${names.length + 1}`]);
  const removePlayer = (i: number) => names.length > 2 && setNames(names.filter((_, idx) => idx !== i));
  const canStart     = names.every(n => n.trim().length > 0);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0e0e1a',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: '#1a1a2e', borderRadius: 14, padding: '36px 44px', minWidth: 340,
        border: '2px solid #3a3a6a', display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ color: '#ffd700', margin: 0, fontSize: 28, letterSpacing: 2 }}>Carcassonne</h1>
          <p style={{ color: '#666', margin: '6px 0 0', fontSize: 12 }}>Base Game MVP</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
            Players ({names.length}/5)
          </div>
          {names.map((name, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              <input
                value={name}
                onChange={e => update(i, e.target.value)}
                placeholder={`Player ${i + 1}`}
                style={{
                  flex: 1, background: '#252540', color: '#eee',
                  border: '1px solid #444', borderRadius: 5,
                  padding: '7px 10px', fontSize: 14, outline: 'none',
                }}
              />
              {names.length > 2 && (
                <button
                  onClick={() => removePlayer(i)}
                  style={{ background: '#3a1a1a', color: '#f87171', border: '1px solid #5a2a2a', borderRadius: 5, cursor: 'pointer', padding: '0 10px', fontSize: 16 }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addPlayer}
          disabled={names.length >= 5}
          style={{
            background: 'transparent', color: names.length < 5 ? '#6a8ab8' : '#444',
            border: `1px dashed ${names.length < 5 ? '#4a6a9a' : '#333'}`,
            borderRadius: 5, padding: '7px', cursor: names.length < 5 ? 'pointer' : 'not-allowed', fontSize: 13,
          }}
        >
          + Add Player
        </button>

        <button
          data-testid="start-game-btn"
          onClick={() => onStart(names.map(n => n.trim()))}
          disabled={!canStart}
          style={{
            background: canStart ? '#4a3a8a' : '#252530',
            color: canStart ? '#eee' : '#555',
            border: 'none', borderRadius: 7,
            padding: '12px', cursor: canStart ? 'pointer' : 'not-allowed',
            fontSize: 15, fontWeight: 700, letterSpacing: 0.5,
            transition: 'background 0.15s',
          }}
        >
          Start Game
        </button>
      </div>
    </div>
  );
}
