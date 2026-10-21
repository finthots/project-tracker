/** Backend emits naive UTC strings ("2026-05-25T00:00:00" with no zone).
 *  Browsers parse a zone-less datetime as LOCAL time, which shifts overdue/
 *  deadline math by the user's UTC offset (e.g. +5:30 in IST → off-by-one day).
 *  Append "Z" so it is parsed as UTC, matching the backend's now_utc() logic. */
function parseUTC(val: string): Date {
  // date-only strings are already UTC-midnight per spec; only patch full datetimes
  const needsZ = val.includes("T") && !/[zZ]|[+-]\d\d:\d\d$/.test(val);
  return new Date(needsZ ? val + "Z" : val);
}

import type { ProjectStatus, TaskStatus, TaskPriority, MilestoneStatus, Venture } from "@/api/types";

export const projectStatusColor: Record<ProjectStatus, string> = {
  Planning: "secondary",
  Active: "success",
  "On Hold": "warning",
  Completed: "info",
  Cancelled: "danger",
} as const;

export const taskStatusColor: Record<TaskStatus, string> = {
  "Not Started": "secondary",
  "In Progress": "default",
  Blocked: "danger",
  Review: "warning",
  Done: "success",
} as const;

export const priorityColor: Record<TaskPriority, string> = {
  Low: "secondary",
  Medium: "default",
  High: "warning",
  Critical: "danger",
} as const;

export const milestoneStatusColor: Record<MilestoneStatus, string> = {
  Pending: "secondary",
  Hit: "success",
  Missed: "danger",
  Shared: "warning",
  "Signed off": "info",
} as const;

export const ventureColor: Record<Venture, string> = {
  Finthots: "bg-blue-100 text-blue-800",
  Sunyukth: "bg-green-100 text-green-800",
  Personal: "bg-purple-100 text-purple-800",
} as const;

export function daysToDeadline(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = parseUTC(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** Format a backend datetime string ("2026-05-25T00:00:00") as "25 May 2026" */
export function formatDate(val?: string | null): string {
  if (!val) return "—";
  const d = parseUTC(val);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Strip time component so "<input type=date>" receives "2026-05-25" not "2026-05-25T00:00:00" */
export function toDateInput(val?: string | null): string {
  if (!val) return "";
  return val.split("T")[0];
}

export function deadlineClass(days: number | null): string {
  if (days === null) return "";
  if (days < 0) return "text-red-600 font-medium";
  if (days <= 7) return "text-amber-600 font-medium";
  return "text-gray-500";
}
