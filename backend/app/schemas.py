"""Pydantic models for the insurance AI agent backend."""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class Address(BaseModel):
    street: str
    city: str
    state: str
    zip: str


class Customer(BaseModel):
    customer_id: str
    first_name: str
    last_name: str
    email: str
    phone: str
    dob: str  # YYYY-MM-DD
    ssn_last4: str
    address: Address


class CustomerCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str
    dob: str
    ssn_last4: str
    address: Address


class Vehicle(BaseModel):
    vin: str
    make: str
    model: str
    year: int


class Driver(BaseModel):
    name: str
    license_number: str
    years_licensed: int


CoverageType = Literal["liability", "collision", "comprehensive", "full"]
PolicyStatus = Literal["active", "cancelled", "expired"]
ApplicationStatus = Literal["pending", "approved", "declined", "needs_review"]
ClaimStatus = Literal["filed", "under_review", "approved", "denied", "paid"]


class Policy(BaseModel):
    policy_id: str
    customer_id: str
    vehicle: Vehicle
    drivers: List[Driver]
    coverage_type: CoverageType
    deductible: int
    premium_monthly: float
    status: PolicyStatus
    effective_date: str
    expiration_date: str


class Application(BaseModel):
    application_id: str
    customer_id: str
    vehicle: Vehicle
    drivers: List[Driver]
    requested_coverage: str
    requested_deductible: int
    status: ApplicationStatus
    submitted_at: str
    decision_reason: Optional[str] = None
    quoted_premium_monthly: Optional[float] = None


class ApplicationCreate(BaseModel):
    customer_id: str
    vehicle: Vehicle
    drivers: List[Driver]
    requested_coverage: str
    requested_deductible: int


class Claim(BaseModel):
    claim_id: str
    policy_id: str
    customer_id: str
    incident_date: str
    description: str
    status: ClaimStatus
    amount_requested: float
    amount_approved: Optional[float] = None


class KBArticleSummary(BaseModel):
    article_id: str
    title: str
    slug: str
    tags: List[str] = Field(default_factory=list)


class KBArticle(KBArticleSummary):
    body_markdown: str
