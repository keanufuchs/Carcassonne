import { useState } from 'react';
import { LAB_TILES, type LabTile } from './tiles';
import { TileSelector } from './components/TileSelector';
import { Tile3DPanel } from './components/Tile3DPanel';
import { PngPanel, SvgPanel, InfoPanel } from './components/AssetPanels';

export function TileLabApp() {
  const [selected, setSelected] = useState<LabTile>(LAB_TILES[0]);

  return (
    <div className="lab">
      <header className="lab-header">
        <strong>Carcassonne · Tile-Lab</strong>
        <span className="muted">Prozedurale 3D-Tile-Generierung — Feasibility</span>
      </header>
      <div className="lab-body">
        <TileSelector selectedId={selected.id} onSelect={setSelected} />
        <main className="grid">
          <InfoPanel tile={selected} />
          <PngPanel tile={selected} />
          <SvgPanel tile={selected} />
          <Tile3DPanel
            prototype={selected.prototype}
            svgPath={selected.svgPath}
            title="3D-Modell (SVG-Regionen)"
            subtitle="Referenz"
          />
          <Tile3DPanel
            prototype={selected.prototype}
            title="3D-Modell (TS-Topologie)"
            subtitle="ohne SVG"
          />
        </main>
      </div>
    </div>
  );
}
