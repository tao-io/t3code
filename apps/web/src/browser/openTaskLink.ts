import { AuthPreviewOperateScope, type ScopedThreadRef } from "@t3tools/contracts";
import { isAtomCommandInterrupted } from "@t3tools/client-runtime/state/runtime";

import { recordVisitForThread } from "~/browserHistoryStore";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { getClientSettings } from "~/hooks/useSettings";
import { buildTaskLinkUrl } from "~/lib/taskLink";
import { readLocalApi } from "~/localApi";
import { readEnvironmentScope } from "~/state/session";

import { canOpenLinksInApp } from "./browserLinkTarget";
import { type OpenPreviewMutation, openUrlInPreview } from "./openFileInPreview";

function openInSystemBrowser(url: string): void {
  // On web this calls window.open before its first await, so it still counts
  // as part of the key press and is not blocked as a pop-up.
  void readLocalApi()
    ?.shell.openExternal(url)
    .catch(() => {
      toastManager.add(stackedThreadToast({ type: "error", title: "Could not open task link" }));
    });
}

/**
 * Opens the "Task link URL" for `id` in the in-app browser beside the thread.
 * Without an in-app browser (web, no thread, no preview access) or when the
 * in-app open fails, the link goes to the system browser.
 */
export function openTaskLink(input: {
  readonly id: string;
  readonly threadRef: ScopedThreadRef | null;
  readonly openPreview: OpenPreviewMutation;
}): void {
  const result = buildTaskLinkUrl(getClientSettings().taskLinkUrlTemplate, input.id);
  if (result.kind !== "url") {
    toastManager.add(
      stackedThreadToast({
        type: result.kind === "not-configured" ? "info" : "error",
        title:
          result.kind === "not-configured"
            ? "Task link URL is not set"
            : "Task link URL is invalid",
        description:
          "Set an http(s) URL with {id} in Settings → Integrations → Task links, such as https://tracker.example/task/{id}.",
      }),
    );
    return;
  }
  const { url } = result;
  const threadRef = input.threadRef;
  if (
    threadRef === null ||
    !readEnvironmentScope(threadRef.environmentId, AuthPreviewOperateScope) ||
    !canOpenLinksInApp(threadRef)
  ) {
    openInSystemBrowser(url);
    return;
  }
  void openUrlInPreview({ threadRef, url, openPreview: input.openPreview }).then((opened) => {
    if (isAtomCommandInterrupted(opened)) return;
    if (opened._tag === "Success") {
      recordVisitForThread(threadRef, url);
      return;
    }
    console.error(opened.cause);
    openInSystemBrowser(url);
  });
}
