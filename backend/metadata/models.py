"""
Data models for the compliance RAG pipeline.
"""

from dataclasses import dataclass, field
from typing import Optional


# ─────────────────────────────────────────────
# Ingestion models
# ─────────────────────────────────────────────

@dataclass
class DocumentChunk:
    """A single chunk stored in the vector DB."""
    chunk_id: str           # e.g. "gdpr_art6_p2"
    text: str
    regulation: str         # "gdpr" | "pdpa" | "eprivacy"
    doc_type: str           # "regulation" | "guidance" | "enforcement"
    source_title: str
    source_url: str
    article: str            # article/section number, e.g. "6" or "10"
    article_title: str      # e.g. "Lawful basis for processing"
    categories: list[int]   # which category IDs this chunk covers
    priority: str           # "Critical" | "High" | "Medium" — max priority of covered labels
    chunk_index: int        # position within the source document


# ─────────────────────────────────────────────
# Pipeline / output models
# ─────────────────────────────────────────────

@dataclass
class LabelResult:
    """Result for a single label within a category."""
    label: str
    priority: str           # "Critical" | "High" | "Medium"
    compliant: bool         # True = policy satisfies this label
    violation: bool         # True = clear violation found
    missing: bool           # True = label not addressed at all
    explanation: str        # concise explanation of the finding
    policy_excerpt: str     # the relevant excerpt from the policy (empty if missing)
    legal_basis: str        # e.g. "GDPR Art. 6(1)(a), EDPB Guidelines 05/2020"
    recommendation: str     # what the policy must add/change to comply


@dataclass
class CategoryResult:
    """Aggregated result for one of the 15 categories."""
    category_id: int
    category_name: str
    regulation: str
    label_results: list[LabelResult]
    score: float            # 0.0–1.0  (compliant labels / total labels)
    critical_violations: int
    high_violations: int

    @property
    def has_violations(self) -> bool:
        return any(r.violation or r.missing for r in self.label_results)

    @property
    def severity(self) -> str:
        if self.critical_violations > 0:
            return "CRITICAL"
        if self.high_violations > 0:
            return "HIGH"
        if self.score < 1.0:
            return "MEDIUM"
        return "COMPLIANT"


@dataclass
class ComplianceReport:
    """Final output of the RAG pipeline for one privacy policy."""
    url: str                            # website URL that was analysed
    regulation: str                     # "gdpr" | "pdpa" | "both"
    timestamp: str                      # ISO 8601
    overall_score: float                # 0.0–1.0
    total_critical_violations: int
    total_high_violations: int
    category_results: list[CategoryResult]
    summary: str                        # LLM-generated executive summary

    @property
    def risk_level(self) -> str:
        if self.total_critical_violations > 0:
            return "HIGH RISK"
        if self.total_high_violations > 2:
            return "MEDIUM RISK"
        if self.overall_score >= 0.9:
            return "LOW RISK"
        return "MEDIUM RISK"
