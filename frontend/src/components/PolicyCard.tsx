import React from "react";
import { Link } from "react-router-dom";
import { Car } from "lucide-react";
import { Policy } from "../types";
import ApplicationStatusBadge from "./ApplicationStatusBadge";

const PolicyCard: React.FC<{ policy: Policy }> = ({ policy }) => {
  return (
    <Link
      to={`/policies/${policy.policy_id}`}
      className="block bg-white border border-slate-200 rounded-xl p-5 hover:border-brand-500 hover:shadow-sm transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">
              {policy.vehicle.year} {policy.vehicle.make} {policy.vehicle.model}
            </div>
            <div className="text-xs text-slate-500 font-mono">
              VIN: {policy.vehicle.vin}
            </div>
          </div>
        </div>
        <ApplicationStatusBadge status={policy.status} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-slate-500 text-xs">Coverage</div>
          <div className="font-medium capitalize">{policy.coverage_type}</div>
        </div>
        <div>
          <div className="text-slate-500 text-xs">Deductible</div>
          <div className="font-medium">
            ${policy.deductible.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-slate-500 text-xs">Monthly</div>
          <div className="font-medium">
            ${policy.premium_monthly.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-500">
        Policy {policy.policy_id} &middot; effective {policy.effective_date}
      </div>
    </Link>
  );
};

export default PolicyCard;
