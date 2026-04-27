# 7. API: Controller ⇄ UI

The controller is the **only** surface the UI may call into. It wraps the `Game` aggregate, exposes synchronous commands, and broadcasts state updates via subscription. No async, no IPC, no event bus beyond a tiny pub/sub.

## 7.1 Controller interface

```ts
// controller/GameController.ts

export interface GameController {
  // ─── Lifecycle ─────────────────────────────────────────────────────────
  startGame(playerNames: string[]): Result;            // 2..5 names

  // ─── Turn commands ─────────────────────────────────────────────────────
  drawTile(): Result;                                   // PLACING_TILE → pendingTile populated
                                                        //              OR transitions to GAME_OVER
  rotatePending(direction: 'CW' | 'CCW'): Result;       // PLACING_TILE; updates pendingRotation
  placeTile(coord: Coord): Result;                      // PLACING_TILE → PLACING_MEEPLE on success
  placeMeeple(ref: SegmentRef): Result;                 // PLACING_MEEPLE → resolves scoring → next player
  skipMeeple(): Result;                                 // PLACING_MEEPLE → resolves scoring → next player

  // ─── Queries (read-only, do not mutate state) ──────────────────────────
  getState(): Readonly<GameState>;                      // current snapshot
  previewPlacement(coord: Coord, rotation: Rotation):   // for hover UI
    { legal: true } | { legal: false; reason: ErrorCode };
  getMeepleTargetsForLastTile(): SegmentRef[];          // legal targets in PLACING_MEEPLE; empty otherwise

  // ─── Subscription ──────────────────────────────────────────────────────
  subscribe(listener: (state: Readonly<GameState>) => void): Unsubscribe;
}

export type Unsubscribe = () => void;
```

### 7.1.1 Result type

```ts
export type Result<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: ErrorCode; message: string };
```

Defined once in `core/types.ts`; identical between core and controller.

### 7.1.2 Command semantics

- All commands are **synchronous**. They mutate `Game` then notify subscribers in the same call stack.
- A failed command leaves state unchanged (other than possibly advancing nothing). The error is returned, not thrown.
- Subscribers are invoked **once per successful state-mutating command**, with the latest snapshot.

## 7.2 State snapshot contract

`getState()` returns the live `GameState` reference. The UI **must treat it as read-only** (TypeScript `Readonly<>` enforces shallow immutability; deep mutation is a programmer error).

The snapshot is **stable across non-mutating queries**: calling `previewPlacement` does not change `version` or notify subscribers.

React components rely on `version` to know when to re-render. The `useGameState` hook stores `version` in component state; on subscription callback, if `version` differs, it `setState`s to trigger re-render.

```ts
// ui/hooks/useGameState.ts

export function useGameState(): Readonly<GameState> {
  const controller = useController();
  const [, setVersion] = useState(controller.getState().version);
  useEffect(() => controller.subscribe(s => setVersion(s.version)), [controller]);
  return controller.getState();
}
```

## 7.3 Pub/sub implementation

```ts
// controller/pubsub.ts

export interface PubSub<T> {
  subscribe(listener: (value: T) => void): Unsubscribe;
  publish(value: T): void;
}

export function createPubSub<T>(): PubSub<T> {
  const listeners = new Set<(v: T) => void>();
  return {
    subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
    publish(v)   { for (const l of listeners) l(v); },
  };
}
```

Synchronous, unordered, no error isolation (a throwing listener crashes the publish — listeners must be defensive). Acceptable because the only listener is `useGameState`.

## 7.4 Command examples

### 7.4.1 Drawing

```ts
// UI:
const r = controller.drawTile();
if (!r.ok) showToast(r.message);

// What the controller does internally:
//   - if phase !== PLACING_TILE: { ok: false, error: 'WRONG_PHASE' }
//   - if pendingTile already set: { ok: true, value: undefined } (idempotent no-op)
//   - else: drawPlaceable(deck, board)
//        - returns null ⇒ apply end-game scoring; phase = GAME_OVER
//        - returns proto ⇒ pendingTile = proto, pendingRotation = 0
//   - publish(state)
//   - return { ok: true, value: undefined }
```

### 7.4.2 Rotating

```ts
// UI:
controller.rotatePending('CW');     // Result is ignored; UI just re-reads from getState()
```

### 7.4.3 Placing

```ts
// UI: user clicks an empty cell.
const r = controller.placeTile({ x, y });
if (!r.ok) {
  // typical errors: CELL_OCCUPIED, EDGE_MISMATCH, NOT_ADJACENT, NO_PENDING_TILE
  showToast(r.message);
}
// On success: phase is now PLACING_MEEPLE; UI reads state and offers meeple slots.
```

### 7.4.4 Meeple placement

```ts
// UI: highlight controller.getMeepleTargetsForLastTile() as clickable.
const targets = controller.getMeepleTargetsForLastTile();
// On click of one:
const r = controller.placeMeeple(target);
// or:
const r = controller.skipMeeple();
// Either way, after this call:
//   - mid-game scoring resolved
//   - meeples returned for completed features
//   - currentPlayerIndex advanced (or phase = GAME_OVER)
//   - subscribers notified
```

### 7.4.5 Hover preview

```ts
// UI: on tile hover at (x, y) during PLACING_TILE:
const p = controller.previewPlacement({ x, y }, state.pendingRotation);
if (p.legal) renderGhostTile({ x, y, ok: true });
else         renderGhostTile({ x, y, ok: false, reason: p.reason });
```

## 7.5 Information flow summary

```
  React component
       │  (1) read snapshot via useGameState()
       │  (2) on user input, call controller.<command>()
       ▼
  GameController
       │  validate & dispatch to Game
       ▼
  Game (core)
       │  mutate GameState; bump version
       ▼
  GameController
       │  publish(getState())
       ▼
  All subscribers (incl. useGameState hooks)
       │  setState(version) → React re-renders affected components
```

## 7.6 What is NOT in this API (intentionally)

- **No save/load.** No serialization commands.
- **No undo.** No history queries.
- **No async.** No promises returned.
- **No multi-window.** No cross-window state sync.
- **No IPC from React → Electron main.** Game lives entirely in renderer.
- **No animations.** UI does its own visual transitions; the controller publishes only logical state.
- **No internationalization.** All strings English in MVP.

These are deliberate omissions consistent with the MVP-first / no-overengineering principle.
