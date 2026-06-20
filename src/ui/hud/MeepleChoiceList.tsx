import type { SegmentKind, SegmentRef } from '../../core/types';
import { segmentKey } from '../../core/types';
import { type MeepleChoice, MEEPLE_KIND_LABEL } from './meepleChoices';
import { CityIcon, RoadIcon, MonasteryIcon, FieldIcon } from '../icons/Icons';

interface Props {
  choices: MeepleChoice[];
  /** segmentKey of the currently selected choice, or null. */
  selectedKey: string | null;
  onSelect: (ref: SegmentRef) => void;
  onConfirm: () => void;
  onSkip: () => void;
}

function renderChoiceIcon(kind: SegmentKind) {
  switch (kind) {
    case 'CITY':
      return <CityIcon size={16} />;
    case 'ROAD':
      return <RoadIcon size={16} />;
    case 'MONASTERY':
      return <MonasteryIcon size={16} />;
    case 'FIELD':
      return <FieldIcon size={16} />;
    default:
      return null;
  }
}

/**
 * Touch-friendly meeple placement for mobile: instead of tapping a small
 * highlighted region on the 3D tile, the player picks from a numbered list of
 * every valid placement. Selecting an entry highlights the matching region on
 * the board (kept as a visual reference) and arms the Place button. See issue #34.
 */
export function MeepleChoiceList({ choices, selectedKey, onSelect, onConfirm, onSkip }: Props) {
  return (
    <div className="meeple-choice" data-testid="meeple-choice-list">
      <div className="meeple-choice-options" role="listbox" aria-label="Meeple placement options">
        {choices.map((choice, index) => {
          const key = segmentKey(choice.ref);
          const selected = key === selectedKey;
          return (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={selected}
              data-testid="meeple-choice-option"
              className={`meeple-choice-option${selected ? ' is-selected' : ''}`}
              onClick={() => onSelect(choice.ref)}
            >
              <span className="meeple-choice-num">{index + 1}</span>
              <span className="meeple-choice-glyph" aria-hidden="true">
                {renderChoiceIcon(choice.kind)}
              </span>
              <span className="meeple-choice-label">{MEEPLE_KIND_LABEL[choice.kind]}</span>
            </button>
          );
        })}
      </div>
      <div className="meeple-choice-actions">
        <button
          type="button"
          data-testid="meeple-choice-confirm"
          className="btn btn-sm btn-gold meeple-choice-place"
          disabled={selectedKey === null}
          onClick={onConfirm}
        >
          Place Meeple
        </button>
        <button
          type="button"
          data-testid="skip-meeple-btn"
          className="btn btn-sm btn-ghost"
          onClick={onSkip}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
