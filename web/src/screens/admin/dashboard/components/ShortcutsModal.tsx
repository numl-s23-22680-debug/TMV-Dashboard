import React from "react";
import { Modal } from "../../../../ui/Modal";
interface Props {
  isOpen: boolean;
  onClose: () => void;
}
export function ShortcutsModal({ isOpen, onClose }: Props) {
  const shortcuts = [
    {
      key: /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K",
      desc: "Jump to page",
    },
    { key: "?", desc: "Keyboard shortcuts" },
    { key: "R", desc: "Refresh dashboard data" },
    { key: "O", desc: "Overview" },
    { key: "J", desc: "Jobs" },
    { key: "D", desc: "Drivers" },
    { key: "Esc", desc: "Close dialog or preview" },
  ];
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Keyboard shortcuts"
      size="md"
      placement="center"
    >
      <p className="text-sm text-admin-ink-2 mb-3">
        Page shortcuts are inactive while entering text.
      </p>
      <dl className="divide-y divide-admin-line">
        {shortcuts.map((sc) => (
          <div
            className="flex justify-between items-center gap-4 py-3 text-sm"
            key={sc.key}
          >
            <dt>{sc.desc}</dt>
            <dd>
              <kbd className="px-2 py-1 bg-admin-surface border border-admin-line rounded text-xs">
                {sc.key}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
