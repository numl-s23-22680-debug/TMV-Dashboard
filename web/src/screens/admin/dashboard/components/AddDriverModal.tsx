import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { fetchDrivers, fetchLiveFleet, saveDriver } from "../api";
import { DriverSummaryItem } from "../types";
import { Button, Modal } from "../../../../ui";
import { DRIVER_OPTIONS_QUERY_KEY } from "../hooks/useDriverOptions";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  driverToEdit?: DriverSummaryItem | null;
}

export function AddDriverModal({ isOpen, onClose, driverToEdit }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [vehicleReg, setVehicleReg] = useState("");
  const [imei, setImei] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [active, setActive] = useState(true);
  const [pwaPassword, setPwaPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveWarning, setSaveWarning] = useState("");
  const [showValidation, setShowValidation] = useState(false);

  // Driver summary includes account-backed roster rows plus job-only initials rows.
  // Only a real account can own/block a code; job-only rows are allowed to be folded
  // into the newly-created driver account with the same initials.
  const { data: driversData } = useQuery({ queryKey: ["drivers_summary"], queryFn: () => fetchDrivers() });
  const roster = driversData?.drivers ?? [];

  // A picker rather than a free-text box: a wrong digit in a 15-digit IMEI is silent
  // and effectively unrecoverable (the whole point of using IMEI over a plate is to
  // avoid exactly that kind of typo), so this only ever offers real, currently-known
  // GPSLive devices. Only fetched while the modal is open.
  const { data: fleetData } = useQuery({
    queryKey: ["fleet_live"],
    queryFn: fetchLiveFleet,
    enabled: isOpen
  });
  const devices = fleetData?.vehicles ?? [];

  // Sync state with driverToEdit when modal opens or driver changes
  useEffect(() => {
    if (driverToEdit) {
      setName(driverToEdit.fullName);
      setCode(driverToEdit.initials);
      setVehicleReg(driverToEdit.vanRegistration || "");
      setImei(driverToEdit.imei || "");
      setEmail(driverToEdit.email || "");
      setPhone(driverToEdit.phone || "");
      setActive(driverToEdit.active !== false);
    } else {
      setName("");
      setCode("");
      setVehicleReg("");
      setImei("");
      setEmail("");
      setPhone("");
      setActive(true);
    }
    setShowValidation(false);
    setPwaPassword("");
    setSaveError("");
    setSaveWarning("");
  }, [driverToEdit, isOpen]);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!driverToEdit && (!code || code.length < 2)) {
      setCode(val.substring(0, 2).toUpperCase());
    }
  };

  // Initials are taken if a real driver account owns them AND we aren't editing that
  // same driver. Job-only summary rows must not block creating the account.
  const isCodeTaken = roster.some(d =>
    d.hasAccount && d.initials === code.toUpperCase() && (!driverToEdit || driverToEdit.initials !== code.toUpperCase())
  );
  const passwordTooShort = pwaPassword.length > 0 && pwaPassword.length < 8;

  const nameInvalid = !name.trim();
  const codeInvalid = !/^[A-Z]{2}$/.test(code);
  const emailInvalid = !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const handleSubmit = async () => {
    setShowValidation(true);
    if (nameInvalid || codeInvalid || emailInvalid || isCodeTaken || passwordTooShort || isSaving) return;
    setSaveError("");
    setSaveWarning("");
    setIsSaving(true);
    try {
      const initials = code.toUpperCase();
      const result = await saveDriver({
        initials,
        fullName: name,
        email,
        active,
        phone,
        vanRegistration: vehicleReg,
        imei,
        // Omitted (not sent empty) when blank, so editing a driver without touching
        // this field never resets/clears their existing app password.
        ...(pwaPassword ? { password: pwaPassword } : {})
      });

      // The save itself is fast -- it only touches driver_accounts. What's slow is
      // /api/admin/drivers/summary's own refetch, since it also recomputes every
      // driver's job stats from the full dataset (jobs/evidence/activity/...), which
      // can take several seconds regardless of what actually changed here. Patch the
      // fields we just saved into the cache directly so the roster reflects the edit
      // immediately instead of the UI sitting on stale data until that slow refetch
      // lands -- invalidateQueries below still runs in the background to pick up
      // anything the optimistic patch can't know (e.g. a brand-new driver's real
      // job stats), it just no longer blocks what the admin sees right now.
      // setQueriesData (not setQueryData) -- DriversPage.tsx's own query key is
      // ["drivers_summary", from, to] (it has its own date-range filter), not the bare
      // ["drivers_summary"] every other caller here uses. A single-key setQueryData
      // would miss it entirely, patching everywhere except the one page an admin is
      // actually looking at while editing.
      queryClient.setQueriesData<{ drivers: DriverSummaryItem[] } | undefined>({ queryKey: ["drivers_summary"] }, old => {
        if (!old?.drivers) return old;
        const patch: Partial<DriverSummaryItem> = {
          initials, fullName: name, email, phone, vanRegistration: vehicleReg, imei, active, hasAccount: true
        };
        const idx = old.drivers.findIndex(d => d.hasAccount && d.initials === initials);
        if (idx >= 0) {
          const drivers = [...old.drivers];
          drivers[idx] = { ...drivers[idx], ...patch };
          return { ...old, drivers };
        }
        // Brand-new driver: seed zeroed stats so it shows up right away; the
        // background refetch fills in real numbers once it lands.
        return {
          ...old,
          drivers: [
            ...old.drivers,
            {
              ...patch,
              assigned: 0, completed: 0, cancelled: 0, completionRate: 0,
              avgDurationMinutes: 0, avgDelayMinutes: 0, revenuePounds: 0, revenueFormatted: "£0.00",
              cashCollectedPounds: 0, missingEvidenceCount: 0, overtimeCount: 0
            } as DriverSummaryItem
          ]
        };
      });
      queryClient.invalidateQueries({ queryKey: ["drivers_summary"] });
      queryClient.invalidateQueries({ queryKey: DRIVER_OPTIONS_QUERY_KEY });
      if (result.warning) {
        // Stay open so the warning is actually seen -- the Sheets save did succeed,
        // this isn't a failure, but silently closing would hide that the password
        // part didn't take.
        setSaveWarning(result.warning);
      } else {
        onClose();
      }
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save driver.");
    } finally {
      setIsSaving(false);
    }
  };

  return <Modal open={isOpen} onClose={onClose} dismissible={!isSaving} title={driverToEdit ? "Edit driver" : "Add driver"} size="lg"
    footer={<div className="space-y-3">
      {saveError && <p role="alert" className="text-sm text-admin-status-red flex gap-2"><AlertTriangle size={16} className="shrink-0" />{saveError} Your entered details have been kept.</p>}
      {saveWarning && <p role="status" className="text-sm text-amber-700">{saveWarning}</p>}
      <div className="flex justify-end gap-3">{saveWarning ? <Button onClick={onClose} iconLeft={<CheckCircle2 />}>Done</Button> : <><Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button><Button onClick={() => void handleSubmit()} loading={isSaving}>{driverToEdit ? "Save changes" : "Add driver"}</Button></>}</div>
    </div>}>
    <form className="space-y-6" onSubmit={event => { event.preventDefault(); void handleSubmit(); }}>
      <p className="text-xs text-admin-muted">Required fields are marked *. Driver code identifies historical jobs.</p>
      <fieldset className="space-y-4"><legend className="text-sm font-semibold text-admin-ink mb-3">Identity & contact</legend>
        <DriverInput id="driver-name" label="Full name *" value={name} onChange={handleNameChange} required error={showValidation && nameInvalid ? "Enter a full name." : undefined} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DriverInput id="driver-code" label="Driver code *" value={code} onChange={value => setCode(value.toUpperCase())} maxLength={2} required error={isCodeTaken ? "This code is already in use." : showValidation && codeInvalid ? "Use two letters, e.g. JD." : undefined} />
          <DriverInput id="driver-phone" label="Phone" type="tel" value={phone} onChange={setPhone} />
        </div>
        <DriverInput id="driver-email" label="Email address *" type="email" value={email} onChange={setEmail} required error={showValidation && emailInvalid ? "Enter a valid email address." : undefined} />
      </fieldset>
      <fieldset className="space-y-4 border-t border-admin-line pt-4"><legend className="text-sm font-semibold text-admin-ink pt-4">Vehicle & tracker</legend>
        <DriverInput id="driver-vehicle" label="Vehicle registration" value={vehicleReg} onChange={value => setVehicleReg(value.toUpperCase())} />
        <label htmlFor="driver-tracker" className="block text-sm font-medium text-admin-ink">Tracker</label>
        <select id="driver-tracker" value={imei} onChange={event => setImei(event.target.value)} className="w-full h-11 px-3 rounded-card border border-admin-line bg-white text-sm">
          <option value="">Not assigned</option>
          {imei && !devices.some(d => d.imei === imei) && <option value={imei}>Current tracker (not reporting)</option>}
          {devices.map(d => <option key={d.imei} value={d.imei}>{d.plateNumber || d.name}{d.plateNumber && d.name !== d.plateNumber ? ` (${d.name})` : ""}</option>)}
        </select>
        <p className="text-xs text-admin-muted">Choose the tracker assigned to this driver's vehicle. Existing assignments are kept if a tracker is offline.</p>
      </fieldset>
      <fieldset className="space-y-4 border-t border-admin-line pt-4"><legend className="text-sm font-semibold text-admin-ink pt-4">App access</legend>
        <DriverInput id="driver-password" label="App password" type="password" value={pwaPassword} onChange={setPwaPassword} error={passwordTooShort ? "Use at least 8 characters." : undefined} />
        <p className="text-xs text-admin-muted">{driverToEdit ? "Leave blank to keep the current password." : "Optional. Set a password of at least 8 characters for the driver app."}</p>
        <label className="flex items-start gap-3 rounded-card border border-admin-line bg-admin-surface p-4"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} className="w-5 h-5 mt-0.5" /><span><span className="block text-sm font-medium text-admin-ink">Account active</span><span className="block text-xs text-admin-muted mt-1">App access enabled. This does not indicate that the driver is online or available.</span></span></label>
      </fieldset>
      <button type="submit" className="sr-only" tabIndex={-1}>Save driver</button>
    </form>
  </Modal>;
}

function DriverInput({ id, label, value, onChange, type = "text", required, maxLength, error }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; maxLength?: number; error?: string }) {
  return <div><label htmlFor={id} className="block text-sm font-medium text-admin-ink mb-1.5">{label}</label><input id={id} type={type} value={value} onChange={event => onChange(event.target.value)} required={required} maxLength={maxLength} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} autoComplete={type === "password" ? "new-password" : undefined} className={`h-11 px-3 w-full rounded-card border text-sm bg-white ${error ? "border-admin-status-red" : "border-admin-line"}`} />{error && <p id={`${id}-error`} className="text-xs text-admin-status-red mt-1">{error}</p>}</div>;
}
