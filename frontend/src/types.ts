export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface Customer {
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  dob: string;
  ssn_last4: string;
  address: Address;
}

export interface Vehicle {
  vin: string;
  make: string;
  model: string;
  year: number;
}

export interface Driver {
  name: string;
  license_number: string;
  years_licensed: number;
}

export type CoverageType = "liability" | "collision" | "comprehensive" | "full";
export type PolicyStatus = "active" | "cancelled" | "expired";
export type ApplicationStatus =
  | "pending"
  | "approved"
  | "declined"
  | "needs_review";
export type ClaimStatus =
  | "filed"
  | "under_review"
  | "approved"
  | "denied"
  | "paid";

export interface Policy {
  policy_id: string;
  customer_id: string;
  vehicle: Vehicle;
  drivers: Driver[];
  coverage_type: CoverageType;
  deductible: number;
  premium_monthly: number;
  status: PolicyStatus;
  effective_date: string;
  expiration_date: string;
}

export interface Application {
  application_id: string;
  customer_id: string;
  vehicle: Vehicle;
  drivers: Driver[];
  requested_coverage: string;
  requested_deductible: number;
  status: ApplicationStatus;
  submitted_at: string;
  decision_reason?: string | null;
  quoted_premium_monthly?: number | null;
}

export interface Claim {
  claim_id: string;
  policy_id: string;
  customer_id: string;
  incident_date: string;
  description: string;
  status: ClaimStatus;
  amount_requested: number;
  amount_approved?: number | null;
}

export interface KBArticleSummary {
  article_id: string;
  title: string;
  slug: string;
  tags: string[];
}

export interface KBArticle extends KBArticleSummary {
  body_markdown: string;
}

// Chat WS message types (from supervisor agent)
export type ChatInbound = { type: "user_message"; content: string };

export type ChatOutbound =
  | { type: "assistant_message"; agent: string; content: string }
  | { type: "agent_handoff"; from: string; to: string }
  | {
      type: "tool_call";
      agent: string;
      tool: string;
      args: Record<string, unknown>;
    }
  | { type: "tool_result"; agent: string; tool: string; result: string }
  | { type: "done" }
  | { type: "error"; message: string };
