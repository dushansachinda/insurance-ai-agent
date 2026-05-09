import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Car, Loader2, ShieldCheck, Users } from "lucide-react";
import api from "../api/client";
import { Policy } from "../types";
import ApplicationStatusBadge from "../components/ApplicationStatusBadge";

const PolicyDetailPage: React.FC = () => {
  const { policyId = "" } = useParams<{ policyId: string }>();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPolicy(null);
    setError(null);
    if (!policyId) return;
    api
      .getPolicy(policyId)
      .then((data) => {
        if (!cancelled) setPolicy(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load policy."
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [policyId]);

  return (
    <div>
      <Link
        to="/policies"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to policies
      </Link>

      {!policy && !error && (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading policy...
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {policy && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Policy
                </div>
                <h1 className="text-2xl font-semibold text-slate-900 mt-1 font-mono">
                  {policy.policy_id}
                </h1>
                <div className="text-sm text-slate-500 mt-1">
                  Effective {policy.effective_date} &middot; expires{" "}
                  {policy.expiration_date}
                </div>
              </div>
              <ApplicationStatusBadge status={policy.status} />
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <Car className="w-4 h-4 text-brand-600" /> Vehicle
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Year / Make / Model</span>
                  <span className="font-medium">
                    {policy.vehicle.year} {policy.vehicle.make}{" "}
                    {policy.vehicle.model}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">VIN</span>
                  <span className="font-mono">{policy.vehicle.vin}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <ShieldCheck className="w-4 h-4 text-brand-600" /> Coverage
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Coverage type</span>
                  <span className="font-medium capitalize">
                    {policy.coverage_type}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Deductible</span>
                  <span className="font-medium">
                    ${policy.deductible.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Monthly premium</span>
                  <span className="font-medium">
                    ${policy.premium_monthly.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 lg:col-span-2">
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <Users className="w-4 h-4 text-brand-600" /> Drivers
              </div>
              <div className="mt-4 divide-y divide-slate-100">
                {policy.drivers.map((d) => (
                  <div
                    key={d.license_number}
                    className="flex flex-wrap justify-between gap-3 py-3 text-sm"
                  >
                    <span className="font-medium text-slate-800">
                      {d.name}
                    </span>
                    <span className="text-slate-500 font-mono">
                      {d.license_number}
                    </span>
                    <span className="text-slate-500">
                      {d.years_licensed} years licensed
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PolicyDetailPage;
