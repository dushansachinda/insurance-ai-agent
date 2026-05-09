"""BureauBeta — dummy credit bureau service (port 8005)."""
import hashlib
import os
from datetime import datetime, timezone

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="BureauBeta Credit Service", version="1.0.0")


class CheckRequest(BaseModel):
    customer_id: str
    ssn_last4: str


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "bureau": "BureauBeta"}


@app.post("/check")
async def check(req: CheckRequest) -> dict:
    if not (req.ssn_last4.isdigit() and len(req.ssn_last4) == 4):
        return {"provider": "BureauBeta", "error": "ssn_last4 must be exactly 4 digits"}

    # Different salt so Beta produces a meaningfully different score from Alpha.
    seed = f"beta|{req.customer_id}|{req.ssn_last4}".encode()
    digest = int(hashlib.sha256(seed).hexdigest(), 16)
    score = 510 + (digest % 311)  # 510–820

    if score >= 740:
        status, tier = "approved", "low"
    elif score >= 680:
        status, tier = "approved", "medium"
    elif score >= 620:
        status, tier = "review", "elevated"
    else:
        status, tier = "declined", "high"

    return {
        "provider": "BureauBeta",
        "customer_id": req.customer_id,
        "score": score,
        "status": status,
        "risk_tier": tier,
        "model_version": "BETA-v2.7",
        "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8005"))
    uvicorn.run(app, host="0.0.0.0", port=port)
