/** TMV Aurora's authenticated operations workspace. Existing section IDs,
 * keyboard shortcuts, sidebar preference, and operational actions are preserved. */
import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Navigation,
  Truck,
  CheckSquare,
  LogOut,
  Users,
  RefreshCw,
  Trash2,
  ClipboardList,
  FileWarning,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  Command,
  Bell,
  Menu,
  X,
  Settings,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { triggerDatasetRefresh } from "./api";
import { fetchAdminProfile } from "../../../api/admin";
import { CommandPalette } from "./components/CommandPalette";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { ApiSettingsPage } from "./pages/ApiSettingsPage";
import "./dashboard.css";
import "./aurora.css";
import { useDashboardTheme, type DashboardThemePreference } from "./hooks/useDashboardTheme";
import { useOperationalAttention } from "./utils/useOperationalAttention";
import { PageHeader } from "./components/OperationsUI";
import { Modal } from "../../../ui/Modal";

interface Props {
  activeSection: string;
  onSelectSection: (id: string) => void;
  onLogout?: () => void;
  children: React.ReactNode;
}

interface NavItem {
  id?: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  desc?: string;
}

const NAV_CONFIG: NavItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    desc: "Today's work and items needing attention",
  },
  {
    id: "jobs",
    label: "Jobs",
    icon: ClipboardList,
    desc: "Bookings, job details and workflow",
  },
  {
    id: "drivers",
    label: "Drivers",
    icon: Users,
    desc: "Directory and performance reports",
  },
  {
    id: "livefleet",
    label: "Live Fleet",
    icon: Navigation,
    desc: "Vehicle locations and signal freshness",
  },
  {
    id: "van",
    label: "Vehicles",
    icon: Truck,
    desc: "Vehicle records, service and expiry dates",
  },
  {
    id: "liabilities",
    label: "Evidence & Liability",
    icon: FileWarning,
    desc: "Check-in, checkout, parking and incidents",
  },
  {
    id: "notifications",
    label: "Alerts",
    icon: Bell,
    desc: "Operational attention and delivery log",
  },
  {
    id: "configurations",
    label: "Settings",
    icon: Settings,
    desc: "Pricing, message templates and device preferences",
  },
];

const NAV_GROUPS = [
  { label: "Operations", ids: ["overview", "jobs", "livefleet"] },
  { label: "Fleet", ids: ["drivers", "van", "liabilities"] },
  { label: "Workspace", ids: ["notifications", "configurations"] },
];

/** Sections reachable without a sidebar entry (Data Maintenance, opened from the
 *  profile dropdown) still need a title/icon for the header bar -- looked up here
 *  after NAV_CONFIG comes up empty, instead of silently falling back to Overview's. */
const EXTRA_NAV_TITLES: Record<string, NavItem> = {
  maintenance: { id: "maintenance", label: "Data Maintenance", icon: Trash2 },
  finished: { id: "finished", label: "Finished Jobs", icon: CheckSquare },
  driverreport: { id: "driverreport", label: "Driver Report", icon: Users },
};

