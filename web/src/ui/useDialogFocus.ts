import { useEffect, useRef } from "react";

const dialogStack: HTMLElement[] = [];
let originalBodyOverflow = "";
const FOCUSABLE =
  'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex="0"]';

/** Shared keyboard containment and focus restoration for existing custom dialogs. */
export function useDialogFocus(
  open: boolean,
  onClose: () => void,
  dismissible = true,
) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  onCloseRef.current = onClose;
  dismissibleRef.current = dismissible;
  useEffect(() => {
    if (!open || !ref.current) return;
    const panel = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    if (dialogStack.length === 0)
      originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogStack.push(panel);
    panel.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== panel) return;
      if (event.key === "Escape" && dismissibleRef.current) {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((control) => {
        const disclosure = control.closest("details:not([open])");
        return !disclosure || control.tagName === "SUMMARY";
      });
      if (!controls.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = controls[0],
        last = controls[controls.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === panel ||
          !panel.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === panel ||
          !panel.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const index = dialogStack.indexOf(panel);
      if (index >= 0) dialogStack.splice(index, 1);
      document.body.style.overflow = dialogStack.length
        ? "hidden"
        : originalBodyOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);
  return ref;
}
