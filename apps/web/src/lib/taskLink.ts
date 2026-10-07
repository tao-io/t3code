/**
 * Builds the URL `selection.openTaskLink` opens from the selected text and the
 * user's "Task link URL" template.
 */

export const TASK_LINK_ID_PLACEHOLDER = "{id}";
const MAX_TASK_LINK_ID_LENGTH = 200;

/**
 * The trimmed selection when it can be a task id. Empty text, a selection
 * that crosses lines, or anything longer than a short id is not one.
 */
export function taskLinkIdFromSelection(text: string): string | null {
  const id = text.trim();
  if (id.length === 0 || id.length > MAX_TASK_LINK_ID_LENGTH) return null;
  if (/[\r\n]/.test(id)) return null;
  return id;
}

export type TaskLinkUrlResult =
  | { readonly kind: "url"; readonly url: string }
  | { readonly kind: "not-configured" }
  | { readonly kind: "invalid-template" };

/**
 * Puts the URL-encoded id in place of every `{id}`. A template without the
 * placeholder takes the id at its end, so a plain prefix also works. Only
 * http(s) results are links the app can open.
 */
export function buildTaskLinkUrl(template: string, id: string): TaskLinkUrlResult {
  const trimmed = template.trim();
  if (trimmed.length === 0) return { kind: "not-configured" };
  const encoded = encodeURIComponent(id);
  const url = trimmed.includes(TASK_LINK_ID_PLACEHOLDER)
    ? trimmed.replaceAll(TASK_LINK_ID_PLACEHOLDER, encoded)
    : `${trimmed}${encoded}`;
  try {
    const { protocol } = new URL(url);
    if (protocol !== "http:" && protocol !== "https:") return { kind: "invalid-template" };
  } catch {
    return { kind: "invalid-template" };
  }
  return { kind: "url", url };
}
