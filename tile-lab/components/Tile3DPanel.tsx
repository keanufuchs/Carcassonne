import { useEffect, useMemo, useState } from 'react';
import type { Rotation, TilePrototype } from '../../src/core/types/tile';
import { parseTileRegions, type TileRegions } from '../../src/three/svgRegions';
import { layoutRegions } from '../../src/three/layoutRegions';
import { generateTile } from '../../src/three/generateTile';
import { disableTileContentRaycast } from '../../src/three/regionHighlight';
import { RegionInteractionLayer } from '../../src/three/RegionInteractionLayer';
import { CompassMarkers } from './CompassMarkers';
import { TileLabCanvas } from './TileLabCanvas';

interface Props {
  prototype: TilePrototype;
  /** Region source: parse this SVG when given, otherwise derive from the TS topology. */
  svgPath?: string;
  title: string;
  subtitle?: string;
}

function TileScene({
  prototype,
  regions,
  rotation,
}: {
  prototype: TilePrototype;
  regions: TileRegions;
  rotation: Rotation;
}) {
  const [hoveredLocalId, setHoveredLocalId] = useState<number | null>(null);
  const tileGroup = useMemo(() => {
    const group = generateTile(prototype, regions);
    disableTileContentRaycast(group);
    return group;
  }, [prototype, regions]);

  useEffect(() => {
    setHoveredLocalId(null);
  }, [prototype.id, regions, rotation]);

  // Dispose generated geometry when it is replaced or unmounted.
  useEffect(() => () => {
    tileGroup.traverse((obj) => {
      const mesh = obj as { geometry?: { dispose(): void }; material?: { dispose(): void } };
      mesh.geometry?.dispose();
      mesh.material?.dispose();
    });
  }, [tileGroup]);

  const rotationY = (rotation * Math.PI) / 180;

  return (
    <group rotation={[0, rotationY, 0]}>
      <primitive object={tileGroup} />
      <RegionInteractionLayer
        tileGroup={tileGroup}
        regions={regions}
        hoveredLocalId={hoveredLocalId}
        onHoverLocalId={setHoveredLocalId}
      />
      <CompassMarkers />
    </group>
  );
}

const ROTATIONS: Rotation[] = [0, 90, 180, 270];

export function Tile3DPanel({ prototype, svgPath, title, subtitle }: Props) {
  const [svgRegions, setSvgRegions] = useState<TileRegions | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);

  useEffect(() => {
    if (!svgPath) return;
    let cancelled = false;
    setSvgRegions(null);
    fetch(svgPath)
      .then((r) => r.text())
      .then((markup) => {
        if (!cancelled) setSvgRegions(parseTileRegions(markup));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [svgPath]);

  const derivedRegions = useMemo(
    () => (svgPath ? null : layoutRegions(prototype)),
    [svgPath, prototype],
  );
  const regions = svgPath ? svgRegions : derivedRegions;

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{title} {subtitle && <span className="muted">({subtitle})</span>}</h2>
        <div className="panel-head-actions">
          <span className="muted lab-hint">Hover regions to highlight</span>
          <div className="rotation-controls" role="group" aria-label="Tile rotation">
          {ROTATIONS.map((r) => (
            <button
              key={r}
              type="button"
              className={rotation === r ? 'active' : undefined}
              onClick={() => setRotation(r)}
            >
              {r}°
            </button>
          ))}
          </div>
        </div>
      </div>
      <div className="canvas-wrap">
        <TileLabCanvas>
          {regions && <TileScene prototype={prototype} regions={regions} rotation={rotation} />}
        </TileLabCanvas>
      </div>
    </div>
  );
}
