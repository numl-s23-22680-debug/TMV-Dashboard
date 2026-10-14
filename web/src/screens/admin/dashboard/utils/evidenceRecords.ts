export function scenarioJobId(item: Record<string, any>): string | null {
  const raw = item.rawRecord || item;
  const value = item.jobId || raw["Job ID"];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
export function scenarioSignatureStatus(item: Record<string, any>): "Signed" | "Not recorded" | "Not required" {
  const raw = item.rawRecord || item;
  if (item.signature?.url || item.signature?.thumbUrl || item.signature?.fileId || item.signatureUrl || raw["Signature Url"]) return "Signed";
  if (item.signatureRequired === false) return "Not required";
  return "Not recorded";
}
/** Do not promote a submitted incident into a verified/resolved decision. */
export function scenarioReviewStatus(item: Record<string, any>, kind: string): string {
  const state = item.reviewStatus || item.managerReviewStatus;
  return typeof state === "string" && state.trim() ? state : kind === "liability" ? "Reported · review not recorded" : "Review not recorded";
}
