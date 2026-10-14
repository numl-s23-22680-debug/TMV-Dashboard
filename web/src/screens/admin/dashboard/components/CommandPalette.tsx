import React, { useEffect, useRef, useState } from "react";
import {
  Search,
  LayoutDashboard,
  Truck,
  Users,
  Bell,
  Settings,
  ShieldAlert,
  Navigation,
  ArrowRight,
} from "lucide-react";
import { Modal } from "../../../../ui/Modal";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectSection: (id: string) => void;
  onRefreshData?: () => void;
  onExportCsv?: () => void;
}

export const PAGE_DESTINATIONS = [
  {
    label: "Overview",
    section: "overview",
    icon: LayoutDashboard,
    description: "Daily work and attention",
  },
  {
    label: "Jobs",
    section: "jobs",
    icon: Truck,
    description: "Search bookings and open a job",
  },
  {
    label: "Drivers",
    section: "drivers",
    icon: Users,
    description: "Directory and performance reports",
  },
  {
    label: "Live Fleet",
    section: "livefleet",
    icon: Navigation,
    description: "Locations and tracker freshness",
  },
  {
    label: "Vehicles",
    section: "van",
    icon: Truck,
    description: "Service, fuel and expiry dates",
  },
  {
    label: "Evidence & Liability",
    section: "liabilities",
    icon: ShieldAlert,
    description: "Check-in, checkout, parking and incidents",
  },
  {
    label: "Alerts",
    section: "notifications",
    icon: Bell,
    description: "Needs attention and delivery log",
  },
  {
    label: "Settings",
    section: "configurations",
    icon: Settings,
    description: "Pricing and message templates",
  },
];

export function CommandPalette({ isOpen, onClose, onSelectSection }: Props) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = PAGE_DESTINATIONS.filter((item) =>
    (item.label + " " + item.description)
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);
  function select(section: string) {
    onSelectSection(section);
    onClose();
  }
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Jump to page"
      size="lg"
      placement="center"
    >
      <p className="text-sm text-admin-ink-2 mb-4">
        Choose a workspace. Search for job IDs, customers and routes in Jobs.
      </p>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="absolute left-3 top-3 w-5 h-5 text-admin-ink-2"
        />
        <input
          ref={inputRef}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setSelectedIndex(0);
          }}
          placeholder="Find a page…"
          aria-label="Find a page"
          aria-controls="page-destinations"
          aria-activedescendant={
            filtered[selectedIndex]
              ? `page-${filtered[selectedIndex].section}`
              : undefined
          }
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setSelectedIndex((index) =>
                filtered.length
                  ? (index +
                      (event.key === "ArrowDown" ? 1 : filtered.length - 1)) %
                    filtered.length
                  : 0,
              );
            } else if (event.key === "Enter" && filtered[selectedIndex]) {
              event.preventDefault();
              select(filtered[selectedIndex].section);
            }
          }}
          className="w-full h-11 pl-11 pr-3 border border-admin-line rounded-lg bg-admin-surface"
        />
      </div>
      <div
        id="page-destinations"
        role="listbox"
        aria-label="Pages"
        className="mt-3 max-h-[50vh] overflow-y-auto space-y-1"
      >
        {filtered.length ? (
          filtered.map((item, index) => (
            <div
              role="option"
              aria-selected={index === selectedIndex}
              id={`page-${item.section}`}
              key={item.section}
            >
              <button
                type="button"
                onClick={() => select(item.section)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex items-center w-full gap-3 p-3 text-left rounded-lg ${index === selectedIndex ? "bg-admin-brand-soft" : "hover:bg-admin-surface"}`}
              >
                <item.icon
                  className="w-5 h-5 text-admin-brand shrink-0"
                  aria-hidden="true"
                />
                <span>
                  <span className="block text-sm font-semibold">
                    {item.label}
                  </span>
                  <span className="block text-xs text-admin-ink-2 mt-1">
                    {item.description}
                  </span>
                </span>
                <ArrowRight
                  className="ml-auto w-4 h-4 text-admin-ink-2"
                  aria-hidden="true"
                />
              </button>
            </div>
          ))
        ) : (
          <div role="status" className="py-9 text-center">
            <p className="font-semibold">No matching pages</p>
            <p className="text-sm text-admin-ink-2 mt-2">
              Try Jobs, Drivers, Vehicles or Settings.
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-admin-line mt-4 pt-3 text-xs text-admin-ink-2">
        <span>↑ ↓ to choose</span>
        <span>Enter to open</span>
        <span>Esc to close</span>
      </div>
    </Modal>
  );
}
