import type { LabTile } from '../tiles';
import { tileHasShield } from '../../src/core/types/tile';

export function PngPanel({ tile }: { tile: LabTile }) {
  return (
    <div className="panel">
      <h2>Original-PNG</h2>
      <div className="asset-wrap">
        <img src={tile.pngPath} alt={`${tile.id} PNG`} />
      </div>
    </div>
  );
}

export function SvgPanel({ tile }: { tile: LabTile }) {
  return (
    <div className="panel">
      <h2>Original-SVG <span className="muted">(Segmentformen)</span></h2>
      <div className="asset-wrap">
        <img src={tile.svgPath} alt={`${tile.id} SVG`} />
      </div>
    </div>
  );
}

export function InfoPanel({ tile }: { tile: LabTile }) {
  const { prototype } = tile;
  const segments = prototype.segments
    .map((s) => `${s.kind}#${s.localId}${s.isShielded ? ' ⛨' : ''}`)
    .join(', ');
  return (
    <div className="panel info">
      <h2>{tile.id} <span className="muted">· Code {tile.code}</span></h2>
      <dl>
        <dt>Segmente</dt>
        <dd>{segments}</dd>
        <dt>Kanten</dt>
        <dd>
          N: {prototype.edges.N.join('/')} · E: {prototype.edges.E.join('/')} ·
          {' '}S: {prototype.edges.S.join('/')} · W: {prototype.edges.W.join('/')}
        </dd>
        <dt>Kloster / Wappen</dt>
        <dd>{prototype.hasMonastery ? 'Kloster' : '–'} / {tileHasShield(prototype) ? 'Wappen' : '–'}</dd>
      </dl>
    </div>
  );
}
