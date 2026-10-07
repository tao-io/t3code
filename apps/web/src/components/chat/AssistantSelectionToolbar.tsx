import {
  ASSISTANT_CITATION_MAX_COMMENT_LENGTH,
  ASSISTANT_CITATION_MAX_TEXT_LENGTH,
  MessageId,
  type AssistantCitation,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import { withAssistantCitationComment } from "@t3tools/shared/assistantCitations";
import { QuoteIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  captureAssistantTextSelection,
  type AssistantCitationSourceAnchor,
} from "~/lib/assistantTextSelection";
import {
  observeSelectionActions,
  resolveSelectionActionPosition,
  type SelectionActionPoint,
} from "~/lib/selectionActions";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { observeAssistantCitationCommentSource } from "./AssistantCitationSource";

/**
 * Selection actions for chat messages (assistant and user). Type a comment and press Enter to
 * add the quote with that comment to the composer in one step, or choose Cite to add the quote
 * and edit its comment beside the composer chip.
 */
export function AssistantSelectionToolbar({
  viewport,
  threadRef,
  onCite,
}: {
  viewport: HTMLElement | null;
  threadRef: ScopedThreadRef;
  onCite: (
    citation: AssistantCitation,
    sourceAnchor: AssistantCitationSourceAnchor | null,
  ) => boolean;
}) {
  const [selection, setSelection] = useState<{
    citation: AssistantCitation;
    position: SelectionActionPoint;
    sourceAnchor: AssistantCitationSourceAnchor;
    /** Mouse selections move focus to the comment field; keyboard selections stay extendable. */
    focusComment: boolean;
  } | null>(null);
  const [comment, setComment] = useState("");
  const [commentFocused, setCommentFocused] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const commentRef = useRef<HTMLInputElement>(null);
  const actionsRef = useRef<ReturnType<typeof observeSelectionActions> | null>(null);

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar || !selection) return;
    const rect = toolbar.getBoundingClientRect();
    toolbar.style.left = `${Math.max(8, Math.min(selection.position.x, window.innerWidth - rect.width - 8))}px`;
    toolbar.style.top = `${Math.max(8, Math.min(selection.position.y, window.innerHeight - rect.height - 8))}px`;
    if (selection.focusComment) commentRef.current?.focus({ preventScroll: true });
  }, [selection]);

  // Focus in the comment field clears the native selection; keep the quoted text marked.
  useEffect(() => {
    if (!selection || !commentFocused) return;
    return observeAssistantCitationCommentSource({
      anchor: { ...selection.sourceAnchor, range: selection.sourceAnchor.range.cloneRange() },
      citation: selection.citation,
      onUnavailable: () => {
        actionsRef.current?.cancel();
        setSelection(null);
      },
    });
  }, [commentFocused, selection]);

  useEffect(() => {
    if (!viewport) return;
    const clear = () => {
      setSelection(null);
      setCommentFocused(false);
    };
    const update = (pointer: SelectionActionPoint | null) => {
      const nativeSelection = window.getSelection();
      const captured = captureAssistantTextSelection(viewport, nativeSelection);
      const messageId = captured?.source.dataset.assistantCitationSource;
      if (!captured || !messageId) {
        clear();
        return;
      }
      const rect = captured.range.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      if (rect.bottom < viewportRect.top || rect.top > viewportRect.bottom || rect.width === 0) {
        clear();
        return;
      }
      const rects = captured.range.getClientRects();
      setComment("");
      setSelection({
        sourceAnchor: { source: captured.source, range: captured.range, viewport },
        citation: {
          version: 1,
          ...threadRef,
          messageId: MessageId.make(messageId),
          ...captured.selector,
        },
        position: resolveSelectionActionPosition({
          bounds: viewportRect,
          selectionRect: rects.item(rects.length - 1) ?? rect,
          pointer,
          viewport: { width: window.innerWidth, height: window.innerHeight },
        }),
        focusComment: pointer !== null,
      });
    };
    const actions = observeSelectionActions({
      element: viewport,
      getActionElement: () => toolbarRef.current,
      onSelection: update,
      onDismiss: clear,
    });
    actionsRef.current = actions;
    const focusActions = (event: KeyboardEvent) => {
      const toolbar = toolbarRef.current;
      if (
        event.key !== "Tab" ||
        event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.isComposing ||
        event.defaultPrevented ||
        !toolbar ||
        toolbar.contains(event.target as Node)
      ) {
        return;
      }
      const target = commentRef.current;
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      target.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", focusActions, true);
    document.addEventListener("selectionchange", actions.selectionChanged);
    return () => {
      document.removeEventListener("keydown", focusActions, true);
      document.removeEventListener("selectionchange", actions.selectionChanged);
      actions.dispose();
      actionsRef.current = null;
    };
  }, [threadRef, viewport]);

  if (!selection) return null;
  const tooLong = selection.citation.text.length > ASSISTANT_CITATION_MAX_TEXT_LENGTH;
  const dismiss = () => {
    actionsRef.current?.cancel();
    setSelection(null);
    setCommentFocused(false);
  };
  /** A typed comment goes in with the quote; without one the composer opens its comment editor. */
  const cite = (withComment: boolean) => {
    if (tooLong) return false;
    const inserted = withComment
      ? onCite(withAssistantCitationComment(selection.citation, comment), null)
      : onCite(selection.citation, selection.sourceAnchor);
    if (!inserted) return false;
    window.getSelection()?.removeAllRanges();
    dismiss();
    return true;
  };
  return createPortal(
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Selected text actions"
      className="surface-glass fixed z-50 flex max-w-[calc(100vw-1rem)] items-center gap-0.5 rounded-full border border-border/60 p-0.5 shadow-sm"
      style={{ left: selection.position.x, top: selection.position.y }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape" && !event.nativeEvent.isComposing) {
          event.preventDefault();
          dismiss();
        }
      }}
    >
      {tooLong ? null : (
        <div className="w-56 min-w-0">
          <Input
            ref={commentRef}
            nativeInput
            unstyled
            size="compact"
            aria-label="Comment on selected text"
            aria-description="Enter to add the quote and comment to the composer; Escape to close."
            placeholder="Comment, Enter to add"
            maxLength={ASSISTANT_CITATION_MAX_COMMENT_LENGTH}
            value={comment}
            onChange={(event) => setComment(event.currentTarget.value)}
            onFocus={() => setCommentFocused(true)}
            onBlur={() => setCommentFocused(false)}
            onCopy={(event) => {
              // The field holds focus after a mouse selection, so copy the quote instead.
              const field = event.currentTarget;
              if (field.selectionStart !== field.selectionEnd) return;
              event.preventDefault();
              event.clipboardData.setData("text/plain", selection.citation.text);
            }}
            onKeyDown={(event) => {
              if (
                event.key !== "Enter" ||
                event.shiftKey ||
                event.nativeEvent.isComposing ||
                event.keyCode === 229
              ) {
                return;
              }
              event.preventDefault();
              cite(true);
            }}
          />
        </div>
      )}
      <Button
        type="button"
        size="xs"
        variant="ghost"
        disabled={tooLong}
        aria-label={tooLong ? "Selection is too long to cite" : "Cite selection in composer"}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => cite(comment.trim() !== "")}
      >
        <QuoteIcon aria-hidden="true" className="size-3.5" />
        {tooLong ? "Shorten selection" : "Cite"}
      </Button>
    </div>,
    document.body,
  );
}
