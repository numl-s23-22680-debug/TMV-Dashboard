import { ScenarioItem, VanDriverRecordItem, VanRecordItem } from "../types";
import { toCsv } from "./csv";
import { scenarioJobId, scenarioReviewStatus, scenarioSignatureStatus } from "./evidenceRecords";
import { evidencePhotoCount } from "./evidence";
import { formatLondonDateTime } from "./date";
import { vehicleDateStatus } from "./vehicleDates";

interface Scope { from?: string; to?: string; page: number; driver?: string; search?: string }
const scopeColumns = (scope: Scope, description: string) => [
  { header: "Export scope", value: () => description }, { header: "Page", value: () => scope.page },
  { header: "Range from", value: () => scope.from || "All recorded dates" }, { header: "Range to", value: () => scope.to || "All recorded dates" },
  { header: "Timezone", value: () => "Europe/London" }, { header: "Driver filter", value: () => scope.driver || "All drivers" }, { header: "Search", value: () => scope.search || "None" },
];
export function scenarioPageCsv(items: ScenarioItem[], kind: string, scope: Scope): string {
  return toCsv(items as Array<ScenarioItem & Record<string, any>>, [
    { header: "Record ID", value: row => row.id }, { header: "Evidence type", value: () => kind }, { header: "Job ID", value: row => scenarioJobId(row) || "Not recorded" },
    { header: "Customer", value: row => row.clientName || row.rawRecord?.["Client Name"] || row.rawRecord?.["Client Full Name"] || "Not recorded" },
    { header: "Driver", value: row => row.driverName || row.driver || row.rawRecord?.Driver || "Not recorded" },
    { header: "Event timestamp (source)", value: row => row.timestamp || row.rawRecord?.Timestamp || row.rawRecord?.Date || "Not recorded" },
    { header: "Event time (London)", value: row => formatLondonDateTime(row.timestamp || row.rawRecord?.Timestamp || row.rawRecord?.Date) },
    { header: "Photo count", value: row => evidencePhotoCount(row) ?? "Not recorded" }, { header: "Signature status", value: row => scenarioSignatureStatus(row) },
    { header: "Review state", value: row => scenarioReviewStatus(row, kind) },
    { header: "Coverage note", value: () => "Loaded filtered page only. Submission does not establish required-evidence completeness, verification or resolution." },
    ...scopeColumns(scope, "Filtered records on the current page"),
  ]);
}
export function vehiclePageCsv(items: VanDriverRecordItem[], page: number): string {
  return toCsv(items, [
    { header: "Registration", value: row => row.vanRegistration || "Not recorded" }, { header: "Assigned driver", value: row => row.driverName || "Not recorded" }, { header: "Driver code", value: row => row.driverInitials || "Not recorded" },
    { header: "MOT expiry", value: row => row.compliance?.motExpiryDate || "Not recorded" }, { header: "MOT date state", value: row => vehicleDateStatus(row.compliance?.motExpiryDate) },
    { header: "Tax renewal", value: row => row.compliance?.roadTaxRenewalDate || "Not recorded" }, { header: "Tax date state", value: row => vehicleDateStatus(row.compliance?.roadTaxRenewalDate) },
    { header: "Insurance expiry", value: row => row.compliance?.insuranceExpiryDate || "Not recorded" },
    { header: "Latest recorded odometer (miles)", value: row => row.compliance?.currentMileage ?? "Not recorded" },
    { header: "Configured service interval (miles)", value: row => row.compliance?.serviceIntervalMiles ?? "Not recorded" },
    { header: "Coverage note", value: () => "Current assignment snapshot, loaded page only. Recorded deadlines do not prove legal compliance." },
    ...scopeColumns({ page }, "Current vehicle assignments on the loaded page"),
  ]);
}
export function vehicleHistoryCsv(items: VanRecordItem[], registration: string, scope: Scope): string {
  return toCsv(items, [
    { header: "Vehicle registration", value: () => registration || "Not recorded" }, { header: "Record ID", value: row => row.id }, { header: "Record type", value: row => row.type },
    { header: "Submitted timestamp (source)", value: row => row.submittedAt }, { header: "Submitted time (London)", value: row => formatLondonDateTime(row.submittedAt) }, { header: "Recorded odometer (miles)", value: row => row.odometerReading ?? row.mileage ?? "Not recorded" },
    { header: "Recorded fuel cost (GBP)", value: row => row.fuelCost ?? "Not recorded" }, { header: "Service mileage", value: row => row.serviceMileage ?? "Not recorded" }, { header: "Service date", value: row => row.serviceDate || "Not recorded" },
    { header: "Evidence URL", value: row => row.photoUrl || "Not recorded" },
    { header: "Coverage note", value: () => "Records loaded for this assignment and date range. Missing uploads are not presumed to be required." },
    ...scopeColumns(scope, "Loaded vehicle records in the selected date range"),
  ]);
}
