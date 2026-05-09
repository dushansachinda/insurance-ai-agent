"""Tools available to the underwriting agent."""

import logging
import os
from datetime import datetime, timezone
from typing import Any

import httpx

from app.mcp_client import credit_check as _mcp_credit_check

logger = logging.getLogger(__name__)

BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://backend:8001")
HTTP_TIMEOUT = 30.0


async def _get(path: str) -> Any:
    url = f"{BACKEND_BASE_URL.rstrip('/')}/{path.lstrip('/')}"
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.json()


async def _patch(path: str, data: dict) -> Any:
    url = f"{BACKEND_BASE_URL.rstrip('/')}/{path.lstrip('/')}"
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        resp = await client.patch(url, json=data)
        resp.raise_for_status()
        return resp.json()


async def get_application(application_id: str) -> dict:
    """Fetch the full policy application record by application_id (e.g. 'APP-0001').

    Returns vehicle details, driver list, requested coverage, deductible, and current status.
    """
    return await _get(f"/api/applications/{application_id}")


async def get_customer(customer_id: str) -> dict:
    """Fetch the customer record by customer_id (e.g. 'CUST-0001').

    Returns contact information including ssn_last4 needed for the credit check.
    """
    return await _get(f"/api/customers/{customer_id}")


async def credit_check(customer_id: str, ssn_last4: str) -> dict:
    """Run a credit check via the external MCP bureau aggregator.

    Args:
        customer_id: InsureCo customer_id.
        ssn_last4: Last 4 digits of SSN from the customer record.

    Returns composite_score, risk_tier, status, and individual bureau reports.
    """
    return await _mcp_credit_check(customer_id, ssn_last4)


async def update_application_decision(
    application_id: str,
    decision: str,
    notes: str,
) -> dict:
    """Record the underwriting decision on the application.

    Args:
        application_id: The application to update (e.g. 'APP-0001').
        decision: Final decision — one of 'approved', 'declined', 'needs_review'.
        notes: Human-readable explanation of the decision (2-4 sentences).

    Returns the updated application record.
    """
    payload = {
        "status": decision,
        "underwriting_notes": notes,
        "underwriting_agent": "underwriting_agent",
        "underwritten_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    logger.info(f"[uw/tools] Recording decision={decision} for {application_id}")
    return await _patch(f"/api/applications/{application_id}", payload)
