import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Pencil,
  Save,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import {
  fetchMessages,
  MessageAudience,
  MessageCatalogItem,
  saveMessageTemplate,
  toggleMessage,
} from "../api";
import { Alert, Button, Modal, SegmentedControl, Switch } from "../../../../ui";
import { ApiErrorState } from "../components/ApiErrorState";
import { useUnsavedChanges } from "../utils/useUnsavedChanges";

// The real, single-shared placeholder syntax renderMessageTemplate() (src/notifications/
// message.ts and message-catalog.ts) actually substitutes -- not every message supports
// every token, see each item's own `variables` from the API.
const MOCK_DATA: Record<string, string> = {
  "{customerName}": "Example customer",
  "{NAME}": "Example customer",
  "{companyName}": "The Man Van",
  "{pickup}": "Example pickup, London",
  "{dropoff}": "Example destination, London",
  "{driverPhone}": "07000 000000",
  "{vanRegistration}": "EX00 VAN",
  "{driver_name}": "Example driver",
  "{job_time}": "09:00",
  "{job_date}": "13 Oct 2026",
  "{booking_date}": "13 Oct 2026",
  "{leadMinutes}": "45",
  "{jobId}": "TMV-AB12CD34EF",
};

function renderPreview(content: string): string {
  let preview = content;
  for (const [token, value] of Object.entries(MOCK_DATA)) {
    preview = preview.split(token).join(value);
  }
  return preview;
}

const AUDIENCE_COPY: Record<MessageAudience, string> = {
  customer:
    "Every message the app sends to a customer, at any stage of the job.",
  driver:
    "Every message the app sends to a driver -- push notifications, SMS and email.",
};

/**
 * Every message the app sends, in one place -- backed by notifications/message-catalog.ts
 * (the single source of truth for what exists, its settings keys and its default
 * on/off state). Customer/Driver tabs split the same flat list by audience; each row's
 * Switch calls POST /api/admin/messages/:id/toggle immediately (no separate save step --
 * disabling stops the next send right away, see every gated call site in the backend),
 * and the pencil opens the same editor+preview view the old flat Settings-style page
 * used, now shared across every message instead of 3 hardcoded cards.
 */
