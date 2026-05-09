import React from "react";
import { NavLink } from "react-router-dom";
import { Shield } from "lucide-react";
import { DEMO_CUSTOMERS } from "../config";
import { useDemoCustomer } from "../contexts/DemoCustomerContext";

const navItems = [
  { to: "/", label: "Home", end: true },
  { to: "/policies", label: "Policies" },
  { to: "/apply", label: "Apply" },
  { to: "/claims", label: "Claims" },
  { to: "/kb", label: "Knowledge Base" },
];

const Header: React.FC = () => {
  const { customerId, setCustomerId } = useDemoCustomer();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        <NavLink to="/" className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-brand-600 text-white">
            <Shield className="w-5 h-5" />
          </span>
          <span className="font-semibold text-slate-900 text-lg tracking-tight">
            Demo Insurance Corp
          </span>
        </NavLink>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "text-brand-700 bg-brand-50"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <label
            htmlFor="demo-customer-select"
            className="text-xs text-slate-500 hidden sm:inline"
          >
            Demo customer
          </label>
          <select
            id="demo-customer-select"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          >
            {DEMO_CUSTOMERS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.id})
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
};

export default Header;
