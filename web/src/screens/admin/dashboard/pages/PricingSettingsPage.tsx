import React, { useEffect, useState } from "react";
import { Box, Clock, Plus, ReceiptText, Save, Users } from "lucide-react";
import { fetchSettings, saveSetting, type EditableSetting } from "../api";
import { Alert, Button } from "../../../../ui";
import { ApiErrorState } from "../components/ApiErrorState";
import { useUnsavedChanges } from "../utils/useUnsavedChanges";

export function PricingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settings, setSettings] = useState<EditableSetting[]>([]);
  const [baseline, setBaseline] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [newCrewSize, setNewCrewSize] = useState("");
  const [newCrewRate, setNewCrewRate] = useState("");
  const [addError, setAddError] = useState("");
  const dirty = Object.keys(values).filter(
    (key) => values[key] !== baseline[key],
  );
  const spec = (key: string) => settings.find((item) => item.key === key);
  const effective = (key: string) => {
    const value = values[key]?.trim() || spec(key)?.fallback?.trim();
    return value && Number.isFinite(Number(value))
      ? new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency: "GBP",
        }).format(Number(value))
      : "Not configured";
  };
  const invalid = dirty.filter(
    (key) =>
      spec(key)?.type === "number" &&
      values[key] !== "" &&
      (!Number.isFinite(Number(values[key])) || Number(values[key]) < 0),
  );
  const discard = () => {
    setValues({ ...baseline });
    setSettings((list) => list.filter((item) => item.key in baseline));
    setFailures({});
    setNotice("");
    setNewCrewSize("");
    setNewCrewRate("");
    setAddError("");
  };
  const guard = useUnsavedChanges(
    dirty.length > 0 || Boolean(newCrewSize || newCrewRate),
    discard,
  );

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await fetchSettings();
      const saved = Object.fromEntries(
        result.settings.map((item) => [item.key, item.value]),
      );
      setSettings(result.settings);
      setBaseline(saved);
      setValues(saved);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Couldn't load settings.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  function update(key: string, value: string) {
    setValues((old) => ({ ...old, [key]: value }));
    setNotice("");
    setFailures((old) => {
      const next = { ...old };
      delete next[key];
      return next;
    });
  }
  async function save() {
    if (saving || !dirty.length || invalid.length) return;
    setSaving(true);
    setNotice("");
    const failed: Record<string, string> = {};
    const saved: Record<string, string> = {};
    // The existing API accepts one setting. Preserve honest per-field outcomes rather than implying atomicity.
    for (const key of dirty) {
      try {
        await saveSetting(key, values[key]);
        saved[key] = values[key];
      } catch (error) {
        failed[key] =
          error instanceof Error
            ? error.message
            : "Could not save this setting.";
      }
    }
    setBaseline((old) => ({ ...old, ...saved }));
    setSettings((old) =>
      old.map((item) =>
        item.key in saved ? { ...item, value: saved[item.key] } : item,
      ),
    );
    setFailures(failed);
    const savedCount = Object.keys(saved).length;
    setNotice(
      Object.keys(failed).length
        ? `${savedCount} of ${dirty.length} changes saved. ${Object.keys(failed).length} failed; those changes remain unsaved.`
        : `${savedCount} change${savedCount === 1 ? "" : "s"} saved.`,
    );
    setSaving(false);
  }
  function addCrew() {
    const size = Number(newCrewSize);
    if (!Number.isInteger(size) || size < 4 || size > 12) {
      setAddError("Enter a crew size from 4 to 12.");
      return;
    }
    const key = `CREW_RATE_${size}_MAN`;
    if (spec(key)) {
      setAddError("That crew size already has a rate.");
      return;
    }
    if (
      !newCrewRate.trim() ||
      !Number.isFinite(Number(newCrewRate)) ||
      Number(newCrewRate) < 0
    ) {
      setAddError("Enter a rate of zero or more.");
      return;
    }
    setSettings((old) => [
      ...old,
      {
        key,
        label: `${size}-person crew`,
        type: "number",
        fallback: "",
        value: "",
      },
    ]);
    update(key, newCrewRate);
    setNewCrewSize("");
    setNewCrewRate("");
    setAddError("");
  }
  const crew = settings
    .filter((item) => /^CREW_RATE_\d+_MAN$/.test(item.key))
    .sort((a, b) => crewSize(a.key) - crewSize(b.key));
  const field = (key: string, label: string, unit: string, help?: string) => (
    <div key={key} className="min-w-0">
      <label
        htmlFor={`setting-${key}`}
        className="mb-2 block text-[14px] font-medium text-fg"
      >
        {label}
        {dirty.includes(key) && (
          <span className="ml-2 text-[12px] font-normal text-amber-700">
            Changed
          </span>
        )}
      </label>
      <div className="relative">
        <span
          className="absolute left-3 top-3 text-[14px] text-fg-muted"
          aria-hidden
        >
          {unit.startsWith("£") ? "£" : ""}
        </span>
        <input
          id={`setting-${key}`}
          type={spec(key)?.type === "number" ? "number" : "text"}
          min={spec(key)?.type === "number" ? 0 : undefined}
          step="any"
          value={values[key] ?? ""}
          onChange={(event) => update(key, event.target.value)}
          placeholder={spec(key)?.fallback}
          aria-invalid={invalid.includes(key) || Boolean(failures[key])}
          aria-describedby={`hint-${key}`}
          className={`h-11 w-full rounded-control border bg-white pr-3 text-[14px] tabular-nums outline-none focus:border-admin-brand focus:ring-2 focus:ring-admin-brand/20 ${unit.startsWith("£") ? "pl-8" : "pl-3"} ${invalid.includes(key) || failures[key] ? "border-red-400" : "border-admin-line"}`}
        />
      </div>
      <p
        id={`hint-${key}`}
        className="mt-1.5 text-[12px] leading-relaxed text-fg-muted"
      >
        {unit}
        {help ? ` · ${help}` : ""}
      </p>
      {invalid.includes(key) && (
        <p className="mt-1 text-[13px] text-red-700">
          Enter a valid amount of zero or more.
        </p>
      )}
      {failures[key] && (
        <p role="alert" className="mt-1 text-[13px] text-red-700">
          Not saved: {failures[key]}
        </p>
      )}
    </div>
  );
  if (loading)
    return (
      <div
        role="status"
        className="rounded-module border border-admin-line bg-white p-10 text-[14px] text-fg-muted"
      >
        Loading pricing settings…
      </div>
    );
  if (loadError)
    return <ApiErrorState message={loadError} onRetry={() => void load()} />;
  return (
    <div className="space-y-5 pb-28">
      <Alert title="Changes take effect after saving">
        Rates are used by the existing billing workflow. The effect on active or
        historical jobs has not been confirmed; verify that policy before
        changing live prices.
      </Alert>
      {notice && (
        <Alert
          tone={Object.keys(failures).length ? "warning" : "success"}
          title={notice}
        />
      )}
      <fieldset disabled={saving} className="space-y-5 disabled:opacity-70">
        <SettingsGroup
          title="Crew rates"
          icon={<Users className="size-4" />}
          description="Normal service · billed in 30-minute units."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {crew.map((item) =>
              field(
                item.key,
                `${crewSize(item.key)}-person crew`,
                "£ / 30 min",
              ),
            )}
          </div>
          <details className="mt-4 border-t border-admin-line pt-4">
            <summary className="cursor-pointer text-[14px] font-medium text-admin-brand">
              Add a crew size
            </summary>
            <div className="mt-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <div>
                <label
                  htmlFor="new-crew-size"
                  className="mb-1.5 block text-[13px] font-medium"
                >
                  Crew size
                </label>
                <input
                  id="new-crew-size"
                  type="number"
                  min={4}
                  max={12}
                  value={newCrewSize}
                  onChange={(event) => setNewCrewSize(event.target.value)}
                  className="h-11 w-full rounded-control border border-admin-line px-3"
                />
              </div>
              <div>
                <label
                  htmlFor="new-crew-rate"
                  className="mb-1.5 block text-[13px] font-medium"
                >
                  Rate (£ / 30 min)
                </label>
                <input
                  id="new-crew-rate"
                  type="number"
                  min={0}
                  step="any"
                  value={newCrewRate}
                  onChange={(event) => setNewCrewRate(event.target.value)}
                  className="h-11 w-full rounded-control border border-admin-line px-3"
                />
              </div>
              <Button variant="secondary" iconLeft={<Plus />} onClick={addCrew}>
                Add crew rate
              </Button>
            </div>
            {addError && (
              <p role="alert" className="mt-2 text-[13px] text-red-700">
                {addError}
              </p>
            )}
          </details>
          {spec("CREW_BILLING_UNIT") && (
            <details className="mt-4 border-t border-admin-line pt-4">
              <summary className="cursor-pointer text-[14px] font-medium text-fg-muted">
                Advanced billing-unit setting
              </summary>
              <div className="mt-3 max-w-sm">
                {field(
                  "CREW_BILLING_UNIT",
                  "Stored billing unit",
                  "Stored text setting",
                  "The billing effect of this setting is unverified. Existing value and editing are preserved.",
                )}
              </div>
            </details>
          )}
        </SettingsGroup>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <SettingsGroup
            title="Packing"
            icon={<Box className="size-4" />}
            description="For packing and full packing service."
          >
            {field("PACKING_RATE", "Packing service", "£ / 30 min")}
          </SettingsGroup>
          <SettingsGroup
            title="Additional charges"
            icon={<ReceiptText className="size-4" />}
            description="Fixed charges selected by the driver."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {field("CONGESTION_CHARGE", "Congestion", "£ / selected charge")}
              {field("TUNNEL_CHARGE", "Tunnel", "£ / selected charge")}
            </div>
          </SettingsGroup>
        </div>
        <SettingsGroup
          title="Overtime"
          icon={<Clock className="size-4" />}
          description="Set a flat rate or inherit the applicable service rate."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field(
              "OVERTIME_RATE_PER_30",
              "Flat overtime rate",
              "£ / 30 min",
              "Leave blank to inherit the applicable service rate.",
            )}
            {field("OVERTIME_GRACE_MINS", "Grace period", "minutes")}
          </div>
          {!values.OVERTIME_RATE_PER_30?.trim() && (
            <div className="mt-4 rounded-card bg-admin-surface p-3 text-[13px] text-fg-muted">
              <p className="font-medium text-fg">
                Effective overtime basis: applicable crew or packing rate
              </p>
              <p className="mt-1">
                {crew
                  .map(
                    (item) =>
                      `${crewSize(item.key)}-person: ${effective(item.key)}`,
                  )
                  .join(" · ")}{" "}
                · Packing: {effective("PACKING_RATE")} per 30 min.
              </p>
              <p className="mt-1">
                One additional 30-minute unit uses that service rate, subject to
                the existing billing rules.
              </p>
            </div>
          )}
        </SettingsGroup>
      </fieldset>
      {dirty.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl rounded-card border border-admin-line bg-white p-3 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span role="status" className="text-[14px] font-medium text-fg">
              {dirty.length} unsaved change{dirty.length === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={discard} disabled={saving}>
                Discard
              </Button>
              <Button
                onClick={() => void save()}
                loading={saving}
                disabled={invalid.length > 0}
                iconLeft={<Save />}
              >
                {saving
                  ? "Saving…"
                  : Object.keys(failures).length
                    ? "Retry unsaved changes"
                    : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {guard.dialog}
    </div>
  );
}
function crewSize(key: string) {
  return Number(/^CREW_RATE_(\d+)_MAN$/.exec(key)?.[1] ?? 0);
}
function SettingsGroup({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-module border border-admin-line bg-white p-5">
      <h3 className="flex items-center gap-2 text-[18px] font-semibold text-fg">
        <span className="text-admin-brand">{icon}</span>
        {title}
      </h3>
      <p className="mb-4 mt-1 text-[13px] text-fg-muted">{description}</p>
      {children}
    </section>
  );
}