export function Layout({
  activeSection,
  onSelectSection,
  onLogout,
  children,
}: Props) {
  const theme = useDashboardTheme();
  const ThemeIcon = theme.preference === "system" ? Monitor : theme.resolved === "dark" ? Moon : Sun;
  const [headerDate, setHeaderDate] = useState(() => new Date());
  const [navTooltip, setNavTooltip] = useState<{ label: string; left: number; top: number; id: string } | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setHeaderDate(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const londonDate = new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London",
  }).format(headerDate);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("tmv:sidebar-collapsed") === "true",
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    localStorage.setItem("tmv:sidebar-collapsed", String(collapsed));
  }, [collapsed]);
  useEffect(() => {
    setMobileNavOpen(false);
  }, [activeSection]);
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches,
  );
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  const effectiveCollapsed = collapsed && !isMobile;
  const activeNavSection = ["pricing", "messaging", "settings"].includes(
    activeSection,
  )
    ? "configurations"
    : activeSection === "alerts"
      ? "notifications"
      : activeSection === "driverreport"
        ? "drivers"
        : activeSection === "finished"
          ? "jobs"
          : ["checkin", "checkout", "parking", "liability"].includes(
                activeSection,
              )
            ? "liabilities"
            : activeSection;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const attention = useOperationalAttention();

  const { data: adminProfile } = useQuery({
    queryKey: ["admin_profile"],
    queryFn: fetchAdminProfile,
    staleTime: Infinity,
  });

  // Click-outside + Escape close the profile dropdown, same pattern the mobile nav
  // drawer already uses below.
  useEffect(() => {
    if (!profileOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setProfileOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setProfileOpen(false);
        profileButtonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [profileOpen]);

  // Mobile nav drawer: Escape closes it, and the page behind it stops scrolling.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const opener = document.activeElement as HTMLElement;
    requestAnimationFrame(() =>
      navRef.current
        ?.querySelector<HTMLElement>("button:not(.hidden)")
        ?.focus(),
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMobileNavOpen(false);
      }
      if (e.key === "Tab") {
        const buttons = Array.from(
          navRef.current?.querySelectorAll<HTMLElement>("button,a[href]") || [],
        ).filter((element) => element.getClientRects().length > 0);
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [mobileNavOpen]);

  const refreshMutation = useMutation({
    mutationFn: triggerDatasetRefresh,
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        if (e.key.toLowerCase() === "k") {
          e.preventDefault();
          setPaletteOpen((prev) => !prev);
        }
        return;
      }
      if (e.altKey) return;

      if (paletteOpen || shortcutsOpen) return;

      switch (e.key.toLowerCase()) {
        case "?":
          e.preventDefault();
          setShortcutsOpen((prev) => !prev);
          break;
        case "r":
          e.preventDefault();
          refreshMutation.mutate();
          break;
        case "o":
          onSelectSection("overview");
          break;
        case "j":
          onSelectSection("jobs");
          break;
        case "d":
          onSelectSection("drivers");
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSelectSection, refreshMutation, paletteOpen, shortcutsOpen]);

  const currentNav =
    NAV_CONFIG.find(
      (n) =>
        n.id ===
        (["pricing", "messaging", "settings"].includes(activeSection)
          ? "configurations"
          : activeSection === "alerts"
            ? "notifications"
            : activeSection),
    ) ||
    EXTRA_NAV_TITLES[activeSection] ||
    NAV_CONFIG[0];

  return (
    <div className="ops-shell flex min-h-screen bg-admin-bg text-admin-ink selection:bg-admin-brand-soft selection:text-admin-brand font-sans antialiased">
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside
        aria-label="Main navigation"
        aria-hidden={isMobile && !mobileNavOpen}
        role={isMobile && mobileNavOpen ? "dialog" : undefined}
        aria-modal={isMobile && mobileNavOpen ? true : undefined}
        ref={(element) => {
          navRef.current = element;
          if (isMobile && !mobileNavOpen) element?.setAttribute("inert", "");
          else element?.removeAttribute("inert");
        }}
        className={`ops-sidebar bg-white border-r border-admin-line text-admin-ink flex flex-col justify-between transition-all duration-300 z-40 fixed inset-y-0 left-0 h-screen md:sticky md:top-0 md:z-30 w-[224px] ${
          collapsed ? "md:w-20" : "md:w-[224px]"
        } ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        <div className="flex flex-col min-h-0">
          <div
            className={`pt-5 pb-4 flex items-center bg-transparent ${effectiveCollapsed ? "px-3 flex-col gap-3" : "px-4 justify-between"}`}
          >
            <div className={`aurora-brand ${effectiveCollapsed ? "flex-col" : ""}`}>
              <img src="/tmv-logo.png" alt="" className="aurora-brand-mark" />
              {!effectiveCollapsed && <div className="aurora-brand-copy">
                <div className="aurora-brand-name">The Man Van</div>
                <div className="aurora-brand-subtitle">Operations</div>
              </div>}
            </div>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="aurora-sidebar-toggle hidden md:flex w-7 h-7 shrink-0 items-center justify-center transition"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <ChevronRight className="w-5 h-5 shrink-0" />
              ) : (
                <ChevronLeft className="w-5 h-5 shrink-0" />
              )}
            </button>
            <button
              onClick={() => setMobileNavOpen(false)}
              className="aurora-sidebar-toggle md:hidden w-8 h-8 flex items-center justify-center transition"
              aria-label="Close navigation"
              title="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className={`${effectiveCollapsed ? "px-3 pt-4" : "px-4"} pb-4 overflow-y-auto flex-1 custom-scrollbar`}>
            {NAV_GROUPS.map(group => <div key={group.label} className={effectiveCollapsed ? "mb-3 space-y-1" : "space-y-1"}>
              {!effectiveCollapsed && <div className="ops-nav-caption">{group.label}</div>}
              {group.ids.map(id => {
                const navItem = NAV_CONFIG.find(item => item.id === id)!;
                const Icon = navItem.icon!;
                const isActive = activeNavSection === navItem.id;
                const showTooltip = (event: React.SyntheticEvent<HTMLButtonElement>) => {
                  if (!effectiveCollapsed) return;
                  const bounds = event.currentTarget.getBoundingClientRect();
                  setNavTooltip({ label: navItem.label, id, left: bounds.right + 18, top: bounds.top + 4 });
                };
                return <button key={id} type="button"
                  onClick={() => { onSelectSection(id); setMobileNavOpen(false); setNavTooltip(null); }}
                  onMouseEnter={showTooltip} onMouseLeave={() => setNavTooltip(null)}
                  onFocus={showTooltip} onBlur={() => setNavTooltip(null)}
                  aria-label={navItem.label} aria-current={isActive ? "page" : undefined}
                  aria-describedby={navTooltip?.id === id ? "aurora-nav-tooltip" : undefined}
                  className={`aurora-nav-button w-full flex items-center font-medium transition ${effectiveCollapsed ? "justify-center p-0" : "gap-2.5 px-2.5"}`}
                  title={navItem.label}>
                  <span className="aurora-nav-icon"><Icon className="w-[18px] h-[18px]" aria-hidden="true" /></span>
                  {!effectiveCollapsed && <span className="text-left leading-[18px] whitespace-normal">{navItem.label}</span>}
                </button>;
              })}
            </div>)}
          </nav>
        </div>
        {!effectiveCollapsed && (
          <div className="ops-sidebar-footer">
            <div className="aurora-sidebar-footer-label">
              <span className="aurora-sidebar-footer-dot" aria-hidden="true" />
              TMV Operations
            </div>
            <p className="mt-2">London · Europe/London</p>
          </div>
        )}
      </aside>

      {navTooltip && effectiveCollapsed && <div id="aurora-nav-tooltip" role="tooltip" className="aurora-nav-tooltip" style={{ left: navTooltip.left, top: navTooltip.top }}>{navTooltip.label}</div>}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="aurora-header border-b px-3 md:px-6 flex items-center justify-between gap-3 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              ref={menuButtonRef}
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden w-10 h-10 -ml-1 shrink-0 rounded-full hover:bg-admin-surface flex items-center justify-center text-admin-muted hover:text-admin-ink transition"
              title="Open menu"
              aria-label="Open navigation menu"
              aria-expanded={mobileNavOpen}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="aurora-header-context">
              <span className="aurora-header-eyebrow">Operations workspace</span>
              <span className="aurora-header-page">{currentNav.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="aurora-command-search relative hidden lg:flex items-center pl-9 pr-3 text-[13px] text-admin-muted transition text-left"
            >
              <Search
                className="w-4 h-4 text-admin-muted absolute left-3 pointer-events-none"
                aria-hidden
              />
              Jump to page
              <kbd className="ml-auto text-[11px] font-sans font-medium text-admin-muted bg-white border border-admin-line rounded px-1.5 py-0.5">
                {/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K"}
              </kbd>
            </button>
            <button
              onClick={() => setPaletteOpen(true)}
              className="lg:hidden w-9 h-9 rounded-full hover:bg-admin-surface flex items-center justify-center text-admin-muted hover:text-admin-ink transition"
              aria-label="Jump to page"
              title="Jump to page"
            >
              <Search className="w-4 h-4" />
            </button>
            <div className="aurora-header-date" title="Current date in Europe/London">
              {londonDate}<span>London · Europe/London</span>
            </div>
            <label className="aurora-theme-control" title="Dashboard theme">
              <ThemeIcon className="w-4 h-4" aria-hidden="true" />
              <select className="aurora-theme-select" aria-label="Dashboard theme" value={theme.preference}
                onChange={event => theme.setPreference(event.target.value as DashboardThemePreference)}>
                <option value="light">Light</option>
                <option value="dark">Midnight</option>
                <option value="system">System</option>
              </select>
              <ChevronDown className="aurora-theme-chevron w-3 h-3" aria-hidden="true" />
            </label>
            <button
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              className="aurora-header-action aurora-mobile-refresh w-9 h-9 hover:bg-admin-surface flex items-center justify-center text-admin-muted hover:text-admin-ink transition"
              aria-label="Refresh data"
              title="Refresh data (R)"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshMutation.isPending ? "animate-spin text-admin-brand" : "text-admin-muted"}`}
              />
            </button>
            <button
              onClick={() => setShortcutsOpen(true)}
              className="hidden md:flex w-9 h-9 rounded-full hover:bg-admin-surface items-center justify-center text-admin-muted hover:text-admin-ink transition"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
            >
              <Command className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onSelectSection("notifications")}
              className="relative w-10 h-10 rounded-lg hover:bg-admin-surface flex items-center justify-center text-admin-ink-2"
              aria-label={`Open operational alerts${attention.items.length ? `, ${attention.items.length} recorded feed issues` : attention.errors.length ? ", feed unavailable" : ""}`}
            >
              <Bell className="w-5 h-5" />
              {attention.items.length > 0 && (
                <span className="absolute top-0 right-0 text-[11px] min-w-4 h-4 px-1 bg-admin-status-red text-white rounded-full">
                  {attention.items.length}
                </span>
              )}
            </button>

            <div className="relative" ref={profileRef}>
              <button
                ref={profileButtonRef}
                onClick={() => setProfileOpen((prev) => !prev)}
                className="flex items-center gap-1 rounded-full hover:bg-admin-surface p-0.5 pr-1.5 transition"
                title="Account"
                aria-label="Account menu"
                aria-expanded={profileOpen}
              >
                <span className="aurora-account-avatar" aria-hidden="true">AD</span>
                <ChevronDown
                  className={`aurora-account-chevron w-3.5 h-3.5 text-admin-muted transition-transform ${profileOpen ? "rotate-180" : ""}`}
                />
              </button>

              {profileOpen && (
                <div className="aurora-account-menu absolute right-0 top-full mt-3 w-64 border border-admin-line rounded-card overflow-hidden z-30">
                  <div className="px-4 py-3 border-b border-admin-line">
                    <div className="text-[13px] font-semibold text-admin-ink truncate">
                      Administrator
                    </div>
                    <div className="text-[12px] text-admin-muted truncate">
                      {adminProfile?.email || "—"}
                    </div>
                  </div>
                  <div className="p-1.5">
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        setSettingsOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-card text-[13px] font-medium text-admin-ink-2 hover:bg-admin-surface transition text-left"
                    >
                      <Settings className="w-4 h-4 text-admin-muted" /> Account
                      settings
                    </button>
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        onSelectSection("maintenance");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-card text-[13px] font-medium text-admin-status-red hover:bg-admin-status-red-bg transition text-left"
                    >
                      <Trash2 className="w-4 h-4" /> Data Maintenance
                    </button>
                    {onLogout && (
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-card text-[13px] font-medium text-admin-status-red hover:bg-admin-status-red-bg transition text-left"
                      >
                        <LogOut className="w-4 h-4" /> Log out
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto flex flex-col custom-scrollbar">
          <a
            href="#operations-content"
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3"
          >
            Skip to content
          </a>
          <main id="operations-content" className="flex-1 p-4 md:p-7">
            {[
              "drivers",
              "van",
              "liabilities",
              "notifications",
              "configurations",
              "maintenance",
            ].includes(activeSection) && (
              <div className="mb-5 max-w-[1440px] mx-auto">
                <PageHeader title={currentNav.label} />
              </div>
            )}
            {children}
          </main>
        </div>
      </div>

      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelectSection={onSelectSection}
        onRefreshData={() => refreshMutation.mutate()}
      />
      <ShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Account settings"
        size="lg"
        placement="center"
      >
        <ApiSettingsPage />
      </Modal>
    </div>
  );
}
