import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileWarning, Loader2, Plus } from "lucide-react";
import api from "../api/client";
import { Policy } from "../types";
import { useDemoCustomer } from "../contexts/DemoCustomerContext";
import PolicyCard from "../components/PolicyCard";

const PoliciesPage: React.FC = () => {
  const { customerId } = useDemoCustomer();
  const [policies, setPolicies] = useState<Policy[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPolicies(null);
    setError(null);
    api
      .listCustomerPolicies(customerId)
      .then((data) => {
        if (!cancelled) setPolicies(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load policies for this customer."
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My Policies</h1>
          <p className="text-sm text-slate-500 mt-1">
            Auto insurance policies for{" "}
            <span className="font-mono">{customerId}</span>
          </p>
        </div>
        <Link
          to="/apply"
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> New application
        </Link>
      </div>

      {policies === null && !error && (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading policies...
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-4 text-sm flex items-start gap-2">
          <FileWarning className="w-4 h-4 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {policies && policies.length === 0 && (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center">
          <p className="text-slate-700 font-medium">No policies yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Submit an application to get started.
          </p>
          <Link
            to="/apply"
            className="inline-flex items-center gap-2 mt-4 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Apply now
          </Link>
        </div>
      )}

      {policies && policies.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {policies.map((p) => (
            <PolicyCard key={p.policy_id} policy={p} />
          ))}
        </div>
      )}
    </div>
  );
};

export default PoliciesPage;
