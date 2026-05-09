import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import api from "../api/client";
import { Application } from "../types";
import ApplicationStatusBadge from "../components/ApplicationStatusBadge";

const ApplicationDetailPage: React.FC = () => {
  const { applicationId = "" } = useParams<{ applicationId: string }>();
  const [application, setApplication] = useState<Application | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setApplication(null);
    setError(null);
    if (!applicationId) return;
    api
      .getApplication(applicationId)
      .then((data) => {
        if (!cancelled) setApplication(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load application."
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to="/policies"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to policies
      </Link>

      {!application && !error && (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading application...
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {application && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Application
              </div>
              <h1 className="text-2xl font-semibold text-slate-900 mt-1 font-mono">
                {application.application_id}
              </h1>
              <div className="text-sm text-slate-500 mt-1">
                Submitted {application.submitted_at}
              </div>
            </div>
            <ApplicationStatusBadge status={application.status} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500 uppercase">Vehicle</div>
              <div className="mt-1 font-medium">
                {application.vehicle.year} {application.vehicle.make}{" "}
                {application.vehicle.model}
              </div>
              <div className="text-xs text-slate-500 font-mono mt-1">
                VIN {application.vehicle.vin}
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500 uppercase">
                Coverage requested
              </div>
              <div className="mt-1 font-medium capitalize">
                {application.requested_coverage}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Deductible $
                {application.requested_deductible.toLocaleString()}
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500 uppercase">
                Quoted premium
              </div>
              <div className="mt-1 font-medium">
                {application.quoted_premium_monthly !== null &&
                application.quoted_premium_monthly !== undefined
                  ? `$${application.quoted_premium_monthly.toFixed(2)} / month`
                  : "Pending"}
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500 uppercase">
                Decision reason
              </div>
              <div className="mt-1 text-slate-700">
                {application.decision_reason ?? "No decision yet."}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 uppercase mb-2">
              Drivers
            </div>
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              {application.drivers.map((d) => (
                <div
                  key={d.license_number}
                  className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm"
                >
                  <span className="font-medium">{d.name}</span>
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
      )}
    </div>
  );
};

export default ApplicationDetailPage;
