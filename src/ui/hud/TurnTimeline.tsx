import tileDistribution from '../../core/deck/tileDistribution.json';
import type { ToolCallEntry } from './toolCallAccumulator';
import type { HeuristicAnalysis } from '../../ai/heuristic';
import type { Rotation } from '../../core/types';
import { prototypeById } from '../../core/deck/baseGameTiles';
import { getTileSnapshot } from '../../three/tileSnapshot';

const tileImageMap: Record<string, string> = Object.fromEntries(
  (tileDistribution.tiles as Array<{ id: string; file: string }>).map(t => [t.id, `/tiles/${t.file}`]),
);

/** The move thumbnail: 3D snapshots in 3D mode, original SVG tiles in 2D mode. */
function MoveThumb({ prototypeId, rotation, viewMode }: { prototypeId: string; rotation: number; viewMode: '2d' | '3d' }) {
  const proto = prototypeById.get(prototypeId);
  const snapshot = viewMode === '3d' && proto ? getTileSnapshot(proto, rotation as Rotation) : null;
  if (snapshot) {
    return <img src={snapshot} alt={prototypeId} />;
  }
  return <img src={tileImageMap[prototypeId] ?? ''} alt={prototypeId} style={{ transform: `rotate(${rotation}deg)` }} />;
}

export interface MoveRecord {
  turn: number;
  playerName: string;
  playerColor: string;
  prototypeId: string;
  coord: { x: number; y: number };
  rotation: number;
  aiMode?: 'human' | 'random' | 'heuristic' | 'intelligent';
  toolCalls?: ToolCallEntry[];
  reasoning?: string;
  reasoningUnavailableReason?: 'no_config' | 'timeout' | 'error' | 'invalid_move' | 'missing';
  heuristicAnalysis?: HeuristicAnalysis;
}

function formatMissingReasoning(reason?: MoveRecord['reasoningUnavailableReason']): string {
  switch (reason) {
    case 'no_config':
      return 'Reasoning unavailable: no API key was configured, so this move used heuristic fallback.';
    case 'timeout':
      return 'Reasoning unavailable: the reasoning request timed out, so this move used heuristic fallback.';
    case 'error':
      return 'Reasoning unavailable: the reasoning request failed, so this move used heuristic fallback.';
    case 'invalid_move':
      return 'Reasoning unavailable: the reasoning response did not contain a valid move, so this move used heuristic fallback.';
    case 'missing':
    default:
      return 'Reasoning unavailable for this Reasoning AI move.';
  }
}

function HeuristicRow({ label, value, positive, dim }: { label: string; value: string; positive: boolean; dim?: boolean }) {
  const color = dim ? 'var(--ink-faint)' : positive ? 'var(--field-deep)' : 'var(--terracotta-deep)';
  return (
    <div className="move-kv">
      <span>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function MoveCard({ m, onHighlight, viewMode }: { m: MoveRecord; onHighlight?: (coord: { x: number; y: number }) => void; viewMode: '2d' | '3d' }) {
  const isReasoningAiMove = m.aiMode === 'intelligent' || !!m.reasoning || !!m.reasoningUnavailableReason;
  const reasoningText = m.reasoning?.trim();

  return (
    <div
      className="move-card"
      onClick={() => onHighlight?.(m.coord)}
      style={{ borderLeftColor: m.playerColor, cursor: onHighlight ? 'pointer' : 'default' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="thumb">
          <MoveThumb prototypeId={m.prototypeId} rotation={m.rotation} viewMode={viewMode} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="move-pname" style={{ color: m.playerColor }}>{m.playerName}</div>
          <div className="move-coord">({m.coord.x}, {m.coord.y})</div>
        </div>
        <div className="move-turn">#{m.turn}</div>
      </div>

      {m.toolCalls && m.toolCalls.length > 0 && (
        <div>
          <div className="move-section-label">AI Analysis</div>
          {m.toolCalls.map((tc, i) => (
            <div key={i} className="move-kv">
              <span>{tc.name}</span>
              <span style={{ color: 'var(--ink-faint)' }}>{tc.summary}</span>
            </div>
          ))}
        </div>
      )}

      {isReasoningAiMove && (
        <div>
          <div className="move-section-label">Reasoning</div>
          <div className="move-reasoning">
            {reasoningText ? `"${reasoningText}"` : formatMissingReasoning(m.reasoningUnavailableReason)}
          </div>
        </div>
      )}

      {m.heuristicAnalysis && (
        <div>
          <div className="move-section-label">Heuristic Analysis</div>
          <HeuristicRow label="Neighbors" value={`+${m.heuristicAnalysis.adjacency * 5} pts`} positive={m.heuristicAnalysis.adjacency > 0} />
          <HeuristicRow label="Own features" value={`+${m.heuristicAnalysis.ownConnections * 15} pts`} positive={m.heuristicAnalysis.ownConnections > 0} />
          <HeuristicRow label="Opponents" value={`−${m.heuristicAnalysis.opponentConnections * 10} pts`} positive={false} dim={m.heuristicAnalysis.opponentConnections === 0} />
          <div className="move-kv" style={{ borderTop: '1px solid var(--panel-edge)', paddingTop: 3, marginTop: 2, fontWeight: 800, color: 'var(--ink)' }}>
            <span>Score: {m.heuristicAnalysis.totalScore}</span>
            <span style={{ color: 'var(--ink-faint)' }}>{m.heuristicAnalysis.candidatesEvaluated} moves</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  moves: MoveRecord[];
  onHighlight?: (coord: { x: number; y: number }) => void;
  viewMode?: '2d' | '3d';
}

export function TurnTimeline({ moves, onHighlight, viewMode = '3d' }: Props) {
  const reversed = [...moves].reverse();

  return (
    <>
      <div className="timeline-head">
        <span className="hud-label">Move History</span>
        {moves.length > 0 && <span className="timeline-count">{moves.length}</span>}
      </div>
      <div className="timeline-scroll">
        {moves.length === 0 ? (
          <div className="timeline-empty">No moves yet</div>
        ) : (
          reversed.map((m) => <MoveCard key={m.turn} m={m} onHighlight={onHighlight} viewMode={viewMode} />)
        )}
      </div>
    </>
  );
}
