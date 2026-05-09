import axios, { AxiosInstance } from "axios";
import { API_BASE_URL } from "../config";
import {
  Application,
  Claim,
  Customer,
  KBArticle,
  KBArticleSummary,
  Policy,
} from "../types";

const http: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

export interface CreateApplicationPayload {
  customer_id: string;
  vehicle: {
    vin: string;
    make: string;
    model: string;
    year: number;
  };
  drivers: {
    name: string;
    license_number: string;
    years_licensed: number;
  }[];
  requested_coverage: string;
  requested_deductible: number;
}

export const api = {
  async getCustomer(customerId: string): Promise<Customer> {
    const { data } = await http.get<Customer>(`/api/customers/${customerId}`);
    return data;
  },

  async listCustomerPolicies(customerId: string): Promise<Policy[]> {
    const { data } = await http.get<Policy[]>(
      `/api/customers/${customerId}/policies`
    );
    return data;
  },

  async getPolicy(policyId: string): Promise<Policy> {
    const { data } = await http.get<Policy>(`/api/policies/${policyId}`);
    return data;
  },

  async listCustomerApplications(customerId: string): Promise<Application[]> {
    const { data } = await http.get<Application[]>(
      `/api/customers/${customerId}/applications`
    );
    return data;
  },

  async getApplication(applicationId: string): Promise<Application> {
    const { data } = await http.get<Application>(
      `/api/applications/${applicationId}`
    );
    return data;
  },

  async createApplication(
    payload: CreateApplicationPayload
  ): Promise<Application> {
    const { data } = await http.post<Application>(`/api/applications`, payload);
    return data;
  },

  async listCustomerClaims(customerId: string): Promise<Claim[]> {
    const { data } = await http.get<Claim[]>(
      `/api/customers/${customerId}/claims`
    );
    return data;
  },

  async getClaim(claimId: string): Promise<Claim> {
    const { data } = await http.get<Claim>(`/api/claims/${claimId}`);
    return data;
  },

  async listKBArticles(): Promise<KBArticleSummary[]> {
    const { data } = await http.get<KBArticleSummary[]>(`/api/kb/articles`);
    return data;
  },

  async getKBArticle(slug: string): Promise<KBArticle> {
    const { data } = await http.get<KBArticle>(`/api/kb/articles/${slug}`);
    return data;
  },

  async searchKB(query: string): Promise<KBArticleSummary[]> {
    const { data } = await http.get<KBArticleSummary[]>(`/api/kb/search`, {
      params: { q: query },
    });
    return data;
  },
};

export default api;