export function MessagingPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<MessageAudience>("customer");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState("");
  const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set());
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["messages"],
    queryFn: fetchMessages,
  });

  const items = data?.items ?? [];
  const visible = items.filter((i) => i.audience === tab);
  const editingItem = items.find((i) => i.id === editingId) ?? null;

  const handleToggle = async (item: MessageCatalogItem, enabled: boolean) => {
    setToggleError("");
    setPendingToggles((old) => new Set(old).add(item.id));
    const previous = queryClient.getQueryData<{ items: MessageCatalogItem[] }>([
      "messages",
    ]);
    // Optimistic -- a toggle should feel instant, and this list is small enough that a
    // full refetch on every flip would be a visible flicker for no benefit.
    queryClient.setQueryData(
      ["messages"],
      (old: { items: MessageCatalogItem[] } | undefined) =>
        old
          ? {
              items: old.items.map((i) =>
                i.id === item.id ? { ...i, enabled } : i,
              ),
            }
          : old,
    );
    try {
      await toggleMessage(item.id, enabled);
    } catch (error) {
      if (previous) queryClient.setQueryData(["messages"], previous);
      setToggleError(
        `Could not update ${item.label}. ${error instanceof Error ? error.message : "Try again."}`,
      );
    } finally {
      setPendingToggles((old) => {
        const next = new Set(old);
        next.delete(item.id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto pb-12">
      <div className="bg-white p-6 rounded-module border border-admin-line shadow-sm">
        <p className="text-[14px] text-admin-muted max-w-3xl">
          Edit event templates and preview them with sample data. Template edits
          take effect after Save changes; enabled switches save immediately for
          future sends.
        </p>
      </div>

      <div className="flex justify-start">
        <SegmentedControl
          aria-label="Message audience"
          value={tab}
          onChange={setTab}
          options={[
            { value: "customer" as const, label: "Customer" },
            { value: "driver" as const, label: "Driver" },
          ]}
        />
      </div>

      <p className="text-[13px] text-admin-muted">{AUDIENCE_COPY[tab]}</p>
      {toggleError && <Alert tone="danger" title={toggleError} />}

      {isLoading && (
        <div className="h-64 bg-white rounded-module border border-admin-line animate-pulse flex items-center justify-center">
          <span className="text-admin-muted font-medium">
            Loading messages...
          </span>
        </div>
      )}

      {error &&
        (data ? (
          <Alert
            tone="warning"
            title="Message templates could not refresh"
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void refetch()}
              >
                Retry
              </Button>
            }
          >
            Showing the last successfully loaded templates.
          </Alert>
        ) : (
          <ApiErrorState
            message={(error as Error)?.message}
            onRetry={() => void refetch()}
          />
        ))}

      {!isLoading && data && visible.length === 0 && (
        <div className="bg-white rounded-module border border-admin-line shadow-sm p-12 text-center">
          <MessageSquare className="w-8 h-8 text-admin-muted mx-auto mb-3" />
          <h3 className="text-card text-fg">No messages configured</h3>
        </div>
      )}

      {!isLoading && data && visible.length > 0 && (
        <div className="bg-white rounded-module border border-admin-line shadow-sm divide-y divide-admin-line overflow-hidden">
          {visible.map((item) => (
            <div
              key={item.id}
              className="p-5 flex items-center justify-between gap-4 flex-wrap"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-card text-fg">{item.label}</h3>
                  <span className="px-2 py-0.5 rounded-control bg-admin-surface border border-admin-line text-[12px] font-medium text-fg-subtle">
                    {item.channel}
                  </span>
                </div>
                <p className="text-[13px] text-admin-muted mt-1 max-w-2xl">
                  {item.hint}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[13px] text-fg-muted">
                  {item.enabled ? "Enabled" : "Disabled"}
                </span>
                <Switch
                  disabled={pendingToggles.size > 0}
                  checked={item.enabled}
                  onChange={(enabled) => handleToggle(item, enabled)}
                  aria-label={`${item.enabled ? "Disable" : "Enable"} ${item.label}`}
                />
                <button
                  onClick={() => setEditingId(item.id)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-[13px] font-medium text-admin-brand hover:bg-admin-surface transition"
                  title="Edit template"
                  aria-label={`Edit ${item.label}`}
                >
                  <Pencil className="w-4 h-4" /> Edit & preview
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingItem && (
        <MessageEditModal
          item={editingItem}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["messages"] });
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
}

function MessageEditModal({
  item,
  onClose,
  onSaved,
}: {
  item: MessageCatalogItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [titleDraft, setTitleDraft] = useState(item.title ?? "");
  const [bodyDraft, setBodyDraft] = useState(item.body);
  const [htmlDraft, setHtmlDraft] = useState(item.html ?? "");
  const [htmlEnabled, setHtmlEnabled] = useState(Boolean(item.htmlEnabled));
  const [editorTab, setEditorTab] = useState<"plain" | "html">("plain");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const isSms = item.channel === "SMS";
  const chars = bodyDraft.length;
  const isSmsOverlimit = isSms && chars > 160;
  const unsaved =
    bodyDraft !== item.body ||
    (item.hasTitle && titleDraft !== (item.title ?? "")) ||
    (item.hasHtml && htmlDraft !== (item.html ?? "")) ||
    (item.hasHtml && htmlEnabled !== Boolean(item.htmlEnabled));
  const htmlReady =
    !item.hasHtml || !htmlEnabled || htmlDraft.trim().length > 0;
  const usedTokens =
    `${titleDraft} ${bodyDraft} ${htmlEnabled ? htmlDraft : ""}`.match(
      /\{[a-zA-Z_][a-zA-Z0-9_]*\}/g,
    ) ?? [];
  const invalidTokens = [
    ...new Set(usedTokens.filter((token) => !item.variables.includes(token))),
  ];
  const guard = useUnsavedChanges(unsaved, () => {
    setTitleDraft(item.title ?? "");
    setBodyDraft(item.body);
    setHtmlDraft(item.html ?? "");
    setHtmlEnabled(Boolean(item.htmlEnabled));
  });
  const close = () => guard.requestClose(onClose);

  const handleSave = async () => {
    if (invalidTokens.length || !htmlReady || !bodyDraft.trim()) return;
    setSaving(true);
    setSaveError("");
    try {
      await saveMessageTemplate(item.id, {
        ...(item.hasTitle ? { title: titleDraft } : {}),
        body: bodyDraft,
        ...(item.hasHtml ? { html: htmlDraft, htmlEnabled } : {}),
      });
      onSaved();
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setBodyDraft(item.bodyFallback);
    if (item.hasTitle) setTitleDraft(item.titleFallback ?? "");
    if (item.hasHtml) setHtmlDraft(item.htmlFallback ?? "");
    if (item.hasHtml) setHtmlEnabled(false);
  };

  return (
    <>
      <Modal
        open
        onClose={close}
        title={item.label}
        size="lg"
        dismissible={!saving}
        footer={
          <div className="flex items-center justify-between w-full gap-3">
            <Button
              variant="ghost"
              onClick={handleReset}
              iconLeft={<RotateCcw />}
            >
              Reset to default
            </Button>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={close} disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                loading={saving}
                disabled={
                  !unsaved ||
                  !bodyDraft.trim() ||
                  !htmlReady ||
                  invalidTokens.length > 0
                }
                iconLeft={<Save />}
              >
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <p className="text-[13px] text-fg-muted">
            {item.audience === "customer" ? "Customer" : "Driver"} ·{" "}
            {item.channel} · Sample preview only; preview never sends a message.
          </p>
          {invalidTokens.length > 0 && (
            <Alert tone="warning" title="Unsupported variables">
              {invalidTokens.join(", ")}. Use the available variables for this
              event.
            </Alert>
          )}
          {saveError && (
            <p className="text-[12px] text-admin-status-red font-medium flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {saveError}
            </p>
          )}

          {item.variables.length > 0 && (
            <div>
              <span className="text-eyebrow text-fg-subtle tracking-wider block mb-2">
                Available Variables
              </span>
              <div className="flex flex-wrap gap-2">
                {item.variables.map((v) => (
                  <button
                    key={v}
                    onClick={() => setBodyDraft((d) => d + v)}
                    className="px-2.5 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-admin-brand text-[12px] font-medium border border-blue-200 transition"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {item.hasTitle && (
            <div>
              <label
                htmlFor="template-title"
                className="text-[13px] font-medium text-fg block mb-2"
              >
                Title
              </label>
              <input
                id="template-title"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="w-full h-10 px-3 rounded-card border border-admin-line bg-white text-[14px] text-admin-ink shadow-sm outline-none focus:border-admin-brand focus:ring-1 focus:ring-admin-brand transition"
              />
            </div>
          )}

          <div>
            {item.hasHtml ? (
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <SegmentedControl
                  aria-label="Email editor"
                  value={editorTab}
                  onChange={setEditorTab}
                  options={[
                    { value: "plain" as const, label: "Plain Text" },
                    { value: "html" as const, label: "Advanced HTML" },
                  ]}
                />
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-admin-muted">
                    Send as HTML
                  </span>
                  <Switch
                    checked={htmlEnabled}
                    onChange={setHtmlEnabled}
                    aria-label="Send as HTML"
                  />
                </div>
              </div>
            ) : (
              <label className="text-eyebrow text-fg-subtle tracking-wider block mb-2">
                {item.hasTitle ? "Body" : "Message"}
              </label>
            )}

            {!item.hasHtml || editorTab === "plain" ? (
              <>
                <textarea
                  aria-label="Message text"
                  aria-invalid={invalidTokens.length > 0}
                  value={bodyDraft}
                  onChange={(e) => setBodyDraft(e.target.value)}
                  className="w-full h-40 p-4 rounded-card border border-admin-line bg-white text-[14px] font-mono text-admin-ink shadow-sm outline-none focus:border-admin-brand focus:ring-1 focus:ring-admin-brand resize-none transition"
                  placeholder="Type message text here..."
                />
                {isSms && (
                  <div
                    className={`mt-2 flex items-center gap-1.5 text-[12px] font-semibold ${isSmsOverlimit ? "text-admin-status-red" : "text-admin-muted"}`}
                  >
                    {isSmsOverlimit && (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    <span>{chars} characters (SMS standard is 160)</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <textarea
                  aria-label="Advanced HTML source"
                  value={htmlDraft}
                  onChange={(e) => setHtmlDraft(e.target.value)}
                  className="w-full h-56 p-4 rounded-card border border-admin-line bg-white text-[13px] font-mono text-admin-ink shadow-sm outline-none focus:border-admin-brand focus:ring-1 focus:ring-admin-brand resize-y transition"
                  placeholder={
                    "<h1>Hello {customerName}</h1>\n<p>Your pickup is {pickup}</p>\n<p>Your driver is {driver_name}.</p>"
                  }
                  spellCheck={false}
                />
                {htmlEnabled && !htmlDraft.trim() && (
                  <p className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-admin-status-red">
                    <AlertTriangle className="w-3.5 h-3.5" /> Add HTML code or
                    turn off Send as HTML.
                  </p>
                )}
              </>
            )}
          </div>

          <div>
            <span className="text-eyebrow text-fg-subtle tracking-wider block mb-2">
              Preview with sample data
            </span>
            <div className="bg-[#FAFAFA] border border-admin-line rounded-card p-5 relative overflow-hidden">
              {item.hasTitle && (
                <div className="text-[14px] font-bold text-admin-ink mb-1.5">
                  {renderPreview(titleDraft) || (
                    <span className="text-admin-muted italic font-normal">
                      Empty title...
                    </span>
                  )}
                </div>
              )}
              <div className="text-[14px] text-admin-ink whitespace-pre-wrap leading-relaxed">
                {renderPreview(bodyDraft) || (
                  <span className="text-admin-muted italic">
                    Empty message...
                  </span>
                )}
              </div>
            </div>
          </div>

          {item.hasHtml && editorTab === "html" && htmlDraft.trim() && (
            <div>
              <span className="text-eyebrow text-fg-subtle tracking-wider block mb-2">
                HTML Preview
              </span>
              <iframe
                title={`${item.label} HTML preview`}
                sandbox=""
                srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">${renderPreview(htmlDraft)}`}
                className="w-full h-72 rounded-card border border-admin-line bg-white"
              />
            </div>
          )}
        </div>
      </Modal>
      {guard.dialog}
    </>
  );
}
