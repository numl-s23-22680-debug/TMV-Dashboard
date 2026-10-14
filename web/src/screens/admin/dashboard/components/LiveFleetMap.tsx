/* Leaflet's stylesheet is imported here rather than in the app-wide index.css so it
   ships inside the lazily loaded admin chunk. It was previously global, meaning 45kB
   of map CSS was downloaded by every driver for a map only this page renders. */
import "leaflet/dist/leaflet.css";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import L from "leaflet";
import { useQuery } from "@tanstack/react-query";
import {
  Radio,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  WifiOff,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  RefreshCw
} from "lucide-react";
import { NormalizedJob } from "../types";
import { fetchCongestionZones, fetchLiveFleet } from "../api";
import { FLEET_TELEMETRY_POLICY, fleetTelemetry } from "../utils/fleetTelemetry";

interface Props {
  jobs: NormalizedJob[];
  onSelectJob?: (jobId: string) => void;
}

interface FleetVehicle {
  imei: string;
  name: string;
  plateNumber: string;
  driverInitials: string;
  driverName: string;
  matched: boolean;
  lat: number;
  lng: number;
  speedMph: number;
  lastUpdate: string;
  isStale: boolean;
  isMoving: boolean;
  currentJob: NormalizedJob | null;
  odometerMiles: number | null;
  ignitionOn: boolean | null;
  batteryVoltage: number | null;
  gpsSignalLevel: number | null;
  gsmSignalLevel: number | null;
  jammingDetected: boolean;
}

type FilterId = "ALL" | "MOVING" | "IDLE" | "STALE";

/** A never-blank short label for a van: the matched driver's initials, otherwise the
 *  first two alphanumerics of its plate / device name. Keeps "??" off every surface. */
function shortBadge(v: { matched: boolean; driverInitials: string; plateNumber: string; name: string }): string {
  if (v.matched && v.driverInitials) return v.driverInitials;
  const src = (v.plateNumber || v.name || "").replace(/[^A-Za-z0-9]/g, "");
  return src.slice(0, 2).toUpperCase() || "—";
}

function savedViewport(): { center: [number, number]; zoom: number } | null {
  try {
    const value = JSON.parse(sessionStorage.getItem("tmv:fleet-viewport") || "null");
    if (value && Array.isArray(value.center) && value.center.length === 2 && value.center.every(Number.isFinite) && Number.isFinite(value.zoom)) return value;
  } catch { /* session storage is optional */ }
  return null;
}

/** Bearing in degrees (0 = north) between two lat/lng points. Used to point the arrow
 *  marker the way a moving van is travelling (GPSLive's device list carries no
 *  heading field, so it's derived from consecutive fixes). */
function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (Math.atan2(y, x) * 180) / Math.PI;
}

const STATE_COLOR = {
  moving: "#16A34A",
  idle: "#DC2626",
  stale: "#64748B",
  selected: "#1B75BC"
} as const;

