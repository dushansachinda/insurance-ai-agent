import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DEMO_CUSTOMERS } from "../config";

const STORAGE_KEY = "insureco-demo-customer";
const DEFAULT_CUSTOMER_ID = DEMO_CUSTOMERS[0]?.id ?? "CUST-0001";

interface DemoCustomerContextValue {
  customerId: string;
  setCustomerId: (id: string) => void;
}

const DemoCustomerContext = createContext<DemoCustomerContextValue | undefined>(
  undefined
);

export const DemoCustomerProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [customerId, setCustomerIdState] = useState<string>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_CUSTOMER_ID;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && stored.length > 0 ? stored : DEFAULT_CUSTOMER_ID;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, customerId);
    } catch {
      // ignore storage errors (e.g. private mode)
    }
  }, [customerId]);

  const value = useMemo<DemoCustomerContextValue>(
    () => ({
      customerId,
      setCustomerId: (id: string) => setCustomerIdState(id),
    }),
    [customerId]
  );

  return (
    <DemoCustomerContext.Provider value={value}>
      {children}
    </DemoCustomerContext.Provider>
  );
};

export function useDemoCustomer(): DemoCustomerContextValue {
  const ctx = useContext(DemoCustomerContext);
  if (!ctx) {
    throw new Error(
      "useDemoCustomer must be used within a DemoCustomerProvider"
    );
  }
  return ctx;
}
