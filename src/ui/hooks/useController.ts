import { createContext, useContext } from 'react';
import type { GameController } from '../../controller/GameController';

export const ControllerContext = createContext<GameController | null>(null);

export function useController(): GameController {
  const c = useContext(ControllerContext);
  if (!c) throw new Error('ControllerContext not provided');
  return c;
}
