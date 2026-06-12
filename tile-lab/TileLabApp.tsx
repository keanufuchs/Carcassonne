import { useState } from 'react';
import { LAB_TILES, type LabTile } from './tiles';
import { TileSelector } from './components/TileSelector';
import { ClaimTestPanel } from './components/ClaimTestPanel';

export function TileLabApp() {
  const [selected, setSelected] = useState<LabTile>(LAB_TILES[0]);

  return (
    <div className="lab">
      <header className="lab-header">
        <strong>Carcassonne · Tile-Lab</strong>
        <span className="muted">Claim-Test</span>
      </header>
      <div className="lab-body">
        <TileSelector selectedId={selected.id} onSelect={setSelected} />
        <main className="main-container">
          <ClaimTestPanel
            key={selected.id}
            prototype={selected.prototype}
            title="Claim-Test"
            subtitle="Banner-Eigentum"
            pngPath={selected.pngPath}
            tileId={selected.id}
          />
        </main>
      </div>
    </div>
  );
}
