import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { Rotation, SegmentKind, TilePrototype } from '../../src/core/types/tile';
import { PLAYER_COLORS } from '../../src/core/types';
import { layoutRegions } from '../../src/three/layoutRegions';
import type { TileRegions } from '../../src/three/svgRegions';
import { generateTile } from '../../src/three/generateTile';
import { disableTileContentRaycast } from '../../src/three/regionHighlight';
import { RegionInteractionLayer } from '../../src/three/RegionInteractionLayer';
import { nextClaims, type ClaimMap } from '../../src/three/claims';
import { buildClaimMarkers, applyRoadClaimTints } from '../../src/three/claimMarkers';
import { CompassMarkers } from './CompassMarkers';
import { TileLabCanvas } from './TileLabCanvas';

interface Props {
  prototype: TilePrototype;
  title: string;
  subtitle?: string;
}

const KIND_ICON: Record<SegmentKind, string> = { CITY: '🏰', ROAD: '🛣️', FIELD: '🌾', MONASTERY: '⛪' };
const ROTATIONS: Rotation[] = [0, 90, 180, 270];

function ClaimScene({
  prototype, regions, rotation, claims, onClaim,
}: {
  prototype: TilePrototype;
  regions: TileRegions;
  rotation: Rotation;
  claims: ClaimMap;
  onClaim: (localId: number, kind: SegmentKind) => void;
}) {
  const [hoveredLocalId, setHoveredLocalId] = useState<number | null>(null);

  const tileGroup = useMemo(() => {
    const group = generateTile(prototype, regions);
    disableTileContentRaycast(group);
    return group;
  }, [prototype, regions]);

  const markers = useMemo(() => buildClaimMarkers(regions, claims), [regions, claims]);

  // Road tints live on the tile's own materials → re-apply whenever claims change.
  useEffect(() => {
    applyRoadClaimTints(tileGroup, claims);
  }, [tileGroup, claims]);

  // Dispose the procedural tile when it is replaced or unmounted.
  useEffect(() => () => disposeGroup(tileGroup), [tileGroup]);
  // Dispose each marker group generation.
  useEffect(() => () => disposeGroup(markers), [markers]);

  return (
    <group rotation={[0, (rotation * Math.PI) / 180, 0]}>
      <primitive object={tileGroup} />
      <primitive object={markers} />
      <RegionInteractionLayer
        tileGroup={tileGroup}
        regions={regions}
        hoveredLocalId={hoveredLocalId}
        onHoverLocalId={setHoveredLocalId}
        onClickLocalId={onClaim}
      />
      <CompassMarkers />
    </group>
  );
}

export function ClaimTestPanel({ prototype, title, subtitle }: Props) {
  const [rotation, setRotation] = useState<Rotation>(0);
  const [activePlayer, setActivePlayer] = useState(0);
  const [claims, setClaims] = useState<ClaimMap>(new Map());

  const regions = useMemo(() => layoutRegions(prototype), [prototype]);

  const handleClaim = (localId: number, kind: SegmentKind) =>
    setClaims((prev) => nextClaims(prev, { localId, kind }, activePlayer));

  const removeClaim = (localId: number) =>
    setClaims((prev) => {
      const next = new Map(prev);
      next.delete(localId);
      return next;
    });

  const claimList = [...claims.values()].sort((a, b) => a.localId - b.localId);

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{title} {subtitle && <span className="muted">({subtitle})</span>}</h2>
        <div className="rotation-controls" role="group" aria-label="Tile rotation">
          {ROTATIONS.map((r) => (
            <button key={r} type="button" className={rotation === r ? 'active' : undefined} onClick={() => setRotation(r)}>
              {r}°
            </button>
          ))}
        </div>
      </div>

      <div className="claim-controls">
        <span className="label">Active player</span>
        <div className="player-swatches" role="group" aria-label="Active player">
          {PLAYER_COLORS.map((color, i) => (
            <button
              key={color}
              type="button"
              className={`player-swatch${i === activePlayer ? ' active' : ''}`}
              style={{ background: color }}
              aria-label={`Player ${i + 1}`}
              aria-pressed={i === activePlayer}
              onClick={() => setActivePlayer(i)}
            />
          ))}
        </div>
      </div>

      <div className="canvas-wrap">
        <TileLabCanvas>
          <ClaimScene
            prototype={prototype}
            regions={regions}
            rotation={rotation}
            claims={claims}
            onClaim={handleClaim}
          />
        </TileLabCanvas>
      </div>

      <div className="claim-list">
        <div className="claim-list-head">
          <span className="muted lab-hint">Click a region to claim · click again to remove</span>
          {claimList.length > 0 && (
            <button type="button" className="claim-clear" onClick={() => setClaims(new Map())}>Clear all</button>
          )}
        </div>
        {claimList.length === 0 ? (
          <p className="muted">No claims yet.</p>
        ) : (
          <ul>
            {claimList.map((c) => (
              <li key={c.localId}>
                <span className="claim-kind">{KIND_ICON[c.kind]} {c.kind.toLowerCase()} #{c.localId}</span>
                <span className="claim-owner" style={{ background: PLAYER_COLORS[c.playerIndex] }} aria-label={`Player ${c.playerIndex + 1}`} />
                <button type="button" className="claim-remove" onClick={() => removeClaim(c.localId)} aria-label="Remove claim">✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function disposeGroup(group: THREE.Object3D): void {
  group.traverse((obj) => {
    const mesh = obj as { geometry?: { dispose(): void }; material?: { dispose(): void } };
    mesh.geometry?.dispose();
    mesh.material?.dispose();
  });
}
