import type { ScopedThreadRef } from "@t3tools/contracts";

/**
 * Lets the `thread.rename` shortcut and the command palette start the chat
 * header's inline rename without holding a ref to it. The header ignores a
 * request for a thread it does not show.
 */
type Listener = (threadRef: ScopedThreadRef) => void;
const listeners = new Set<Listener>();

export function requestThreadRename(threadRef: ScopedThreadRef): void {
  for (const listener of listeners) listener(threadRef);
}

export function subscribeThreadRenameRequests(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
