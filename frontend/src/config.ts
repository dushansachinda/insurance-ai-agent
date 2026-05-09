export const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:8001";
export const AGENT_WS_URL =
  process.env.REACT_APP_AGENT_WS_URL || "ws://localhost:8000";

export const DEMO_CUSTOMERS: { id: string; name: string }[] = [
  { id: "CUST-0001", name: "Alice Johnson" },
  { id: "CUST-0002", name: "Bob Smith" },
  { id: "CUST-0003", name: "Carol Davis" },
];
