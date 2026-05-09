"""HTTP-backed tools for the Demo Insurance Corp agents.

All functions are plain async callables. AutoGen 0.4+ introspects type hints
and docstrings to expose them to the LLM as tools. No auth wrappers - the
backend service is reached via plain HTTP within the trusted network.
"""

import asyncio
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://backend:8001")
UNDERWRITING_AGENT_URL = os.getenv("UNDERWRITING_AGENT_URL", "http://underwriting-agent:8006")
HTTP_TIMEOUT = 30.0


async def _get(path: str, params: dict | None = None) -> Any:
    url = f"{BACKEND_BASE_URL.rstrip('/')}/{path.lstrip('/')}"
    logger.info(f"[tools] GET {url} params={params}")
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        resp = await client.get(url, params=params)
        if resp.status_code >= 400:
            logger.error(f"[tools] GET {url} -> {resp.status_code}: {resp.text[:300]}")
        resp.raise_for_status()
        return resp.json()


async def _post(path: str, data: dict) -> Any:
    url = f"{BACKEND_BASE_URL.rstrip('/')}/{path.lstrip('/')}"
    logger.info(f"[tools] POST {url}")
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        resp = await client.post(url, json=data)
        if resp.status_code >= 400:
            logger.error(f"[tools] POST {url} -> {resp.status_code}: {resp.text[:300]}")
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# Customer / application tools (NewPolicyAgent)
# ---------------------------------------------------------------------------

async def get_customer(customer_id: str) -> dict:
    """Fetch an existing customer record by customer_id (e.g. 'CUST-0001').

    Returns the full customer profile including contact info and address.
    """
    return await _get(f"/api/customers/{customer_id}")


async def create_customer(
    first_name: str,
    last_name: str,
    email: str,
    phone: str,
    dob: str,
    ssn_last4: str,
    street: str,
    city: str,
    state: str,
    zip_code: str,
) -> dict:
    """Create a new customer in the Demo Insurance Corp system.

    Args:
        first_name: Customer's given name.
        last_name: Customer's family name.
        email: Email address.
        phone: Phone number including area code.
        dob: Date of birth in YYYY-MM-DD format.
        ssn_last4: Last four digits of SSN (string, exactly 4 chars).
        street: Street address line.
        city: City name.
        state: Two-letter US state code.
        zip_code: 5-digit ZIP code.

    Returns the created Customer object including the new customer_id.
    """
    payload = {
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "phone": phone,
        "dob": dob,
        "ssn_last4": ssn_last4,
        "address": {
            "street": street,
            "city": city,
            "state": state,
            "zip": zip_code,
        },
    }
    return await _post("/api/customers", payload)


async def get_application_details(application_id: str) -> dict:
    """Fetch a policy application by application_id (e.g. 'APP-0001').

    Returns vehicle, drivers, coverage, status, and quoted premium.
    """
    return await _get(f"/api/applications/{application_id}")


async def create_policy_application(
    customer_id: str,
    ssn_last4: str,
    vin: str,
    make: str,
    model: str,
    year: int,
    driver_name: str,
    license_number: str,
    years_licensed: int,
    coverage_type: str,
    deductible: int,
) -> dict:
    """Submit a new auto insurance policy application.

    A credit check is always run first via the external bureau MCP service.
    If the applicant is declined, the application is not submitted.

    Args:
        customer_id: Existing customer_id (e.g. 'CUST-0001').
        ssn_last4: Last 4 digits of SSN — required for the mandatory credit check.
        vin: Vehicle Identification Number.
        make: Vehicle make (e.g. 'Toyota').
        model: Vehicle model (e.g. 'Camry').
        year: Vehicle model year.
        driver_name: Primary driver full name.
        license_number: Driver's license number.
        years_licensed: How many years the driver has been licensed.
        coverage_type: One of 'liability', 'collision', 'comprehensive', 'full'.
        deductible: Requested deductible (250, 500, 1000, or 1500).

    Returns the created Application including application_id, status,
    quoted_premium_monthly, and the credit_report used for underwriting.
    """
    # Credit check is mandatory — runs unconditionally before any submission.
    from app.mcp_client import credit_check as _credit_check
    logger.info(f"[tools] Running mandatory credit check for {customer_id}")
    credit_report = await _credit_check(customer_id, ssn_last4)

    if credit_report.get("status") == "declined":
        return {
            "application_submitted": False,
            "reason": "credit_check_declined",
            "credit_report": credit_report,
        }

    payload = {
        "customer_id": customer_id,
        "vehicle": {
            "vin": vin,
            "make": make,
            "model": model,
            "year": year,
        },
        "drivers": [
            {
                "name": driver_name,
                "license_number": license_number,
                "years_licensed": years_licensed,
            }
        ],
        "requested_coverage": coverage_type,
        "requested_deductible": deductible,
    }
    application = await _post("/api/applications", payload)

    # Notify the underwriting agent — fire and forget, user gets response immediately.
    asyncio.create_task(_trigger_underwriting(application["application_id"]))

    return {**application, "credit_report": credit_report}


async def _trigger_underwriting(application_id: str) -> None:
    url = f"{UNDERWRITING_AGENT_URL.rstrip('/')}/review"
    logger.info(f"[tools] Triggering underwriting review for {application_id} at {url}")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json={"application_id": application_id})
            logger.info(f"[tools] Underwriting agent accepted review: {resp.status_code}")
    except Exception as e:
        logger.warning(f"[tools] Could not reach underwriting agent: {e}")


# ---------------------------------------------------------------------------
# Existing policy tools (ExistingPolicyAgent)
# ---------------------------------------------------------------------------

async def get_policy_details(policy_id: str) -> dict:
    """Fetch a single policy by policy_id (e.g. 'POL-0001')."""
    return await _get(f"/api/policies/{policy_id}")


async def list_customer_policies(customer_id: str) -> list:
    """List all policies belonging to a customer (e.g. 'CUST-0001')."""
    result = await _get(f"/api/customers/{customer_id}/policies")
    if isinstance(result, dict) and "items" in result:
        return result["items"]
    return result if isinstance(result, list) else []


async def get_claim_details(claim_id: str) -> dict:
    """Fetch a single claim by claim_id (e.g. 'CLM-0001')."""
    return await _get(f"/api/claims/{claim_id}")


async def list_customer_claims(customer_id: str) -> list:
    """List all claims belonging to a customer (e.g. 'CUST-0001')."""
    result = await _get(f"/api/customers/{customer_id}/claims")
    if isinstance(result, dict) and "items" in result:
        return result["items"]
    return result if isinstance(result, list) else []


# ---------------------------------------------------------------------------
# Knowledge base tools (GeneralQAAgent)
# ---------------------------------------------------------------------------

async def search_knowledge_base(query: str, limit: int = 5) -> list:
    """Search the Demo Insurance Corp knowledge base for relevant articles.

    Args:
        query: Free-text search query (e.g. 'how do deductibles work').
        limit: Max number of results to return (default 5).

    Returns a list of article summaries with article_id, title, slug, and
    snippet.
    """
    result = await _get("/api/knowledge-base/search", params={"q": query, "limit": limit})
    if isinstance(result, dict) and "items" in result:
        return result["items"]
    return result if isinstance(result, list) else []


async def get_knowledge_base_article(article_id: str) -> dict:
    """Fetch the full body of a knowledge base article by article_id."""
    return await _get(f"/api/knowledge-base/{article_id}")
