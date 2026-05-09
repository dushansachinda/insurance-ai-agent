import React from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { DemoCustomerProvider } from "./contexts/DemoCustomerContext";
import HomePage from "./pages/HomePage";
import PoliciesPage from "./pages/PoliciesPage";
import PolicyDetailPage from "./pages/PolicyDetailPage";
import NewApplicationPage from "./pages/NewApplicationPage";
import ApplicationDetailPage from "./pages/ApplicationDetailPage";
import ClaimsPage from "./pages/ClaimsPage";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";

const App: React.FC = () => {
  return (
    <DemoCustomerProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/policies" element={<PoliciesPage />} />
          <Route path="/policies/:policyId" element={<PolicyDetailPage />} />
          <Route path="/apply" element={<NewApplicationPage />} />
          <Route
            path="/applications/:applicationId"
            element={<ApplicationDetailPage />}
          />
          <Route path="/claims" element={<ClaimsPage />} />
          <Route path="/kb" element={<KnowledgeBasePage />} />
          <Route
            path="*"
            element={
              <div className="text-center py-20">
                <h1 className="text-2xl font-semibold text-slate-900">
                  Page not found
                </h1>
                <p className="text-sm text-slate-500 mt-2">
                  The page you are looking for does not exist.
                </p>
              </div>
            }
          />
        </Routes>
      </Layout>
    </DemoCustomerProvider>
  );
};

export default App;
