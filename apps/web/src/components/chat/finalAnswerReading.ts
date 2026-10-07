import { useSyncExternalStore } from "react";

// Opening a thread from an agent notification starts at the final answer of
// its latest turn instead of the live end. A small marker stays on that
// answer until the user sends the next message in the thread.

/** The parts of a timeline row the final answer search reads. */
export interface FinalAnswerCandidateRow {
  readonly id: string;
  readonly kind: string;
  readonly message?: { readonly id: string; readonly role: string };
}

/**
 * The final answer of the latest turn: the last assistant message after the
 * newest user message, after any tool calls and commentary. Null when the
 * latest turn has no assistant message yet.
 */
export function findFinalAnswerRow<Row extends FinalAnswerCandidateRow>(
  rows: ReadonlyArray<Row>,
): (Row & { readonly message: { readonly id: string; readonly role: string } }) | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row?.kind !== "message" || row.message === undefined) continue;
    if (row.message.role === "user") return null;
    if (row.message.role === "assistant") {
      return row as Row & { readonly message: { readonly id: string; readonly role: string } };
    }
  }
  return null;
}

export interface FinalAnswerReadingRequest {
  readonly threadKey: string;
  readonly id: number;
}

const MARKER_STORAGE_KEY = "t3code:final-answer-markers:v1";
const MAX_MARKERS = 50;

let nextRequestId = 1;
const requests = new Map<string, FinalAnswerReadingRequest>();
let markers: Map<string, string> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Ask the thread's timeline to open at its final answer. Call before navigating. */
export function requestFinalAnswerReading(threadKey: string): void {
  requests.set(threadKey, { threadKey, id: nextRequestId++ });
  emit();
}

export function readFinalAnswerReadingRequest(threadKey: string): FinalAnswerReadingRequest | null {
  return requests.get(threadKey) ?? null;
}

/** The timeline calls this once it has positioned the request (or given up). */
export function finishFinalAnswerReading(request: FinalAnswerReadingRequest): void {
  if (requests.get(request.threadKey) !== request) return;
  requests.delete(request.threadKey);
  emit();
}

export function useFinalAnswerReadingRequest(threadKey: string): FinalAnswerReadingRequest | null {
  const read = () => readFinalAnswerReadingRequest(threadKey);
  return useSyncExternalStore(subscribe, read, read);
}

function loadMarkers(): Map<string, string> {
  if (markers) return markers;
  markers = new Map();
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(MARKER_STORAGE_KEY) ?? "[]");
    if (Array.isArray(stored)) {
      for (const entry of stored) {
        if (Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "string") {
          markers.set(entry[0], entry[1]);
        }
      }
    }
  } catch {
    // Unreadable storage: markers last for this session only.
  }
  return markers;
}

function saveMarkers(current: Map<string, string>) {
  try {
    window.localStorage.setItem(MARKER_STORAGE_KEY, JSON.stringify([...current]));
  } catch {
    // Storage full or blocked: markers last for this session only.
  }
}

export function readFinalAnswerMarker(threadKey: string): string | null {
  return loadMarkers().get(threadKey) ?? null;
}

/** Mark where reading starts in the thread. The newest markers win the bounded store. */
export function markFinalAnswer(threadKey: string, messageId: string): void {
  const current = loadMarkers();
  if (current.get(threadKey) === messageId) return;
  current.delete(threadKey);
  current.set(threadKey, messageId);
  while (current.size > MAX_MARKERS) {
    const oldest = current.keys().next().value;
    if (oldest === undefined) break;
    current.delete(oldest);
  }
  saveMarkers(current);
  emit();
}

export function clearFinalAnswerMarker(threadKey: string): void {
  const current = loadMarkers();
  if (!current.delete(threadKey)) return;
  saveMarkers(current);
  emit();
}

export function useFinalAnswerMarker(threadKey: string): string | null {
  const read = () => readFinalAnswerMarker(threadKey);
  return useSyncExternalStore(subscribe, read, read);
}

/**
 * The marked row while its answer is still the final one. Once a newer user
 * message follows it, the marker is stale and `stale` is true.
 */
export function resolveFinalAnswerMarker(
  rows: ReadonlyArray<FinalAnswerCandidateRow>,
  markedMessageId: string | null,
): { readonly rowId: string | null; readonly stale: boolean } {
  if (markedMessageId === null) return { rowId: null, stale: false };
  const finalAnswer = findFinalAnswerRow(rows);
  if (finalAnswer?.message.id === markedMessageId) return { rowId: finalAnswer.id, stale: false };
  // Unknown until the marked answer is loaded: keep the marker for later.
  const marked = rows.some((row) => row.kind === "message" && row.message?.id === markedMessageId);
  return { rowId: null, stale: marked };
}
