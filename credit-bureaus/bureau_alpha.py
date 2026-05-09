"""BureauAlpha — dummy credit bureau service (port 8004)."""
import hashlib
import os
from datetime import datetime, timezone

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="BureauAlpha Credit Service", version="1.0.0")


class CheckRequest(BaseModel):
    customer_id: str
    ssn_last4: str


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "bureau": "BureauAlpha"}


@app.post("/check")
async def check(req: CheckRequest) -> dict:
    if not (req.ssn_last4.isdigit() and len(req.ssn_last4) == 4):
        return {"provider": "BureauAlpha", "error": "ssn_last4 must be exactly 4 digits"}

    # Deterministic score seeded per bureau so Alpha and Beta diverge realistically.
    seed = f"alpha|{req.customer_id}|{req.ssn_last4}".encode()
    digest = int(hashlib.sha256(seed).hexdigest(), 16)
    score = 480 + (digest % 341)  # 480–820

    if score >= 750:
        status, tier = "approved", "low"
    elif score >= 690:
        status, tier = "approved", "medium"
    elif score >= 630:
        status, tier = "review", "elevated"
    else:
        status, tier = "declined", "high"

    return {
        "provider": "BureauAlpha",
        "customer_id": req.customer_id,
        "score": score,
        "status": status,
        "risk_tier": tier,
        "model_version": "ALPHA-v3.1",
        "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8004"))
    uvicorn.run(app, host="0.0.0.0", port=port)
