import React from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Sparkles,
  FileText,
  ArrowRight,
  MessageSquare,
} from "lucide-react";

const features = [
  {
    icon: <ShieldCheck className="w-6 h-6" />,
    title: "Smart underwriting",
    description:
      "Get an instant quote and decision powered by AI underwriting that knows your driving history.",
  },
  {
    icon: <Sparkles className="w-6 h-6" />,
    title: "Conversational support",
    description:
      "Ask the Demo Insurance Corp agent anything: policy details, claim status, coverage questions.",
  },
  {
    icon: <FileText className="w-6 h-6" />,
    title: "Self-serve everything",
    description:
      "Apply for coverage, file claims and review documents without ever calling support.",
  },
];

const HomePage: React.FC = () => {
  return (
    <div className="space-y-16">
      <section className="bg-white border border-slate-200 rounded-2xl px-8 py-14 sm:px-14 sm:py-20 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(60% 60% at 80% 20%, rgba(99,102,241,0.18) 0%, rgba(255,255,255,0) 60%), radial-gradient(40% 60% at 0% 100%, rgba(79,70,229,0.10) 0%, rgba(255,255,255,0) 70%)",
          }}
        />
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-medium border border-brand-100">
            <Sparkles className="w-3.5 h-3.5" /> AI-assisted auto insurance
          </span>
          <h1 className="mt-5 text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 leading-tight">
            Insurance that thinks alongside you.
          </h1>
          <p className="mt-5 text-lg text-slate-600 leading-relaxed">
            Demo Insurance Corp combines a modern insurance backend with an AI agent
            that handles applications, claims and customer support end-to-end.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/apply"
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-3 rounded-lg font-medium transition"
            >
              Get a quote <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/policies"
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 px-5 py-3 rounded-lg font-medium transition"
            >
              View my policies
            </Link>
            <span className="ml-1 inline-flex items-center gap-2 text-sm text-slate-500">
              <MessageSquare className="w-4 h-4" /> Or click the agent button to
              chat
            </span>
          </div>
        </div>
      </section>

      <section>
        <div className="grid sm:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-sm transition"
            >
              <div className="w-11 h-11 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                {f.icon}
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
