export type Unsubscribe = () => void;

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
