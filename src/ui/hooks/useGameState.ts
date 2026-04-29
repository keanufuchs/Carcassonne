import { useState, useEffect } from 'react';
import type { GameState } from '../../core/game/GameState';
import { useController } from './useController';

export function useGameState(): Readonly<GameState> {
  const controller = useController();
  const [, setVersion] = useState(() => controller.getState().version);
  useEffect(() => controller.subscribe(s => setVersion(s.version)), [controller]);
  return controller.getState();
}
