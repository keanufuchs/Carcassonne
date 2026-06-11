import { LAB_TILES, type LabTile } from '../tiles';

interface Props {
  selectedId: string;
  onSelect: (tile: LabTile) => void;
}

export function TileSelector({ selectedId, onSelect }: Props) {
  return (
    <nav className="selector">
      <h2>Tiles <span className="muted">({LAB_TILES.length})</span></h2>
      <ul>
        {LAB_TILES.map((tile) => (
          <li key={tile.id}>
            <button
              type="button"
              className={tile.id === selectedId ? 'active' : ''}
              onClick={() => onSelect(tile)}
            >
              <img src={tile.svgPath} alt="" width={28} height={28} />
              <span>{tile.code}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
