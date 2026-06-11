import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import type { TilePrototype } from '../../src/core/types/tile';
import { parseTileRegions, type TileRegions } from '../../src/three/svgRegions';
import { generateTile } from '../../src/three/generateTile';

interface Props {
  prototype: TilePrototype;
  svgPath: string;
}

function TileMesh({ prototype, regions }: { prototype: TilePrototype; regions: TileRegions }) {
  const group = useMemo(() => generateTile(prototype, regions), [prototype, regions]);
  // Dispose generated geometry when it is replaced or unmounted.
  useEffect(() => () => {
    group.traverse((obj) => {
      const mesh = obj as { geometry?: { dispose(): void }; material?: { dispose(): void } };
      mesh.geometry?.dispose();
      mesh.material?.dispose();
    });
  }, [group]);
  return <primitive object={group} />;
}

export function Tile3DPanel({ prototype, svgPath }: Props) {
  const [regions, setRegions] = useState<TileRegions | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRegions(null);
    fetch(svgPath)
      .then((r) => r.text())
      .then((markup) => {
        if (!cancelled) setRegions(parseTileRegions(markup));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [svgPath]);

  return (
    <div className="panel">
      <h2>3D-Modell <span className="muted">(prozedural, Iteration 1)</span></h2>
      <div className="canvas-wrap">
        <Canvas shadows camera={{ position: [1.1, 1.2, 1.1], fov: 45 }}>
          <color attach="background" args={['#1e2430']} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[2, 4, 2]} intensity={1.1} castShadow />
          <Grid args={[4, 4]} cellSize={0.25} sectionSize={1} infiniteGrid fadeDistance={6} />
          {regions && <TileMesh prototype={prototype} regions={regions} />}
          <OrbitControls makeDefault target={[0, 0, 0]} />
        </Canvas>
      </div>
    </div>
  );
}
