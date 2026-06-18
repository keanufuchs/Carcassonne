import { useRef, useEffect } from 'react';
import { HumanIcon, DiceIcon, BrainIcon, RobotIcon } from './icons/Icons';
import { useAnimatedDisclosure } from './hooks/useAnimatedDisclosure';
import type { AIMode } from './SetupScreen';

interface Option {
  value: AIMode;
  label: string;
  icon: React.ReactNode;
}

interface CustomSelectProps {
  value: AIMode;
  onChange: (value: AIMode) => void;
}

export function CustomSelect({ value, onChange }: CustomSelectProps) {
  const { isOpen, isClosing, expanded, close, toggle } = useAnimatedDisclosure();
  const containerRef = useRef<HTMLDivElement>(null);

  const options: Option[] = [
    { value: 'human', label: 'Human', icon: <HumanIcon size={16} /> },
    { value: 'random', label: 'Random AI', icon: <DiceIcon size={16} /> },
    { value: 'heuristic', label: 'Heuristic AI', icon: <BrainIcon size={16} /> },
    { value: 'intelligent', label: 'Reasoning AI', icon: <RobotIcon size={16} /> },
  ];

  const selectedOption = options.find(o => o.value === value) ?? options[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        close();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [close]);

  return (
    <div
      className={`custom-select-container${expanded ? ' is-open' : ''}`}
      ref={containerRef}
      style={{
        position: 'relative',
        flex: '1.4 0 auto',
        minWidth: '145px'
      }}
    >
      <button
        type="button"
        className="select custom-select-trigger"
        onClick={toggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          textAlign: 'left',
          padding: '9px 10px',
          justifyContent: 'space-between',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          color: 'var(--ink)',
          fontFamily: 'var(--font-ui)',
          fontWeight: 700,
          fontSize: '13px',
          outline: 'none',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          {selectedOption.icon}
          <span style={{ whiteSpace: 'nowrap' }}>{selectedOption.label}</span>
        </div>
        <span style={{ fontSize: '9px', opacity: 0.6, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', flexShrink: 0 }}>▼</span>
      </button>

      {isOpen && (
        <div
          className={`custom-select-dropdown${isClosing ? ' is-closing' : ''}`}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 1000,
            background: 'var(--panel)',
            border: '2px solid var(--panel-edge)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-md), 0 4px 12px rgba(40, 30, 18, 0.15)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            minWidth: '100%',
            width: 'max-content'
          }}
        >
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              className="custom-select-option"
              onClick={() => {
                onChange(o.value);
                close();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                border: 'none',
                background: o.value === value ? 'var(--parchment-deep)' : 'transparent',
                color: 'var(--ink)',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                fontFamily: 'var(--font-ui)',
                fontWeight: 600,
                fontSize: '13px',
                outline: 'none',
                transition: 'background 0.1s ease',
                boxSizing: 'border-box',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                if (o.value !== value) {
                  e.currentTarget.style.background = 'var(--cream)';
                }
              }}
              onMouseLeave={(e) => {
                if (o.value !== value) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {o.icon}
              <span style={{ flex: 1, marginRight: '8px' }}>{o.label}</span>
              {o.value === value && <span style={{ color: 'var(--terracotta)', fontWeight: 'bold', fontSize: '11px', flexShrink: 0 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
