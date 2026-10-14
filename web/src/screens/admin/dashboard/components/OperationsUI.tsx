import React from "react";
import { AlertCircle, CheckCircle2, Inbox, RefreshCw } from "lucide-react";

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="ops-page-heading">
      <div>
        {eyebrow && <p className="ops-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="ops-page-description">{description}</p>}
      </div>
      {actions && <div className="ops-page-actions">{actions}</div>}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = "blue",
  onClick,
  visualization,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "blue" | "green" | "violet" | "amber";
  onClick?: () => void;
  visualization?: React.ReactNode;
}) {
  const content = (
    <>
      <div className="ops-metric-top">
        <span>{label}</span>
        <span className={`ops-metric-icon ${tone}`}>{icon}</span>
      </div>
      <div className="ops-metric-value">{value}</div>
      <div className="ops-metric-detail">{detail}</div>
      {visualization && (
        <div className="ops-metric-visual" aria-hidden="true">
          {visualization}
        </div>
      )}
    </>
  );
  return onClick ? (
    <button
      type="button"
      className={`ops-metric ${tone}`}
      onClick={onClick}
      aria-label={`View ${label.toLowerCase()}`}
    >
      {content}
    </button>
  ) : (
    <div className={`ops-metric ${tone}`}>{content}</div>
  );
}

export function CoverageNotice({
  children,
  complete = false,
}: {
  children: React.ReactNode;
  complete?: boolean;
}) {
  const Icon = complete ? CheckCircle2 : AlertCircle;
  return (
    <div className={`ops-coverage ${complete ? "complete" : ""}`} role="status">
      <Icon size={17} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function DataState({
  kind,
  title,
  description,
  onRetry,
  action,
}: {
  kind: "loading" | "empty" | "error";
  title: string;
  description?: string;
  onRetry?: () => void;
  action?: React.ReactNode;
}) {
  const Icon =
    kind === "error" ? AlertCircle : kind === "loading" ? RefreshCw : Inbox;
  return (
    <div
      className={`ops-data-state ${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <Icon
        className={kind === "loading" ? "animate-spin" : ""}
        size={26}
        aria-hidden="true"
      />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {onRetry && (
        <button
          type="button"
          className="ops-button secondary"
          onClick={onRetry}
        >
          Try again
        </button>
      )}
      {action}
    </div>
  );
}
