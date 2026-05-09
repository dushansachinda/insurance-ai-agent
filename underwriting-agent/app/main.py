"""FastAPI service for the Demo Insurance Corp underwriting agent.

POST /review  — accepts an application_id, runs the underwriting pipeline
               asynchronously, and returns 202 immediately.
GET  /health  — liveness probe.

Architecture: the 4-step data-gathering workflow (get_application →
get_customer → credit_check via MCP → apply rules) is orchestrated in
Python code for reliability. A Gemini LLM call is used only for generating
the human-readable underwriting rationale, which is where the model adds
genuine value.
"""

import logging
import os

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI
from pydantic import BaseModel

load_dotenv()

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Demo Insurance Corp Underwriting Agent")

CURRENT_YEAR = 2026


class ReviewRequest(BaseModel):
    application_id: str


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/review", status_code=202)
async def review(request: ReviewRequest, background_tasks: BackgroundTasks) -> dict:
    """Trigger an async underwriting review for the given application."""
    background_tasks.add_task(_run_underwriting, request.application_id)
    return {"status": "accepted", "application_id": request.application_id}


# ---------------------------------------------------------------------------
# Underwriting pipeline
# ---------------------------------------------------------------------------

async def _run_underwriting(application_id: str) -> None:
    """Full underwriting pipeline: fetch data → apply rules → LLM notes → persist."""
    logger.info(f"[uw] Starting review for {application_id}")
    from app.tools import get_application, get_customer, credit_check, update_application_decision

    try:
        # Step 1 — fetch application
        application = await get_application(application_id)
        logger.info(f"[uw] Fetched application: customer={application['customer_id']}, "
                    f"coverage={application['requested_coverage']}, "
                    f"deductible={application['requested_deductible']}")

        # Step 2 — fetch customer (for ssn_last4)
        customer = await get_customer(application["customer_id"])
        logger.info(f"[uw] Fetched customer ssn_last4=****")

        # Step 3 — credit check via MCP bureau aggregator
        credit = await credit_check(application["customer_id"], customer["ssn_last4"])
        logger.info(f"[uw] Credit result: composite={credit.get('composite_score')}, "
                    f"tier={credit.get('risk_tier')}, status={credit.get('status')}")

        # Step 4 — apply underwriting rules
        decision, findings = _apply_rules(application, credit)
        logger.info(f"[uw] Decision={decision}, findings={findings}")

        # Step 5 — LLM generates the human-readable rationale
        notes = await _generate_notes(application, credit, findings, decision)

        # Step 6 — persist decision to backend
        result = await update_application_decision(application_id, decision, notes)
        logger.info(f"[uw] Decision recorded: {application_id} → {decision}")
        return result

    except Exception as e:
        logger.exception(f"[uw] Underwriting failed for {application_id}: {e}")


def _apply_rules(application: dict, credit: dict) -> tuple[str, list[str]]:
    """Apply all underwriting rules. Returns (decision, findings list)."""
    findings: list[str] = []
    decline = False
    needs_review = False

    # Driver experience
    drivers = application.get("drivers", [])
    if drivers:
        years = drivers[0].get("years_licensed", 0)
        if years < 2:
            findings.append(f"DECLINE — driver has only {years} year(s) licensed (minimum 2 required)")
            decline = True
        elif years < 5:
            findings.append(f"FLAG — driver has {years} years licensed; elevated risk, but not an automatic decline")
        else:
            findings.append(f"PASS — driver has {years} years licensed")

    # Vehicle age
    vehicle_year = application.get("vehicle", {}).get("year", 0)
    age = CURRENT_YEAR - vehicle_year
    if age > 20:
        findings.append(f"DECLINE — vehicle is {age} years old (maximum insurable age is 20)")
        decline = True
    else:
        findings.append(f"PASS — vehicle age is {age} year(s)")

    # Coverage vs deductible
    coverage = application.get("requested_coverage", "")
    deductible = application.get("requested_deductible", 0)
    if coverage == "full" and deductible < 250:
        findings.append(f"DECLINE — full coverage requires a minimum $250 deductible (submitted ${deductible})")
        decline = True
    else:
        findings.append(f"PASS — coverage={coverage}, deductible=${deductible}")

    # Credit tier
    risk_tier = credit.get("risk_tier", "high")
    credit_status = credit.get("status", "declined")
    composite = credit.get("composite_score", 0)
    if risk_tier == "high" or credit_status == "declined":
        findings.append(f"DECLINE — credit risk tier is '{risk_tier}' (composite score {composite})")
        decline = True
    elif risk_tier == "elevated":
        findings.append(f"FLAG — credit risk tier is '{risk_tier}' (composite score {composite}); manual review required")
        needs_review = True
    else:
        findings.append(f"PASS — credit risk tier is '{risk_tier}' (composite score {composite})")

    if decline:
        return "declined", findings
    if needs_review:
        return "needs_review", findings
    return "approved", findings


async def _generate_notes(application: dict, credit: dict, findings: list[str], decision: str) -> str:
    """Call Gemini to produce a concise, human-readable underwriting rationale."""
    try:
        import httpx, os, json
        api_key = os.getenv("GEMINI_API_KEY")
        model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        base_url = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")

        findings_text = "\n".join(f"- {f}" for f in findings)
        vehicle = application.get("vehicle", {})
        drivers = application.get("drivers", [])
        driver_info = drivers[0] if drivers else {}

        prompt = f"""You are the Demo Insurance Corp underwriting agent. Write a 2-4 sentence underwriting decision note for an internal record. Be factual, professional, and concise.

Application summary:
- Vehicle: {vehicle.get('year')} {vehicle.get('make')} {vehicle.get('model')}
- Driver: {driver_info.get('name')}, {driver_info.get('years_licensed')} years licensed
- Coverage: {application.get('requested_coverage')}, deductible ${application.get('requested_deductible')}
- Credit risk tier: {credit.get('risk_tier')} (composite score {credit.get('composite_score')})

Rule findings:
{findings_text}

Final decision: {decision.upper()}

Write the notes now (do not include the word TERMINATE or any meta-commentary):"""

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()

    except Exception as e:
        logger.warning(f"[uw] LLM notes generation failed ({e}); using rule summary")
        return f"Decision: {decision}. Findings: {'; '.join(findings)}"
