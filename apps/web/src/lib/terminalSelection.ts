/**
 * Terminal surfaces draw their own selection, so `window.getSelection()` cannot
 * see it. Each mounted terminal registers a reader for its mount element, and
 * shortcuts read the selection of the terminal that holds focus.
 */
const readers = new Map<Element, () => string>();

export function registerTerminalSelectionReader(mount: Element, read: () => string): () => void {
  readers.set(mount, read);
  return () => {
    if (readers.get(mount) === read) readers.delete(mount);
  };
}

/** Selected text of the focused terminal; null when no terminal has focus. */
export function readFocusedTerminalSelection(): string | null {
  const active = document.activeElement;
  if (!active) return null;
  for (const [mount, read] of readers) {
    if (mount.contains(active)) return read();
  }
  return null;
}
