import React, { useState } from "react";
import { Send } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchDrivers } from "../../../../api/admin";
import { Alert, Button, Modal } from "../../../../ui";
import { fetchWithTimeout } from "../../../../lib/fetchWithTimeout";
import { useToast } from "../../../../components/ui/Toast";
interface Props {
  isOpen: boolean;
  onClose: () => void;
}
export function SendBroadcastPushModal({ isOpen, onClose }: Props) {
  const toast = useToast();
  const [target, setTarget] = useState("all");
  const [title, setTitle] = useState("The Man Van Operations");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/?tab=jobs");
  const [isSending, setIsSending] = useState(false);
  const [preview, setPreview] = useState(false);
  const [sendError, setSendError] = useState("");
  const {
    data: drivers,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["broadcast_modal_drivers"],
    queryFn: fetchDrivers,
    enabled: isOpen,
  });
  const active = (drivers ?? []).filter((driver) => driver.active);
  const audience =
    target === "all"
      ? active
      : active.filter((driver) => driver.initials === target);
  const ready =
    !isLoading &&
    !error &&
    audience.length > 0 &&
    Boolean(title.trim() && body.trim());
  const close = () => {
    if (isSending) return;
    setPreview(false);
    setSendError("");
    onClose();
  };
  async function send() {
    if (!ready || !preview || isSending) return;
    setIsSending(true);
    setSendError("");
    try {
      const response = await fetchWithTimeout("/api/push/admin/broadcast", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          url,
          driverInitials: target === "all" ? undefined : target,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : result.error?.message || "Could not send the notification.",
        );
      toast.success(
        `Notification sent to ${result.result?.sent ?? 0} registered device(s).`,
      );
      setPreview(false);
      onClose();
    } catch (error) {
      setSendError(
        error instanceof Error
          ? error.message
          : "Could not send the notification. Your draft has been retained.",
      );
    } finally {
      setIsSending(false);
    }
  }
  return (
    <Modal
      open={isOpen}
      onClose={close}
      title={preview ? "Confirm broadcast notice" : "Compose broadcast notice"}
      size="lg"
      dismissible={!isSending}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={isSending}>
            Cancel
          </Button>
          {preview && (
            <Button
              variant="secondary"
              onClick={() => setPreview(false)}
              disabled={isSending}
            >
              Back to edit
            </Button>
          )}
          <Button
            iconLeft={<Send />}
            disabled={!ready}
            loading={isSending}
            onClick={() => (preview ? void send() : setPreview(true))}
          >
            {isSending
              ? "Sending…"
              : preview
                ? "Confirm and send"
                : "Preview notice"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <Alert
            tone="danger"
            title="Could not load recipients"
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void refetch()}
              >
                Retry
              </Button>
            }
          >
            The message cannot be sent until the recipient list is available.
          </Alert>
        )}
        {sendError && (
          <Alert tone="danger" title="Notice was not confirmed as sent">
            {sendError}
          </Alert>
        )}
        {preview ? (
          <>
            <Alert
              tone="warning"
              title={`Send to ${audience.length} active driver account${audience.length === 1 ? "" : "s"}?`}
            >
              This will send a real notification to registered devices for the
              selected audience. Device delivery may differ from the account
              count.
            </Alert>
            <div className="rounded-card border border-admin-line bg-admin-surface p-4">
              <p className="text-[12px] font-medium text-fg-muted">
                {target === "all"
                  ? "All active drivers"
                  : audience[0]?.fullName || target}
              </p>
              <h3 className="mt-2 text-[16px] font-semibold text-fg">
                {title}
              </h3>
              <p className="mt-2 whitespace-pre-wrap break-words text-[14px] text-fg">
                {body}
              </p>
              <p className="mt-3 break-all text-[12px] text-fg-muted">
                Tap destination: {url || "Not set"}
              </p>
            </div>
          </>
        ) : (
          <>
            <div>
              <label
                htmlFor="broadcast-recipient"
                className="mb-1.5 block text-[14px] font-medium text-fg"
              >
                Audience
              </label>
              <select
                id="broadcast-recipient"
                value={target}
                disabled={isLoading || Boolean(error)}
                onChange={(event) => setTarget(event.target.value)}
                className="h-11 w-full rounded-control border border-admin-line bg-white px-3 text-[14px]"
              >
                <option value="all">All active drivers</option>
                {active.map((driver) => (
                  <option key={driver.initials} value={driver.initials}>
                    {driver.fullName || driver.initials} ({driver.initials})
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[13px] text-fg-muted">
                {isLoading
                  ? "Loading audience…"
                  : `${audience.length} active driver account${audience.length === 1 ? "" : "s"} selected. Delivery depends on registered devices.`}
              </p>
            </div>
            <div>
              <label
                htmlFor="broadcast-title"
                className="mb-1.5 block text-[14px] font-medium text-fg"
              >
                Title <span className="text-fg-muted">(required)</span>
              </label>
              <input
                id="broadcast-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-11 w-full rounded-control border border-admin-line px-3 text-[14px]"
              />
            </div>
            <div>
              <label
                htmlFor="broadcast-body"
                className="mb-1.5 block text-[14px] font-medium text-fg"
              >
                Message <span className="text-fg-muted">(required)</span>
              </label>
              <textarea
                id="broadcast-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={4}
                className="w-full rounded-control border border-admin-line p-3 text-[14px]"
              />
            </div>
            <details>
              <summary className="cursor-pointer text-[13px] font-medium text-fg-muted">
                Tap destination
              </summary>
              <label htmlFor="broadcast-url" className="sr-only">
                Tap destination URL
              </label>
              <input
                id="broadcast-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                className="mt-2 h-11 w-full rounded-control border border-admin-line px-3 text-[14px]"
              />
            </details>
          </>
        )}
      </div>
    </Modal>
  );
}
