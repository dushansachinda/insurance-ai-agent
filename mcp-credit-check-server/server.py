"""MCP credit-check aggregator.

Calls two external credit bureau services (BureauAlpha and BureauBeta) in
parallel, then merges their reports into a single composite decision.  Bureau
URLs are read from env vars so they can be pointed at local processes or
docker-compose services without code changes.
"""
import asyncio
import os
from datetime import datetime, timezone

import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP(
    name="credit-check-server",
    host="0.0.0.0",
    port=int(os.getenv("MCP_PORT", "8003")),
)

BUREAU_ALPHA_URL = os.getenv("BUREAU_ALPHA_URL", "http://localhost:8004")
BUREAU_BETA_URL = os.getenv("BUREAU_BETA_URL", "http://localhost:8005")

_TIER_RANK = {"low": 0, "medium": 1, "elevated": 2, "high": 3}
_STATUS_RANK = {"approved": 0, "review": 1, "declined": 2}


def _score_to_decision(score: int) -> tuple[str, str]:
    if score >= 745:
        return "approved", "low"
    if score >= 685:
        return "approved", "medium"
    if score >= 625:
        return "review", "elevated"
    return "declined", "high"


async def _call_bureau(client: httpx.AsyncClient, name: str, url: str, payload: dict) -> dict:
    try:
        resp = await client.post(f"{url}/check", json=payload, timeout=10.0)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        return {"provider": name, "error": str(exc)}


@mcp.tool()
async def credit_check(customer_id: str, ssn_last4: str) -> dict:
    """Run a credit check by querying two independent credit bureaus.

    Calls BureauAlpha and BureauBeta in parallel, then returns a composite
    decision based on the averaged score and the stricter of the two outcomes.

    Args:
        customer_id: The internal customer ID (e.g. "CUST-0001").
        ssn_last4: The last four digits of the applicant's SSN.

    Returns a composite credit report including both bureau results.
    """
    if not (isinstance(ssn_last4, str) and ssn_last4.isdigit() and len(ssn_last4) == 4):
        return {"error": "ssn_last4 must be exactly 4 digits"}

    payload = {"customer_id": customer_id, "ssn_last4": ssn_last4}

    async with httpx.AsyncClient() as client:
        alpha_result, beta_result = await asyncio.gather(
            _call_bureau(client, "BureauAlpha", BUREAU_ALPHA_URL, payload),
            _call_bureau(client, "BureauBeta", BUREAU_BETA_URL, payload),
        )

    bureau_reports = [alpha_result, beta_result]

    # Collect successful scores.
    scores = [r["score"] for r in bureau_reports if "score" in r and "error" not in r]

    if not scores:
        return {
            "customer_id": customer_id,
            "error": "All bureau checks failed",
            "bureau_reports": bureau_reports,
            "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }

    composite_score = round(sum(scores) / len(scores))
    composite_status, composite_tier = _score_to_decision(composite_score)

    # Use the stricter status and tier from individual bureau decisions.
    for r in bureau_reports:
        if "error" in r:
            continue
        r_status = r.get("status", "approved")
        r_tier = r.get("risk_tier", "low")
        if _STATUS_RANK.get(r_status, 0) > _STATUS_RANK.get(composite_status, 0):
            composite_status = r_status
        if _TIER_RANK.get(r_tier, 0) > _TIER_RANK.get(composite_tier, 0):
            composite_tier = r_tier

    return {
        "customer_id": customer_id,
        "composite_score": composite_score,
        "status": composite_status,
        "risk_tier": composite_tier,
        "bureaus_queried": len(scores),
        "bureau_reports": bureau_reports,
        "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