function vehState(v: FleetVehicle): keyof typeof STATE_COLOR {
  if (v.isStale) return "stale";
  if (v.isMoving) return "moving";
  return "idle";
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function LiveFleetMap({ jobs, onSelectJob }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const hasFitBoundsRef = useRef(!!savedViewport());
  const panelRef = useRef<HTMLDivElement>(null);
  const zonePolygonsRef = useRef<L.Polygon[]>([]);
  /** Last position + derived heading per device, so a moving van's arrow can point
   *  the right way between polls. */
  const trackRef = useRef<Record<string, { lat: number; lng: number; heading: number }>>({});
  /** Reverse-geocoded street address per device, filled lazily when a popup opens. */
  const addrRef = useRef<Record<string, string>>({});
  /** Which van's popup is open, so it survives the 10s marker rebuild. */
  const openPopupImeiRef = useRef<string | null>(new URLSearchParams(window.location.search).get("fleetVehicle"));
  const rebuildingRef = useRef(false);
  /** Parent passes a fresh onSelectJob each render -- hold it in a ref so the popup
   *  builder and marker effect don't churn every poll. */
  const onSelectJobRef = useRef(onSelectJob);
  useEffect(() => {
    onSelectJobRef.current = onSelectJob;
  }, [onSelectJob]);

  const [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("fleetVehicle"));
  const [activeFilter, setActiveFilter] = useState<FilterId>(() => { const filter = new URLSearchParams(window.location.search).get("fleetFilter"); return filter === "MOVING" || filter === "IDLE" || filter === "STALE" ? filter : "ALL"; });
  const [showCongestionZone, setShowCongestionZone] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(() => new URLSearchParams(window.location.search).get("fleetList") !== "hidden");
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get("fleetSearch") || "");
  const [clock, setClock] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("section") !== "livefleet") return;
    for (const [key, value] of [["fleetVehicle", selectedId], ["fleetFilter", activeFilter === "ALL" ? null : activeFilter], ["fleetSearch", search || null], ["fleetList", drawerOpen ? null : "hidden"]]) {
      if (value) url.searchParams.set(key!, value); else url.searchParams.delete(key!);
    }
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  }, [selectedId, activeFilter, search, drawerOpen]);
  useEffect(() => {
    if (!isFullscreen) return;
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
      if (event.key !== "Tab") return;
      const elements = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input,a[href],[tabindex="0"]');
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); opener?.focus(); };
  }, [isFullscreen]);

  const { data: fleetData, isLoading: fleetLoading, isError: fleetError, error, refetch, isFetching } = useQuery({
    queryKey: ["fleet_live"],
    queryFn: fetchLiveFleet,
    refetchInterval: 10000
  });

  const { data: zonesData, isFetched: zonesFetched, isError: zonesError } = useQuery({
    queryKey: ["congestion_zones"],
    queryFn: fetchCongestionZones,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000
  });

  const vehicles: FleetVehicle[] = useMemo(() => {
    return (fleetData?.vehicles || []).map(v => {
      const telemetry = fleetTelemetry(v.lastUpdate, v.speedMph);
      const matchingJobs = v.driverInitials ? jobs.filter(j => j.driverInitials === v.driverInitials && j.status === "IN_PROGRESS") : [];
      const currentJob = matchingJobs.length === 1 ? matchingJobs[0] : null;

      return {
        imei: v.imei,
        name: v.name,
        plateNumber: v.plateNumber,
        driverInitials: v.driverInitials || "",
        driverName: v.driverName || v.plateNumber || v.name || "Unidentified vehicle",
        matched: !!v.driverInitials,
        lat: v.lat,
        lng: v.lng,
        speedMph: v.speedMph,
        lastUpdate: v.lastUpdate,
        isStale: telemetry.stale,
        isMoving: telemetry.moving,
        currentJob,
        odometerMiles: v.odometerMiles,
        ignitionOn: v.ignitionOn,
        batteryVoltage: v.batteryVoltage,
        gpsSignalLevel: v.gpsSignalLevel,
        gsmSignalLevel: v.gsmSignalLevel,
        jammingDetected: v.jammingDetected
      };
    });
  }, [fleetData, jobs, clock]);

  // ---- 1. init map -------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const viewport = savedViewport();
    const map = L.map(mapContainerRef.current, {
      center: viewport?.center || [51.5074, -0.1278],
      zoom: viewport?.zoom || 11,
      zoomControl: false,
      attributionControl: false
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, subdomains: "abc" }).addTo(map);
    mapInstanceRef.current = map;
    const save = () => { try { const center = map.getCenter(); sessionStorage.setItem("tmv:fleet-viewport", JSON.stringify({ center: [center.lat, center.lng], zoom: map.getZoom() })); } catch { /* storage is optional */ } };
    map.on("moveend", save);
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Recalculate size when the container resizes (fullscreen toggle, drawer, etc.).
  useEffect(() => {
    const id = setTimeout(() => mapInstanceRef.current?.invalidateSize(), 250);
    return () => clearTimeout(id);
  }, [isFullscreen, drawerOpen]);

  // ---- 3. congestion zone polygons -----------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    zonePolygonsRef.current.forEach(p => map.removeLayer(p));
    zonePolygonsRef.current = [];
    if (!showCongestionZone) return;
    (zonesData?.zones || []).forEach(zone => {
      const polygon = L.polygon(zone.vertices, {
        color: "#DC2626",
        weight: 2,
        fillColor: "#DC2626",
        fillOpacity: 0.12
      }).addTo(map);
      polygon.bindTooltip(zone.zoneName, { permanent: true, direction: "center", className: "congestion-zone-label" });
      zonePolygonsRef.current.push(polygon);
    });
  }, [zonesData, showCongestionZone]);

  // ---- filtering ----------------------------------------------------------
  const visibleVehicles = useMemo(() => {
    let list = vehicles;
    if (activeFilter === "MOVING") list = list.filter(v => !v.isStale && v.isMoving);
    else if (activeFilter === "IDLE") list = list.filter(v => !v.isStale && !v.isMoving);
    else if (activeFilter === "STALE") list = list.filter(v => v.isStale);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        v =>
          v.plateNumber.toLowerCase().includes(q) ||
          v.name.toLowerCase().includes(q) ||
          v.driverName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [vehicles, activeFilter, search]);

  const movingCount = vehicles.filter(v => !v.isStale && v.isMoving).length;
  const staleCount = vehicles.filter(v => v.isStale).length;
  const unlinkedCount = vehicles.filter(v => !v.matched).length;
  const idleCount = vehicles.length - movingCount - staleCount;

  // ---- popup HTML ---------------------------------------------------------
  const popupHtml = useCallback((v: FleetVehicle): string => {
    const color = STATE_COLOR[vehState(v)];
    const addr = addrRef.current[v.imei];
    const telemetry = fleetTelemetry(v.lastUpdate, v.speedMph);
    const stateLabel = telemetry.motion;
    const g = (label: string, value: string) =>
      `<div class="vfm-cell"><span class="vfm-k">${esc(label)}</span><span class="vfm-v">${esc(value)}</span></div>`;

    const job = v.currentJob;
    const jobBlock = job
      ? `<div class="vfm-job">
           <div class="vfm-job-hd">Current job · ${esc(job.jobId)}</div>
           <div class="vfm-job-row"><b>A</b> ${esc(job.pickup || "—")}</div>
           <div class="vfm-job-row"><b>B</b> ${esc(job.dropoff || "—")}</div>
           <div class="vfm-job-cust">${esc(job.customerName || "")}</div>
           ${onSelectJobRef.current ? `<button class="vfm-btn" data-job="${esc(job.jobId)}">View current job</button>` : ""}
         </div>`
      : "";

    const unlinked = !v.matched
      ? `<div class="vfm-warn">Not linked to a driver. On the <b>Drivers</b> page set a driver's van
           registration to <b>${esc(v.plateNumber || v.name)}</b> to connect them.</div>`
      : "";

    return `
      <div class="vfm-pop">
        <div class="vfm-pop-hd">
          <span class="vfm-dot" style="background:${color}"></span>
          <span class="vfm-title">${esc(v.plateNumber || v.name)}</span>
          ${v.matched ? `<span class="vfm-init">${esc(v.driverInitials)}</span>` : `<span class="vfm-unlinked">Unlinked</span>`}
        </div>
        <div class="vfm-addr">${addr ? esc(addr) : "Locating…"}</div>
        <a class="vfm-maps" href="https://www.google.com/maps?q=${v.lat},${v.lng}" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
        ${unlinked}
        <div class="vfm-grid">
          ${g("State", stateLabel)}
          ${g("Speed", `${v.speedMph} mph`)}
          ${g("Last report", telemetry.age)}
          ${g("Freshness", telemetry.freshness)}
        </div>
        <div class="vfm-time">Driver: ${esc(v.matched ? v.driverName : "No driver")}</div>
        ${jobBlock}
        <details class="vfm-detail"><summary>Telemetry details</summary><div class="vfm-grid">
          ${g("Ignition", v.ignitionOn === null ? "Not reported" : v.ignitionOn ? "On" : "Off")}
          ${g("Battery", v.batteryVoltage === null ? "Not reported" : `${v.batteryVoltage}V`)}
          ${g("GPS / GSM", `${v.gpsSignalLevel ?? "—"} / ${v.gsmSignalLevel ?? "—"}`)}
          ${g("Mileage", v.odometerMiles === null ? "Not reported" : `${v.odometerMiles.toLocaleString()} mi`)}
        </div><div class="vfm-time">Position time: ${esc(v.lastUpdate)} UTC · Coordinates: ${v.lat.toFixed(5)}, ${v.lng.toFixed(5)}</div></details>
      </div>`;
  }, []);

  const refreshPopup = useCallback((v: FleetVehicle) => {
    const m = markersRef.current[v.imei];
    if (m?.isPopupOpen()) m.setPopupContent(popupHtml(v));
  }, [popupHtml]);

  /** Lazily reverse-geocode one van's position (Nominatim) and refresh its popup.
   *  Cached per device for the session; failures fall back to the coords line. */
  const geocode = useCallback(async (v: FleetVehicle) => {
    if (addrRef.current[v.imei]) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=0&lat=${v.lat}&lon=${v.lng}`,
        { headers: { "Accept-Language": "en-GB" } }
      );
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      addrRef.current[v.imei] = data.display_name || `${v.lat.toFixed(5)}, ${v.lng.toFixed(5)}`;
    } catch {
      addrRef.current[v.imei] = `${v.lat.toFixed(5)}, ${v.lng.toFixed(5)}`;
    }
    refreshPopup(v);
  }, [refreshPopup]);

  // ---- 4. markers -------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    rebuildingRef.current = true;
    Object.values(markersRef.current).forEach(m => map.removeLayer(m));
    markersRef.current = {};

    visibleVehicles.forEach(veh => {
      const isSelected = selectedId === veh.imei;
      const state = vehState(veh);
      const color = isSelected ? STATE_COLOR.selected : STATE_COLOR[state];

      // Derive heading from movement between polls.
      const prev = trackRef.current[veh.imei];
      let heading = prev?.heading ?? 0;
      if (prev && veh.isMoving && (Math.abs(prev.lat - veh.lat) > 1e-5 || Math.abs(prev.lng - veh.lng) > 1e-5)) {
        heading = bearing(prev, veh);
      }
      trackRef.current[veh.imei] = { lat: veh.lat, lng: veh.lng, heading };

      const plate = veh.matched ? `${veh.plateNumber || veh.name} · ${veh.driverInitials}` : veh.plateNumber || veh.name;
      const showArrow = veh.isMoving;

      const icon = L.divIcon({
        className: "vfm-marker-wrap",
        html: `
          <div class="vfm-marker" style="opacity:${veh.isStale && !isSelected ? 0.75 : 1}">
            <div class="vfm-plate" style="background:${isSelected ? STATE_COLOR.selected : "rgba(16,24,40,0.9)"}">${esc(plate)}</div>
            <div class="vfm-glyph" style="${isSelected ? "filter:drop-shadow(0 0 6px rgba(27,117,188,.9));" : ""}${showArrow ? `transform:rotate(${heading}deg);` : ""}">
              ${
                showArrow
                  ? `<svg width="30" height="30" viewBox="0 0 24 24"><path d="M12 2 L20 20 L12 15.5 L4 20 Z" fill="${color}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`
                  : `<svg width="26" height="26" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="${color}" stroke="#fff" stroke-width="2.4"/></svg>`
              }
            </div>
          </div>`,
        iconSize: [150, 60],
        iconAnchor: [75, showArrow ? 36 : 45]
      });

      const marker = L.marker([veh.lat, veh.lng], { icon })
        .addTo(map)
        .bindPopup(popupHtml(veh), { minWidth: 250, maxWidth: 300, className: "vfm-popup", autoPanPadding: [40, 40] });

      marker.on("click", () => setSelectedId(veh.imei));
      marker.on("popupopen", () => {
        openPopupImeiRef.current = veh.imei;
        void geocode(veh);
      });
      marker.on("popupclose", () => {
        if (!rebuildingRef.current) openPopupImeiRef.current = null;
      });
      markersRef.current[veh.imei] = marker;
    });

    // Re-open the popup that was open before this rebuild so a 10s refresh doesn't
    // dismiss the details the admin is reading.
    rebuildingRef.current = false;
    const keep = openPopupImeiRef.current;
    if (keep && markersRef.current[keep]) markersRef.current[keep].openPopup();

    // Fit once vehicles + the zone have both loaded, so central London (and the zone)
    // stay in frame even when the only live van is out in the suburbs.
    if (!hasFitBoundsRef.current && visibleVehicles.length > 0) {
      const pts: [number, number][] = visibleVehicles.map(v => [v.lat, v.lng] as [number, number]);
      const zoneVerts = showCongestionZone ? (zonesData?.zones || []).flatMap(z => z.vertices as [number, number][]) : [];
      zoneVerts.forEach(v => pts.push(v));
      map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 12 });
      if (!showCongestionZone || zoneVerts.length > 0 || zonesFetched) hasFitBoundsRef.current = true;
    }
  }, [visibleVehicles, selectedId, zonesData, showCongestionZone, zonesFetched, popupHtml, geocode]);

  // Delegate popup actions so geocoding or a telemetry refresh cannot replace the
  // button and silently detach its exact-record navigation listener.
  useEffect(() => {
    const element = mapContainerRef.current;
    if (!element) return;
    const handler = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-job]") : null;
      if (button?.dataset.job) onSelectJobRef.current?.(button.dataset.job);
    };
    element.addEventListener("click", handler);
    return () => element.removeEventListener("click", handler);
  }, []);

  const focusVehicle = (v: FleetVehicle) => {
    setSelectedId(v.imei);
    const map = mapInstanceRef.current;
    if (!map) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    map.flyTo([v.lat, v.lng], Math.max(map.getZoom(), 14), { animate: !reduced, duration: reduced ? 0 : 0.9 });
    setTimeout(() => markersRef.current[v.imei]?.openPopup(), reduced ? 0 : 950);
  };

  const fitAll = () => {
    const map = mapInstanceRef.current;
    if (!map || visibleVehicles.length === 0) return;
    const pts: [number, number][] = visibleVehicles.map(v => [v.lat, v.lng] as [number, number]);
    if (showCongestionZone) (zonesData?.zones || []).forEach(z => (z.vertices as [number, number][]).forEach(v => pts.push(v)));
    map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 13 });
  };

  return (
    <div
      ref={panelRef}
      role={isFullscreen ? "dialog" : undefined}
      aria-modal={isFullscreen || undefined}
      aria-label={isFullscreen ? "Fleet map" : undefined}
      tabIndex={isFullscreen ? -1 : undefined}
      className={`bg-white border border-admin-line rounded shadow-card overflow-hidden text-admin-ink transition-all ${
        isFullscreen ? "fixed inset-4 z-50 flex flex-col shadow-pop" : "relative"
      }`}
    >
      <style>{`
        .congestion-zone-label { background: rgba(16,24,40,.85); border: none; color: #fff;
          font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 600; padding: 2px 6px; box-shadow: none; }
        .congestion-zone-label::before { display: none; }
        .vfm-marker-wrap { background: none !important; border: none !important; }
        .vfm-marker { position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; }
        .vfm-plate { margin-bottom: 4px; padding: 4px 11px; border-radius: 8px; color: #fff;
          font-family: 'IBM Plex Mono', monospace; font-size: 14.5px; font-weight: 700; letter-spacing: .02em;
          white-space: nowrap; box-shadow: 0 2px 8px rgba(16,24,40,.4); }
        .vfm-glyph { line-height: 0; transition: transform .4s ease; }
        .vfm-popup .leaflet-popup-content-wrapper { border-radius: 12px; box-shadow: 0 12px 34px -10px rgba(16,24,40,.35); }
        .vfm-popup .leaflet-popup-content { margin: 0; width: 270px !important; }
        .vfm-pop { padding: 12px 13px; font-family: inherit; }
        .vfm-pop-hd { display: flex; align-items: center; gap: 7px; }
        .vfm-dot { width: 9px; height: 9px; border-radius: 999px; flex: none; }
        .vfm-title { font-weight: 800; font-size: 14px; color: #101828; }
        .vfm-init { margin-left: auto; font-family: 'IBM Plex Mono', monospace; font-weight: 700; font-size: 11px;
          background: #eef2ff; color: #1b75bc; padding: 1px 6px; border-radius: 5px; }
        .vfm-unlinked { margin-left: auto; font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .04em; background: #f1f5f9; color: #64748b; padding: 2px 6px; border-radius: 5px; }
        .vfm-addr { margin-top: 8px; font-size: 12px; line-height: 1.4; color: #334155; }
        .vfm-maps { display: inline-block; margin-top: 4px; font-size: 11px; font-weight: 600; color: #1b75bc; }
        .vfm-warn { margin-top: 8px; padding: 7px 8px; border-radius: 7px; background: #fffbeb; border: 1px solid #fde68a;
          font-size: 10.5px; line-height: 1.45; color: #92400e; }
        .vfm-grid { margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .vfm-cell { background: #f8fafc; border: 1px solid #eef2f6; border-radius: 7px; padding: 5px 7px; }
        .vfm-k { display: block; font-size: 9.5px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; }
        .vfm-v { display: block; font-size: 12px; font-weight: 700; color: #101828; margin-top: 1px; }
        .vfm-time { margin-top: 8px; font-size: 9.5px; color: #94a3b8; font-family: 'IBM Plex Mono', monospace; line-height: 1.5; }
        .vfm-detail { margin-top: 10px; font-size: 12px; color: #334155; }
        .vfm-detail summary { cursor: pointer; color: #1b75bc; font-weight: 600; }
        .vfm-k, .vfm-time, .vfm-job-hd { font-size: 12px; color: #475569; text-transform: none; }
        .vfm-job-row, .vfm-job-cust { font-size: 13px; }
        .vfm-btn { min-height: 40px; font-size: 13px; }
        .vfm-job { margin-top: 9px; padding: 8px; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 8px; }
        .vfm-job-hd { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; }
        .vfm-job-row { margin-top: 4px; font-size: 11px; color: #334155; }
        .vfm-job-row b { display: inline-block; width: 14px; height: 14px; line-height: 14px; text-align: center;
          border-radius: 999px; background: #e0edff; color: #1b75bc; font-size: 9px; margin-right: 5px; }
        .vfm-job-cust { margin-top: 5px; font-size: 11px; font-weight: 600; color: #101828; }
        .vfm-btn { margin-top: 7px; width: 100%; height: 28px; border: none; border-radius: 6px; cursor: pointer;
          background: #1b75bc; color: #fff; font-size: 11px; font-weight: 600; }
      `}</style>

      {/* toolbar */}
      <div className="p-3.5 border-b border-admin-line flex flex-wrap items-center gap-3 bg-white">
        <div className="flex items-center gap-2 shrink-0">
          <Radio className="h-4 w-4 text-admin-brand" aria-hidden="true" />
          <h2 className="text-base font-semibold text-admin-ink whitespace-nowrap">Vehicle monitoring</h2>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono shrink-0">
          <span className="flex items-center gap-1.5 text-admin-muted">
            {vehicles.length - staleCount} recent signals &bull; {staleCount} stale &bull; {vehicles.length} tracked
          </span>
          {unlinkedCount > 0 && (
            <span className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 font-medium text-amber-700">
              {unlinkedCount} unlinked
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
          <div className="flex items-center p-0.5 bg-admin-surface rounded border border-admin-line text-xs font-medium shrink-0">
            {(
              [
                { id: "ALL", label: `All (${vehicles.length})` },
                { id: "MOVING", label: `Moving (${movingCount})` },
                { id: "IDLE", label: `Stopped (${idleCount})` },
                { id: "STALE", label: `Stale (${staleCount})` }
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                aria-pressed={activeFilter === tab.id}
                className={`shrink-0 whitespace-nowrap px-2.5 py-2 rounded transition text-sm ${
                  activeFilter === tab.id ? "bg-white text-admin-ink shadow-card font-semibold" : "text-admin-muted hover:text-admin-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowCongestionZone(v => !v)}
            className={`shrink-0 px-2.5 py-1.5 rounded border text-xs font-medium transition ${
              showCongestionZone ? "bg-admin-brand-soft border-admin-brand/30 text-admin-brand" : "bg-admin-surface border-admin-line text-admin-muted"
            }`}
            title="Toggle London Congestion Charge zone"
            aria-pressed={showCongestionZone}
          >
            Congestion Zone
          </button>

          <button
            onClick={() => setIsFullscreen(v => !v)}
            className="shrink-0 p-1.5 rounded border border-admin-line bg-admin-surface hover:bg-admin-surface-2 text-admin-ink-2 transition"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button type="button" aria-label="Refresh vehicle positions" title="Refresh vehicle positions" disabled={isFetching} onClick={() => void refetch()} className="rounded border border-admin-line bg-admin-surface p-2 text-admin-ink-2"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="border-b border-admin-line bg-admin-surface px-4 py-3 text-sm text-admin-muted" role="status">
        Signals older than {FLEET_TELEMETRY_POLICY.staleAfterMinutes} minutes are stale. Motion is the last reported state; tracker age cannot confirm a vehicle is parked.
        {fleetData?.fetchedAt && <span className="ml-2 font-medium">Last refresh: {fleetTelemetry(fleetData.fetchedAt, 0).age.replace("Updated ", "")}</span>}
      </div>
      {fleetError && fleetData && <div role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Vehicle refresh failed. Last-known positions remain visible. <button className="font-semibold underline" onClick={() => void refetch()}>Retry</button></div>}
      {zonesError && <div role="status" className="border-b border-admin-line px-4 py-2 text-sm text-admin-muted">Congestion-zone boundaries could not be loaded. Vehicle positions remain available.</div>}

      {/* map */}
      <div className={`relative bg-admin-surface ${isFullscreen ? "flex-1 min-h-0" : "h-[600px] md:h-[560px]"}`}>
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

        {/* zoom controls */}
        <div className="absolute top-3 right-3 z-[500] flex flex-col gap-1.5 bg-white/95 backdrop-blur-xs p-1 rounded border border-admin-line shadow-card">
          <button onClick={() => mapInstanceRef.current?.zoomIn()} className="p-2 rounded hover:bg-admin-surface text-admin-ink transition" title="Zoom in" aria-label="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => mapInstanceRef.current?.zoomOut()} className="p-2 rounded hover:bg-admin-surface text-admin-ink transition" title="Zoom out" aria-label="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={fitAll} className="p-2 rounded hover:bg-admin-surface text-admin-ink transition" title="Fit fleet + zone" aria-label="Fit fleet and congestion zone">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <a className="absolute bottom-0 right-0 z-[500] bg-white px-2 py-1 text-xs text-admin-muted" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
        {/* marker legend */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 max-w-[calc(100%-24px)] bg-white/95 backdrop-blur-xs px-2.5 py-1.5 rounded border border-admin-line shadow-card text-[10px] font-medium text-admin-ink-2">
          {(
            [
              ["Moving", STATE_COLOR.moving],
              ["Stopped", STATE_COLOR.idle],
              ["Stale signal", STATE_COLOR.stale],
              ["Selected", STATE_COLOR.selected]
            ] as const
          ).map(([label, color]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border border-white shadow-[0_0_0_1px_rgba(16,24,40,0.15)]" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>

        {/* collapsed: hamburger */}
        {!drawerOpen && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="absolute top-3 left-3 z-[500] flex items-center gap-2 px-3 h-10 rounded-lg bg-white shadow-card border border-admin-line text-admin-ink text-xs font-semibold hover:bg-admin-surface transition"
            title="Show vehicle list"
            aria-label="Show vehicle list"
          >
            <PanelLeftOpen className="w-4 h-4" />
            {vehicles.length} vehicles
          </button>
        )}

        {/* expanded: vehicle list drawer */}
        {drawerOpen && (
          <div className="absolute left-3 right-3 bottom-3 max-h-[48%] md:top-3 md:right-auto md:max-h-none z-[500] md:w-[320px] max-w-[calc(100%-24px)] flex flex-col rounded-lg bg-white shadow-pop border border-admin-line overflow-hidden">
            <div className="relative flex items-center justify-between gap-2 px-3 h-11 border-b border-admin-line shrink-0">
              <span className="text-xs font-bold text-admin-ink">Vehicles ({visibleVehicles.length})</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded transition hover:bg-admin-surface text-admin-muted hover:text-admin-ink"
                title="Collapse list"
                aria-label="Collapse vehicle list"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>

            </div>

            <div className="px-2.5 py-2 border-b border-admin-line shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-admin-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search plate or driver..."
                  aria-label="Search vehicles by registration or driver"
                  className="w-full h-10 pl-8 pr-2 rounded bg-admin-surface border border-admin-line text-sm text-admin-ink placeholder:text-admin-muted outline-none focus:border-admin-brand"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {visibleVehicles.length === 0 && (
                <div className="p-4 text-center text-sm text-admin-muted"><p>No vehicles match these filters.</p><button className="mt-2 font-semibold text-admin-brand" onClick={() => { setSearch(""); setActiveFilter("ALL"); }}>Clear filters</button></div>
              )}
              {visibleVehicles.map(v => {
                const isSel = selectedId === v.imei;
                const color = STATE_COLOR[vehState(v)];
                const telemetry = fleetTelemetry(v.lastUpdate, v.speedMph);
                return (
                  <button
                    key={v.imei}
                    onClick={() => focusVehicle(v)}
                    aria-pressed={isSel}
                    className={`w-full text-left px-3 py-2.5 border-b border-admin-line/70 transition ${
                      isSel ? "bg-admin-brand-soft" : "hover:bg-admin-surface"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-admin-ink truncate">
                        {v.plateNumber || v.name}
                        {v.matched && <span className="text-admin-muted font-medium"> · {v.driverInitials}</span>}
                      </span>
                      <span className="ml-auto flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-mono text-admin-muted">{v.speedMph} mph</span>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-admin-muted">
                      Driver: {v.matched ? v.driverName : "No driver"}
                    </div>
                    <div className="mt-1 text-xs text-admin-ink-2">{telemetry.motion}</div>
                    <div className={`mt-1 text-sm font-semibold ${v.isStale ? "text-amber-800" : "text-admin-ink"}`}>
                      {telemetry.age} · {telemetry.freshness}
                    </div>
                    <div className="mt-1 text-xs text-admin-muted truncate">{v.currentJob ? `Current job: ${v.currentJob.jobId} · ${v.currentJob.customerName}` : jobs.filter(job => job.driverInitials === v.driverInitials && job.status === "IN_PROGRESS").length > 1 ? "Multiple active jobs; association needs review" : "No unique current job linked"}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* no data */}
        {vehicles.length === 0 && (
          <div className="absolute inset-0 z-[400] flex items-center justify-center bg-white/80 backdrop-blur-xs">
            <div className="text-center px-6">
              <WifiOff className="w-8 h-8 text-admin-muted mx-auto mb-2 opacity-50" />
              <p className="text-base font-semibold text-fg" role={fleetError ? "alert" : "status"}>{fleetLoading ? "Loading vehicle positions" : fleetError ? "Could not load vehicle positions" : "No vehicle positions returned"}</p>
              <p className="text-sm text-admin-muted mt-2">{fleetError ? error instanceof Error ? error.message : "GPSLive telemetry could not be loaded." : fleetLoading ? "Fetching the latest tracker signals." : "No position records are available from GPSLive. This does not establish vehicle availability."}</p>
              {!fleetLoading && <button className="mt-4 rounded-lg border border-admin-line bg-white px-4 py-2 text-sm font-semibold text-admin-brand" onClick={() => void refetch()}>Retry vehicle loading</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
