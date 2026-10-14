import React, { useEffect, useRef, useState } from "react";
import { Button, Modal } from "../../../../ui";

/** Shared guard for settings. Route changes announce themselves before mutating history. */
export function useUnsavedChanges(dirty: boolean, discard: () => void) {
  const [pending, setPending] = useState<{
    href?: string;
    close?: () => void;
    proceed?: () => void;
  } | null>(null);
  const discardRef = useRef(discard);
  discardRef.current = discard;
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const beforeNavigate = (event: Event) => {
      const navigation = event as CustomEvent<{
        href?: string;
        proceed?: () => void;
        history?: boolean;
      }>;
      if (!navigation.detail?.href && !navigation.detail?.proceed) return;
      if (navigation.detail.history) {
        const requestedHref = navigation.detail.href;
        if (requestedHref === currentHref) return;
        // The central route reader invokes this synchronously before changing
        // section state. Restore the editor URL while the decision is pending.
        window.history.pushState({}, "", currentHref);
      }
      event.preventDefault();
      setPending({
        href: navigation.detail.href,
        proceed: navigation.detail.proceed,
      });
    };
    const currentHref = window.location.pathname + window.location.search;
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("tmv:before-navigate", beforeNavigate);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("tmv:before-navigate", beforeNavigate);
    };
  }, [dirty]);
  const requestClose = (close: () => void) => {
    if (dirty) setPending({ close });
    else close();
  };
  const leave = () => {
    discardRef.current();
    const action = pending;
    setPending(null);
    if (action?.close) action.close();
    if (action?.proceed) {
      action.proceed();
      return;
    }
    if (action?.href) {
      window.history.pushState({}, "", action.href);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };
  const dialog = (
    <Modal
      open={Boolean(pending)}
      onClose={() => setPending(null)}
      title="Discard unsaved changes?"
      size="sm"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setPending(null)}>
            Keep editing
          </Button>
          <Button variant="danger" onClick={leave}>
            Discard and continue
          </Button>
        </div>
      }
    >
      <p className="text-body text-fg-muted">
        Your unsaved changes will be lost. Saved values will remain in place.
      </p>
    </Modal>
  );
  return { dialog, requestClose };
}
