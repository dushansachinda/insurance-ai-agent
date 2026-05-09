import React from "react";
import { ApplicationStatus, ClaimStatus, PolicyStatus } from "../types";

type AnyStatus = ApplicationStatus | ClaimStatus | PolicyStatus;

const STATUS_STYLES: Record<string, string> = {
  // application
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  declined: "bg-rose-50 text-rose-700 border-rose-200",
  needs_review: "bg-sky-50 text-sky-700 border-sky-200",
  // policy
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200",
  expired: "bg-slate-100 text-slate-600 border-slate-200",
  // claim
  filed: "bg-amber-50 text-amber-700 border-amber-200",
  under_review: "bg-sky-50 text-sky-700 border-sky-200",
  denied: "bg-rose-50 text-rose-700 border-rose-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const ApplicationStatusBadge: React.FC<{ status: AnyStatus }> = ({
  status,
}) => {
  const style =
    STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600 border-slate-200";
  const label = status.replace(/_/g, " ");
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${style}`}
    >
      {label}
    </span>
  );
};

export default ApplicationStatusBadge;
