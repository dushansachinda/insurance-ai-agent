import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import api from "../api/client";
import { Claim } from "../types";
import { useDemoCustomer } from "../contexts/DemoCustomerContext";
import ApplicationStatusBadge from "../components/ApplicationStatusBadge";

const ClaimsPage: React.FC = () => {
  const { customerId } = useDemoCustomer();
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setClaims(null);
    setError(null);
    api
      .listCustomerClaims(customerId)
      .then((data) => {
        if (!cancelled) setClaims(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load claims."
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Claims</h1>
      <p className="text-sm text-slate-500 mt-1 mb-6">
        Claims for <span className="font-mono">{customerId}</span>
      </p>

      {claims === null && !error && (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading claims...
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {claims && claims.length === 0 && (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center">
          <p className="text-slate-700 font-medium">No claims on file</p>
          <p className="text-sm text-slate-500 mt-1">
            Use the chat assistant to file a claim.
          </p>
        </div>
      )}

      {claims && claims.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-5 py-3">Claim</th>
                <th className="text-left px-5 py-3">Policy</th>
                <th className="text-left px-5 py-3">Incident</th>
                <th className="text-left px-5 py-3">Description</th>
                <th className="text-right px-5 py-3">Requested</th>
                <th className="text-right px-5 py-3">Approved</th>
                <th className="text-left px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {claims.map((c) => (
                <tr key={c.claim_id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono">{c.claim_id}</td>
                  <td className="px-5 py-3 font-mono">{c.policy_id}</td>
                  <td className="px-5 py-3">{c.incident_date}</td>
                  <td className="px-5 py-3 text-slate-700 max-w-md truncate">
                    {c.description}
                  </td>
                  <td className="px-5 py-3 text-right">
                    ${c.amount_requested.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {c.amount_approved !== null &&
                    c.amount_approved !== undefined
                      ? `$${c.amount_approved.toLocaleString()}`
                      : "-"}
                  </td>
                  <td className="px-5 py-3">
                    <ApplicationStatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ClaimsPage;
