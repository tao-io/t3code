// A double click selects one word, and browsers end a word at "-". So a double click on
// "MR-559" selects "MR" or "559". This module grows that selection to the full ticket id.

const TICKET = /[A-Z][A-Z0-9]{1,9}-\d+/g;
const WORD_CHARACTER = /[A-Za-z0-9]/;

/** The range [start, end) of the ticket id (MR-559, OPTI-41) that holds the selection, or null. */
export function ticketRangeAt(text: string, start: number, end: number): [number, number] | null {
  // Windows browsers add the space after the word to a double-click selection.
  const trimmedEnd = start + text.slice(start, end).trimEnd().length;
  for (const match of text.matchAll(TICKET)) {
    const from = match.index;
    const to = from + match[0].length;
    if (start < from) return null;
    if (start >= to) continue;
    const before = text[from - 1];
    const after = text[to];
    if ((before && WORD_CHARACTER.test(before)) || (after && WORD_CHARACTER.test(after))) {
      return null;
    }
    return trimmedEnd <= to ? [from, to] : null;
  }
  return null;
}

/**
 * Listens for the second mouseup of a double click inside `element` and grows the word
 * selection to the full ticket id. Editable fields keep their native word selection.
 */
export function observeTicketDoubleClick(element: HTMLElement): () => void {
  const onMouseUp = (event: MouseEvent) => {
    if (event.detail !== 2 || event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("input, textarea, [contenteditable]:not([contenteditable=false])")) return;
    const selection = element.ownerDocument.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return;
    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    if (node !== range.endContainer || node.nodeType !== Node.TEXT_NODE) return;
    const ticket = ticketRangeAt(node.textContent ?? "", range.startOffset, range.endOffset);
    if (ticket) selection.setBaseAndExtent(node, ticket[0], node, ticket[1]);
  };
  element.addEventListener("mouseup", onMouseUp, true);
  return () => element.removeEventListener("mouseup", onMouseUp, true);
}
