"""In-memory data store loaded from JSON seeds and KB markdown files."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, List, Optional

import yaml

from .schemas import (
    Application,
    Claim,
    Customer,
    KBArticle,
    KBArticleSummary,
    Policy,
)


class DataStore:
    """Holds all in-memory state for the demo backend."""

    def __init__(self, data_dir: Path, kb_dir: Path) -> None:
        self.data_dir = data_dir
        self.kb_dir = kb_dir

        self.customers: Dict[str, Customer] = {}
        self.policies: Dict[str, Policy] = {}
        self.applications: Dict[str, Application] = {}
        self.claims: Dict[str, Claim] = {}
        self.kb_articles: Dict[str, KBArticle] = {}

        self._customer_counter = 0
        self._policy_counter = 0
        self._application_counter = 0
        self._claim_counter = 0

    # ------------------------------------------------------------------
    # Loading
    # ------------------------------------------------------------------
    def load(self) -> None:
        self._load_json("customers.json", self.customers, Customer, "customer_id")
        self._load_json("policies.json", self.policies, Policy, "policy_id")
        self._load_json(
            "applications.json", self.applications, Application, "application_id"
        )
        self._load_json("claims.json", self.claims, Claim, "claim_id")
        self._load_kb()

        self._customer_counter = self._max_id_num(self.customers.keys(), "CUST-")
        self._policy_counter = self._max_id_num(self.policies.keys(), "POL-")
        self._application_counter = self._max_id_num(self.applications.keys(), "APP-")
        self._claim_counter = self._max_id_num(self.claims.keys(), "CLM-")

    def _load_json(
        self,
        filename: str,
        target: Dict[str, object],
        model_cls,
        id_field: str,
    ) -> None:
        path = self.data_dir / filename
        if not path.exists():
            return
        with path.open("r", encoding="utf-8") as fh:
            raw = json.load(fh)
        for item in raw:
            obj = model_cls(**item)
            target[getattr(obj, id_field)] = obj

    def _load_kb(self) -> None:
        if not self.kb_dir.exists():
            return
        for md_path in sorted(self.kb_dir.glob("*.md")):
            slug = md_path.stem
            text = md_path.read_text(encoding="utf-8")
            tags, body = self._parse_frontmatter(text)
            title = self._extract_title(body) or slug.replace("-", " ").title()
            article = KBArticle(
                article_id=slug,
                title=title,
                slug=slug,
                tags=tags,
                body_markdown=body,
            )
            self.kb_articles[slug] = article

    @staticmethod
    def _parse_frontmatter(text: str) -> tuple[List[str], str]:
        if text.startswith("---"):
            parts = text.split("---", 2)
            if len(parts) >= 3:
                fm_raw = parts[1]
                body = parts[2].lstrip("\n")
                try:
                    fm = yaml.safe_load(fm_raw) or {}
                except yaml.YAMLError:
                    fm = {}
                tags = fm.get("tags", []) if isinstance(fm, dict) else []
                if not isinstance(tags, list):
                    tags = []
                return [str(t) for t in tags], body
        return [], text

    @staticmethod
    def _extract_title(body: str) -> Optional[str]:
        for line in body.splitlines():
            stripped = line.strip()
            if stripped.startswith("# "):
                return stripped[2:].strip()
        return None

    @staticmethod
    def _max_id_num(ids, prefix: str) -> int:
        max_n = 0
        pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$")
        for ident in ids:
            m = pattern.match(ident)
            if m:
                n = int(m.group(1))
                if n > max_n:
                    max_n = n
        return max_n

    # ------------------------------------------------------------------
    # ID generation
    # ------------------------------------------------------------------
    def next_customer_id(self) -> str:
        self._customer_counter += 1
        return f"CUST-{self._customer_counter:04d}"

    def next_policy_id(self) -> str:
        self._policy_counter += 1
        return f"POL-{self._policy_counter:04d}"

    def next_application_id(self) -> str:
        self._application_counter += 1
        return f"APP-{self._application_counter:04d}"

    def next_claim_id(self) -> str:
        self._claim_counter += 1
        return f"CLM-{self._claim_counter:04d}"

    # ------------------------------------------------------------------
    # Query helpers
    # ------------------------------------------------------------------
    def policies_for_customer(self, customer_id: str) -> List[Policy]:
        return [p for p in self.policies.values() if p.customer_id == customer_id]

    def applications_for_customer(self, customer_id: str) -> List[Application]:
        return [
            a for a in self.applications.values() if a.customer_id == customer_id
        ]

    def claims_for_customer(self, customer_id: str) -> List[Claim]:
        return [c for c in self.claims.values() if c.customer_id == customer_id]

    def kb_summaries(self) -> List[KBArticleSummary]:
        return [
            KBArticleSummary(
                article_id=a.article_id,
                title=a.title,
                slug=a.slug,
                tags=a.tags,
            )
            for a in self.kb_articles.values()
        ]

    def kb_search(self, query: str, limit: int = 5) -> List[KBArticleSummary]:
        q = query.lower().strip()
        if not q:
            return []
        # Split into tokens so multi-word queries do OR matching across fields.
        tokens = [t for t in q.split() if len(t) > 2]
        if not tokens:
            tokens = [q]
        scored: List[tuple[int, KBArticle]] = []
        for article in self.kb_articles.values():
            score = 0
            title_l = article.title.lower()
            slug_l = article.slug.lower()
            body_l = article.body_markdown.lower()
            tags_l = [t.lower() for t in article.tags]
            for tok in tokens:
                if tok in title_l:
                    score += 5
                if tok in slug_l:
                    score += 3
                for tag in tags_l:
                    if tok in tag:
                        score += 2
                if tok in body_l:
                    score += 1
            if score > 0:
                scored.append((score, article))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [
            KBArticleSummary(
                article_id=a.article_id,
                title=a.title,
                slug=a.slug,
                tags=a.tags,
            )
            for _, a in scored[:limit]
        ]
