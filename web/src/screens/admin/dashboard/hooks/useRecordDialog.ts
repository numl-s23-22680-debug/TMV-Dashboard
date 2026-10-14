import { useId } from "react";
import { useDialogFocus } from "../../../../ui/useDialogFocus";

/** Labels the record panels and uses the application-wide dialog focus behaviour. */
export function useRecordDialog(open: boolean, onClose: () => void) {
  return { panelRef: useDialogFocus(open, onClose), titleId: useId() };
}
