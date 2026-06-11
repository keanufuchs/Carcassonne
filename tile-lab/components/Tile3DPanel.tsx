import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows } from '@react-three/drei';
import type { TilePrototype } from '../../src/core/types/tile';
import { parseTileRegions, type TileRegions } from '../../src/three/svgRegions';
import { layoutRegions } from '../../src/three/layoutRegions';
import { generateTile } from '../../src/three/generateTile';

interface Props {
  prototype: TilePrototype;
  /** Region source: parse this SVG when given, otherwise derive from the TS topology. */
  svgPath?: string;
  title: string;
  subtitle?: string;
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

export function Tile3DPanel({ prototype, svgPath, title, subtitle }: Props) {
  const [svgRegions, setSvgRegions] = useState<TileRegions | null>(null);

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
      <h2>{title} {subtitle && <span className="muted">({subtitle})</span>}</h2>
      <div className="canvas-wrap">
        <Canvas shadows camera={{ position: [1.3, 1.25, 1.3], fov: 40 }}>
          <color attach="background" args={['#aebfcf']} />
          <fog attach="fog" args={['#aebfcf', 4, 9]} />
          <hemisphereLight args={['#dce8ff', '#5a7042', 0.55]} />
          <ambientLight intensity={0.2} />
          <directionalLight
            position={[2.5, 4, 2]}
            intensity={1.5}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0002}
            shadow-camera-left={-1}
            shadow-camera-right={1}
            shadow-camera-top={1}
            shadow-camera-bottom={-1}
            shadow-camera-near={0.1}
            shadow-camera-far={12}
          />
          <Grid
            args={[6, 6]}
            cellSize={0.25}
            sectionSize={1}
            cellColor="#93a6b8"
            sectionColor="#7e93a8"
            infiniteGrid
            fadeDistance={7}
            fadeStrength={2}
          />
          {regions && <TileMesh prototype={prototype} regions={regions} />}
          <ContactShadows
            position={[0, 0.001, 0]}
            scale={2.2}
            resolution={1024}
            blur={2.4}
            opacity={0.5}
            far={1.2}
          />
          <OrbitControls
            makeDefault
            target={[0, 0, 0]}
            enableDamping
            dampingFactor={0.08}
            minDistance={0.8}
            maxDistance={4}
            maxPolarAngle={Math.PI / 2.05}
          />
        </Canvas>
      </div>
    </div>
  );
}
