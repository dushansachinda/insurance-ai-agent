import React, { ReactNode } from "react";
import Header from "./Header";
import ChatWidget from "./ChatWidget";

const Layout: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 text-xs text-slate-500 flex justify-between">
          <span>WSO2 InsureCo &middot; AI agent demo</span>
          <span>Not a real insurance product</span>
        </div>
      </footer>
      <ChatWidget />
    </div>
  );
};

export default Layout;
