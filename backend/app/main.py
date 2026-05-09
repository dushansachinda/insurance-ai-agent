"""FastAPI entrypoint for the insurance AI agent demo backend."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import List

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .data_store import DataStore
from .schemas import (
    Application,
    ApplicationCreate,
    Claim,
    Customer,
    CustomerCreate,
    KBArticle,
    KBArticleSummary,
    Policy,
)

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
KB_DIR = BASE_DIR / "knowledge_base"

app = FastAPI(title="Insurance AI Agent Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    store = DataStore(DATA_DIR, KB_DIR)
    store.load()
    app.state.store = store


def get_store() -> DataStore:
    return app.state.store


# ---------------------------------------------------------------------------
# Premium quote heuristic
# ---------------------------------------------------------------------------
def quote_premium(coverage: str, deductible: int, vehicle_year: int) -> float:
    coverage_addon = {
        "full": 60,
        "comprehensive": 40,
        "collision": 25,
        "liability": 0,
    }.get(coverage, 0)
    deductible_addon = {250: 30, 500: 15, 1000: 0, 1500: -10}.get(deductible, 0)
    age_addon = 0
    if vehicle_year < 2010:
        age_addon += 20
    if vehicle_year > 2022:
        age_addon += 25
    base = 80
    return round(base + coverage_addon + deductible_addon + age_addon, 2)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# Customers --------------------------------------------------------------
@app.get("/api/customers/{customer_id}", response_model=Customer)
def get_customer(customer_id: str, store: DataStore = Depends(get_store)) -> Customer:
    customer = store.customers.get(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found")
    return customer


@app.post("/api/customers", response_model=Customer)
def create_customer(
    payload: CustomerCreate, store: DataStore = Depends(get_store)
) -> Customer:
    new_id = store.next_customer_id()
    customer = Customer(customer_id=new_id, **payload.model_dump())
    store.customers[new_id] = customer
    return customer


@app.get(
    "/api/customers/{customer_id}/policies", response_model=List[Policy]
)
def list_customer_policies(
    customer_id: str, store: DataStore = Depends(get_store)
) -> List[Policy]:
    if customer_id not in store.customers:
        raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found")
    return store.policies_for_customer(customer_id)


# Policies ---------------------------------------------------------------
@app.get("/api/policies/{policy_id}", response_model=Policy)
def get_policy(policy_id: str, store: DataStore = Depends(get_store)) -> Policy:
    policy = store.policies.get(policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail=f"Policy {policy_id} not found")
    return policy


# Applications -----------------------------------------------------------
@app.get("/api/applications/{application_id}", response_model=Application)
def get_application(
    application_id: str, store: DataStore = Depends(get_store)
) -> Application:
    application = store.applications.get(application_id)
    if not application:
        raise HTTPException(
            status_code=404, detail=f"Application {application_id} not found"
        )
    return application


@app.get(
    "/api/customers/{customer_id}/applications", response_model=List[Application]
)
def list_customer_applications(
    customer_id: str, store: DataStore = Depends(get_store)
) -> List[Application]:
    if customer_id not in store.customers:
        raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found")
    return store.applications_for_customer(customer_id)


@app.post("/api/applications", response_model=Application)
def create_application(
    payload: ApplicationCreate, store: DataStore = Depends(get_store)
) -> Application:
    if payload.customer_id not in store.customers:
        raise HTTPException(
            status_code=404, detail=f"Customer {payload.customer_id} not found"
        )
    new_id = store.next_application_id()
    quoted = quote_premium(
        payload.requested_coverage,
        payload.requested_deductible,
        payload.vehicle.year,
    )
    submitted_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    application = Application(
        application_id=new_id,
        customer_id=payload.customer_id,
        vehicle=payload.vehicle,
        drivers=payload.drivers,
        requested_coverage=payload.requested_coverage,
        requested_deductible=payload.requested_deductible,
        status="pending",
        submitted_at=submitted_at,
        decision_reason=None,
        quoted_premium_monthly=quoted,
    )
    store.applications[new_id] = application
    return application


# Claims -----------------------------------------------------------------
@app.get(
    "/api/customers/{customer_id}/claims", response_model=List[Claim]
)
def list_customer_claims(
    customer_id: str, store: DataStore = Depends(get_store)
) -> List[Claim]:
    if customer_id not in store.customers:
        raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found")
    return store.claims_for_customer(customer_id)


@app.get("/api/claims/{claim_id}", response_model=Claim)
def get_claim(claim_id: str, store: DataStore = Depends(get_store)) -> Claim:
    claim = store.claims.get(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail=f"Claim {claim_id} not found")
    return claim


# Knowledge base ---------------------------------------------------------
@app.get(
    "/api/knowledge-base/articles", response_model=List[KBArticleSummary]
)
def list_kb_articles(store: DataStore = Depends(get_store)) -> List[KBArticleSummary]:
    return store.kb_summaries()


@app.get(
    "/api/knowledge-base/articles/{article_id}", response_model=KBArticle
)
def get_kb_article(
    article_id: str, store: DataStore = Depends(get_store)
) -> KBArticle:
    article = store.kb_articles.get(article_id)
    if not article:
        raise HTTPException(
            status_code=404, detail=f"Article {article_id} not found"
        )
    return article


@app.get(
    "/api/knowledge-base/search", response_model=List[KBArticleSummary]
)
def search_kb(
    q: str = Query(..., min_length=1),
    limit: int = Query(5, ge=1, le=50),
    store: DataStore = Depends(get_store),
) -> List[KBArticleSummary]:
    return store.kb_search(q, limit=limit)
