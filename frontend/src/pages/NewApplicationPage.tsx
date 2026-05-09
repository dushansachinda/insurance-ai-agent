import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import api, { CreateApplicationPayload } from "../api/client";
import { useDemoCustomer } from "../contexts/DemoCustomerContext";

const COVERAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "liability", label: "Liability" },
  { value: "collision", label: "Collision" },
  { value: "comprehensive", label: "Comprehensive" },
  { value: "full", label: "Full coverage" },
];

const DEDUCTIBLE_OPTIONS = [250, 500, 1000, 2000];

const currentYear = new Date().getFullYear();

const NewApplicationPage: React.FC = () => {
  const { customerId } = useDemoCustomer();
  const navigate = useNavigate();

  const [vin, setVin] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState<number>(currentYear);
  const [driverName, setDriverName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [yearsLicensed, setYearsLicensed] = useState<number>(5);
  const [coverage, setCoverage] = useState<string>("full");
  const [deductible, setDeductible] = useState<number>(500);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload: CreateApplicationPayload = {
      customer_id: customerId,
      vehicle: { vin: vin.trim(), make: make.trim(), model: model.trim(), year },
      drivers: [
        {
          name: driverName.trim(),
          license_number: licenseNumber.trim(),
          years_licensed: yearsLicensed,
        },
      ],
      requested_coverage: coverage,
      requested_deductible: deductible,
    };
    try {
      const application = await api.createApplication(payload);
      navigate(`/applications/${application.application_id}`);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to submit application."
      );
      setSubmitting(false);
    }
  };

  const inputCls =
    "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500";
  const labelCls = "block text-xs font-medium text-slate-600";

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-900">
        New auto insurance application
      </h1>
      <p className="text-sm text-slate-500 mt-1 mb-6">
        Submitting as <span className="font-mono">{customerId}</span>
      </p>

      <form
        onSubmit={onSubmit}
        className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-8"
      >
        <section>
          <h2 className="font-medium text-slate-800">Vehicle</h2>
          <div className="grid sm:grid-cols-2 gap-4 mt-3">
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="vin">
                VIN
              </label>
              <input
                id="vin"
                required
                minLength={5}
                value={vin}
                onChange={(e) => setVin(e.target.value)}
                className={inputCls}
                placeholder="1HGCM82633A004352"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="make">
                Make
              </label>
              <input
                id="make"
                required
                value={make}
                onChange={(e) => setMake(e.target.value)}
                className={inputCls}
                placeholder="Toyota"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="model">
                Model
              </label>
              <input
                id="model"
                required
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={inputCls}
                placeholder="Camry"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="year">
                Year
              </label>
              <input
                id="year"
                type="number"
                required
                min={1980}
                max={currentYear + 1}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className={inputCls}
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-medium text-slate-800">Primary driver</h2>
          <div className="grid sm:grid-cols-2 gap-4 mt-3">
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="driverName">
                Full name
              </label>
              <input
                id="driverName"
                required
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className={inputCls}
                placeholder="Alice Johnson"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="license">
                License number
              </label>
              <input
                id="license"
                required
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                className={inputCls}
                placeholder="D1234567"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="years">
                Years licensed
              </label>
              <input
                id="years"
                type="number"
                required
                min={0}
                max={80}
                value={yearsLicensed}
                onChange={(e) => setYearsLicensed(Number(e.target.value))}
                className={inputCls}
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-medium text-slate-800">Coverage</h2>
          <div className="grid sm:grid-cols-2 gap-4 mt-3">
            <div>
              <label className={labelCls} htmlFor="coverage">
                Coverage type
              </label>
              <select
                id="coverage"
                value={coverage}
                onChange={(e) => setCoverage(e.target.value)}
                className={inputCls}
              >
                {COVERAGE_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="deductible">
                Deductible
              </label>
              <select
                id="deductible"
                value={deductible}
                onChange={(e) => setDeductible(Number(e.target.value))}
                className={inputCls}
              >
                {DEDUCTIBLE_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    ${d.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-lg font-medium"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Submitting..." : "Submit application"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewApplicationPage;
