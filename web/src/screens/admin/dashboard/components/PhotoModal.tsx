import React, { useEffect, useState } from "react";
import { useDialogFocus } from "../../../../ui/useDialogFocus";
import { X, ExternalLink, ZoomIn, ZoomOut } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  photoUrl: string;
  driveUrl?: string;
}

export function PhotoModal({
  isOpen,
  onClose,
  title,
  photoUrl,
  driveUrl,
}: Props) {
  const [zoomed, setZoomed] = useState(false);
  const [imageState, setImageState] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setImageState("loading");
    setZoomed(false);
  }, [photoUrl, attempt]);
  useEffect(() => {
    if (!isOpen || imageState !== "loading") return;
    const timeout = setTimeout(() => setImageState("error"), 15000);
    return () => clearTimeout(timeout);
  }, [isOpen, imageState, attempt]);

  const dialogRef = useDialogFocus(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-navy-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative max-w-4xl w-full bg-white rounded-card shadow-2xl border border-admin-line overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-admin-line bg-admin-surface">
          <div>
            <h3 className="text-base font-bold text-admin-ink">{title}</h3>
            <p className="text-xs text-admin-muted">
              Evidence photograph proxy
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoomed(!zoomed)}
              className="min-h-10 min-w-10 p-2 rounded-card hover:bg-admin-surface-2 text-admin-ink-2 transition"
              aria-label={zoomed ? "Zoom out" : "Zoom in"}
              title={zoomed ? "Zoom out" : "Zoom in"}
            >
              {zoomed ? (
                <ZoomOut className="w-4 h-4" />
              ) : (
                <ZoomIn className="w-4 h-4" />
              )}
            </button>
            {driveUrl && (
              <a
                href={driveUrl}
                target="_blank"
                rel="noreferrer"
                className="min-h-10 min-w-10 p-2 rounded-card hover:bg-admin-surface-2 text-tmv-blue transition"
                title="Open in Google Drive"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              aria-label="Close photo preview"
              onClick={onClose}
              className="min-h-10 min-w-10 p-2 rounded-card hover:bg-admin-status-red-bg text-admin-status-red transition ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-[240px] flex-1 overflow-auto bg-admin-surface p-4 sm:min-h-[360px]">
          {imageState === "loading" && (
            <p
              role="status"
              className="py-12 text-center text-[14px] text-admin-muted"
            >
              Loading evidence preview…
            </p>
          )}
          {imageState === "error" && (
            <div
              role="alert"
              className="py-12 text-center text-[14px] text-admin-muted"
            >
              <p>Evidence preview could not be loaded.</p>
              <button
                onClick={() => setAttempt((value) => value + 1)}
                className="mt-3 min-h-10 rounded-control border border-admin-line bg-white px-4 font-medium text-admin-brand"
              >
                Try again
              </button>
              {driveUrl && (
                <p className="mt-3">
                  The original evidence link is available above.
                </p>
              )}
            </div>
          )}
          <img
            key={`${photoUrl}:${attempt}`}
            src={photoUrl}
            onLoad={() => setImageState("loaded")}
            onError={() => setImageState("error")}
            alt={title}
            className={`mx-auto transition-transform duration-200 rounded-card max-h-[70vh] object-contain shadow ${imageState === "loaded" ? "block" : "hidden"} ${
              zoomed ? "scale-150 cursor-zoom-out" : "cursor-zoom-in"
            }`}
            onClick={() => setZoomed(!zoomed)}
          />
        </div>
      </div>
    </div>
  );
}
