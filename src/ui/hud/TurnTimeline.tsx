import tileDistribution from '../../core/deck/tileDistribution.json';
import type { ToolCallEntry } from './toolCallAccumulator';
import type { HeuristicAnalysis } from '../../ai/heuristic';

const tileImageMap: Record<string, string> = Object.fromEntries(
  (tileDistribution.tiles as Array<{ id: string; file: string }>).map(t => [t.id, `/tiles/${t.file}`]),
);

export interface MoveRecord {
  turn: number;
  playerName: string;
  playerColor: string;
  prototypeId: string;
  coord: { x: number; y: number };
  rotation: number;
  toolCalls?: ToolCallEntry[];
  reasoning?: string;
  heuristicAnalysis?: HeuristicAnalysis;
}

function HeuristicRow({ label, value, positive, dim }: { label: string; value: string; positive: boolean; dim?: boolean }) {
  const color = dim ? '#4b5563' : positive ? '#4ade80' : '#f87171';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6b7280', padding: '1px 0' }}>
      <span>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}

function MoveCard({ m, onHighlight }: { m: MoveRecord; onHighlight?: (coord: { x: number; y: number }) => void }) {

  return (
    <div
      onClick={() => onHighlight?.(m.coord)}
      style={{
        padding: '5px 6px', marginBottom: 3, borderRadius: 5,
        background: 'rgba(255,255,255,0.03)',
        borderLeft: `3px solid ${m.playerColor}`,
        cursor: onHighlight ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {/* Tile thumbnail */}
        <div style={{
          width: 34, height: 34, flexShrink: 0,
          overflow: 'hidden', borderRadius: 3,
          background: '#111',
        }}>
          <img
            src={tileImageMap[m.prototypeId] ?? ''}
            alt={m.prototypeId}
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              transform: `rotate(${m.rotation}deg)`,
              display: 'block',
            }}
          />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 600,
            color: m.playerColor,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {m.playerName}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
            ({m.coord.x}, {m.coord.y})
          </div>
        </div>

        {/* Turn badge */}
        <div style={{
          fontSize: 10, color: '#4b5563',
          flexShrink: 0, fontVariantNumeric: 'tabular-nums',
        }}>
          #{m.turn}
        </div>
      </div>

      {/* AI Analysis */}
      {m.toolCalls && m.toolCalls.length > 0 && (
        <div style={{ marginTop: 5 }}>
          <div style={{
            fontSize: 9, color: '#4b5563', textTransform: 'uppercase',
            letterSpacing: '0.06em', borderTop: '1px solid #1f2937',
            paddingTop: 4, marginBottom: 3,
          }}>
            AI Analysis
          </div>
          {m.toolCalls.map((tc, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6b7280' }}>
              <span>{tc.name}</span>
              <span style={{ color: '#4b5563' }}>{tc.summary}</span>
            </div>
          ))}
        </div>
      )}

      {/* Reasoning */}
      {m.reasoning && (
        <div style={{ marginTop: 5 }}>
          <div style={{
            fontSize: 9, color: '#4b5563', textTransform: 'uppercase',
            letterSpacing: '0.06em', borderTop: '1px solid #1f2937',
            paddingTop: 4, marginBottom: 3,
          }}>
            Reasoning
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', fontStyle: 'italic', lineHeight: 1.5 }}>
            "{m.reasoning}"
          </div>
        </div>
      )}

      {/* Heuristic Analysis */}
      {m.heuristicAnalysis && (
        <div style={{ marginTop: 5 }}>
          <div style={{
            fontSize: 9, color: '#4b5563', textTransform: 'uppercase',
            letterSpacing: '0.06em', borderTop: '1px solid #1f2937',
            paddingTop: 4, marginBottom: 3,
          }}>
            Heuristic Analysis
          </div>
          <HeuristicRow label="Neighbors" value={`+${m.heuristicAnalysis.adjacency * 5} pts`} positive={m.heuristicAnalysis.adjacency > 0} />
          <HeuristicRow label="Own features" value={`+${m.heuristicAnalysis.ownConnections * 15} pts`} positive={m.heuristicAnalysis.ownConnections > 0} />
          <HeuristicRow label="Opponents" value={`−${m.heuristicAnalysis.opponentConnections * 10} pts`} positive={false} dim={m.heuristicAnalysis.opponentConnections === 0} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af', fontWeight: 600, borderTop: '1px solid #1f2937', paddingTop: 3, marginTop: 2 }}>
            <span>Score: {m.heuristicAnalysis.totalScore}</span>
            <span style={{ color: '#4b5563' }}>{m.heuristicAnalysis.candidatesEvaluated} moves</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  moves: MoveRecord[];
  onHighlight?: (coord: { x: number; y: number }) => void;
}

export function TurnTimeline({ moves, onHighlight }: Props) {
  const reversed = [...moves].reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '8px 10px 6px',
        color: '#6b7280', fontSize: 11, textTransform: 'uppercase',
        letterSpacing: '0.06em', borderBottom: '1px solid #2a2a4a',
        flexShrink: 0,
      }}>
        Move History
        {moves.length > 0 && (
          <span style={{ float: 'right', color: '#4b5563' }}>{moves.length}</span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 6px' }}>
        {moves.length === 0 ? (
          <div style={{ color: '#374151', fontSize: 11, padding: '8px 4px' }}>
            No moves yet
          </div>
        ) : (
          reversed.map((m) => (
            <MoveCard key={m.turn} m={m} onHighlight={onHighlight} />
          ))
        )}
      </div>
    </div>
  );
}
