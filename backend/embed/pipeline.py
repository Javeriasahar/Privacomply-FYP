"""
RAG Compliance Pipeline — Privacy Policy Violation Detector

Flow for a given privacy policy text + regulation selection:
  1. Decompose  → split policy into per-category relevant clauses
  2. Retrieve   → for each category, fetch top-k Qdrant chunks (filtered by regulation + category ID)
  3. Judge      → LLM evaluates each label: compliant / violation / missing
  4. Report     → aggregate into ComplianceReport with scores and recommendations

Usage from Python:
    from pipeline import CompliancePipeline
    pipeline = CompliancePipeline(regulation="gdpr")
    report = pipeline.analyze(policy_text="...", url="https://example.com")

Usage from CLI:
    python pipeline.py --url https://example.com --regulation gdpr
    python pipeline.py --file policy.txt --regulation both
"""

import sys
import os

# ── Resolve project root and add required source directories to path ──
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _d in [_ROOT, os.path.join(_ROOT, "metadata")]:
    if _d not in sys.path:
        sys.path.insert(0, _d)

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Optional

from groq import Groq
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import FieldCondition, Filter, MatchAny, MatchValue

from config import (
    CATEGORIES,
    CATEGORY_MAP,
    COLLECTION_NAME,
    EMBED_MODEL,
    GROQ_API_KEY,
    JUDGE_MODEL,
    QDRANT_API_KEY,
    QDRANT_URL,
    TOP_K_PER_CATEGORY,
)
from models import CategoryResult, ComplianceReport, LabelResult

# ─────────────────────────────────────────────
embedding_model = SentenceTransformer(EMBED_MODEL)
groq_client     = Groq(api_key=GROQ_API_KEY)
qdrant          = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)


def _gemini_call(
    contents: str,
    max_tokens: int,
    system: str = None,
    retries: int = 5,
) -> str:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": contents})

    last_exc = None
    for attempt in range(retries):
        try:
            response = groq_client.chat.completions.create(
                model=JUDGE_MODEL,
                messages=messages,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            last_exc = e
            msg = str(e)
            if any(x in msg for x in ("429", "rate_limit", "503", "overloaded")):
                wait = 2 ** attempt
                print(f"  [groq] rate limited — waiting {wait}s (attempt {attempt+1}/{retries})")
                time.sleep(wait)
            else:
                raise
    raise last_exc


# ═══════════════════════════════════════════════
# STEP 1 — DECOMPOSE POLICY INTO CATEGORY CLAUSES
# ═══════════════════════════════════════════════

DECOMPOSE_PROMPT = """\
You are a legal analyst decomposing a website privacy policy for compliance review.

Given the full privacy policy text below, extract the specific clauses, sentences, and paragraphs \
that are relevant to EACH of the following compliance categories.

For each category, quote or closely paraphrase the EXACT policy text that relates to it. \
If the policy says nothing about a category, return an empty string for that category.

Output ONLY a JSON object with category names as keys and relevant policy text as values.
No preamble, no explanation, no markdown fences.

Categories:
{categories}

Privacy Policy:
{policy_text}
"""

def decompose_policy(policy_text: str) -> dict[str, str]:
    """
    Ask Claude to extract per-category relevant clauses from the privacy policy.
    Returns dict: category_name → relevant_excerpt (or "" if absent).
    """
    category_names = [c["name"] for c in CATEGORIES]
    categories_str = "\n".join(f"- {name}" for name in category_names)

    # Truncate policy text to ~6000 words to stay within context
    words = policy_text.split()
    if len(words) > 6000:
        policy_text = " ".join(words[:6000]) + "\n[... truncated for context ...]"

    prompt = DECOMPOSE_PROMPT.format(
        categories=categories_str,
        policy_text=policy_text,
    )

    raw = _gemini_call(prompt, max_tokens=4096)

    # Strip any accidental markdown fences
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: return full text for all categories
        return {name: policy_text for name in category_names}


# ═══════════════════════════════════════════════
# STEP 2 — RETRIEVE RELEVANT LEGAL CHUNKS
# ═══════════════════════════════════════════════

def embed_query(text: str) -> list[float]:
    return embedding_model.encode(text).tolist()


def embed_queries_batch(texts: list[str]) -> list[list[float]]:
    """Encode multiple texts in a single batched call."""
    vectors = embedding_model.encode(texts, batch_size=len(texts), show_progress_bar=False)
    return [v.tolist() for v in vectors]


def build_qdrant_filter(regulation: str, category_id: int) -> Filter:
    """
    Build a Qdrant filter that:
      - matches the correct regulation (or 'eprivacy' which is relevant to both)
      - matches the specific category ID
    """
    if regulation == "both":
        reg_condition = FieldCondition(
            key="regulation",
            match=MatchAny(any=["gdpr", "pdpa", "eprivacy"]),
        )
    else:
        reg_condition = FieldCondition(
            key="regulation",
            match=MatchAny(any=[regulation, "eprivacy"]),
        )

    cat_condition = FieldCondition(
        key="categories",
        match=MatchValue(value=category_id),
    )

    return Filter(must=[reg_condition, cat_condition])


def retrieve_for_category(
    category: dict,
    regulation: str,
    policy_excerpt: str,
    query_vec: list[float] | None = None,
) -> list[dict]:
    """
    Retrieve the top-k most relevant legal chunks for a category.
    Query = policy excerpt + category query hint (gives better semantic results
    than querying purely on the legal obligation).
    Accepts a pre-computed query_vec to avoid redundant embedding work.
    """
    if query_vec is None:
        query_text = f"{category['query_hint']}\n\n{policy_excerpt}"
        query_vec = embed_query(query_text)

    response = qdrant.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vec,
        query_filter=build_qdrant_filter(regulation, category["id"]),
        limit=TOP_K_PER_CATEGORY,
        with_payload=True,
    )

    return [
        {
            "text":         hit.payload.get("text", ""),
            "source_title": hit.payload.get("source_title", ""),
            "article":      hit.payload.get("article", ""),
            "article_title":hit.payload.get("article_title", ""),
            "regulation":   hit.payload.get("regulation", ""),
            "score":        hit.score,
        }
        for hit in response.points
    ]


# ═══════════════════════════════════════════════
# STEP 3 — LLM JUDGE PER CATEGORY
# ═══════════════════════════════════════════════

JUDGE_SYSTEM_PROMPT = """\
You are an expert data protection lawyer and privacy compliance auditor specializing in GDPR and \
Pakistan's Personal Data Protection Bill (PDPA).

Your task is to evaluate a website's privacy policy against specific compliance labels, using \
retrieved legal reference material to ground your judgments.

Be strict and precise. If a label is not clearly addressed in the policy, mark it as MISSING.
"""

BATCH_JUDGE_PROMPT = """\
## Regulation: {regulation}

You must evaluate the privacy policy below against MULTIPLE compliance categories in one pass.

## Privacy Policy Excerpts (per category):
{categories_block}

## Retrieved Legal Reference Material:
{legal_context}

---

For EVERY label in EVERY category above, determine:
- compliant: true if the policy clearly satisfies this label
- violation: true if the policy explicitly contradicts or violates this requirement
- missing: true if the policy simply does not address this label at all
- explanation: 1-2 sentences on what was found (or not found)
- policy_excerpt: the exact policy text evaluated (empty string if missing)
- legal_basis: cite the specific article/section + document name
- recommendation: what the policy must add or change to comply (empty if compliant)

Return ONLY a JSON object. Keys are the exact category names. \
Values are JSON arrays of label result objects (same order as the labels listed above).
No preamble, no markdown fences.

Label result schema:
{{
  "label": "<label text>",
  "priority": "<Critical|High|Medium>",
  "compliant": <bool>,
  "violation": <bool>,
  "missing": <bool>,
  "explanation": "<string>",
  "policy_excerpt": "<string>",
  "legal_basis": "<string>",
  "recommendation": "<string>"
}}
"""


def _parse_label_results(items: list, category: dict) -> list[LabelResult]:
    if not items:
        return [
            LabelResult(
                label=l["text"], priority=l["priority"],
                compliant=False, violation=False, missing=True,
                explanation="No LLM response for this category.",
                policy_excerpt="", legal_basis="", recommendation="Review manually.",
            )
            for l in category["labels"]
        ]
    return [
        LabelResult(
            label=item.get("label", ""),
            priority=item.get("priority", "Medium"),
            compliant=item.get("compliant", False),
            violation=item.get("violation", False),
            missing=item.get("missing", True),
            explanation=item.get("explanation", ""),
            policy_excerpt=item.get("policy_excerpt", ""),
            legal_basis=item.get("legal_basis", ""),
            recommendation=item.get("recommendation", ""),
        )
        for item in items
    ]


def judge_categories_batch(
    categories: list[dict],
    regulation: str,
    policy_excerpts: dict[str, str],
    retrieved_chunks_map: dict[int, list[dict]],
) -> dict[int, list[LabelResult]]:
    """Evaluate multiple categories in a single LLM call."""
    reg_label = {
        "gdpr": "GDPR (EU Regulation 2016/679)",
        "pdpa": "Pakistan Personal Data Protection Bill 2023",
        "both": "GDPR and Pakistan PDPA",
    }.get(regulation, regulation)

    # Build per-category block (labels + excerpt)
    cat_blocks = []
    for cat in categories:
        labels_str = "\n".join(f"  - [{l['priority']}] {l['text']}" for l in cat["labels"])
        excerpt = policy_excerpts.get(cat["name"]) or "[No relevant text found in policy]"
        cat_blocks.append(
            f"### {cat['name']}\nLabels:\n{labels_str}\n\nPolicy excerpt:\n{excerpt}"
        )
    categories_block = "\n\n---\n\n".join(cat_blocks)

    # Legal context: top 3 chunks per category, 500 chars each
    context_parts = []
    for cat in categories:
        for chunk in retrieved_chunks_map.get(cat["id"], [])[:3]:
            context_parts.append(
                f"[{cat['name']} | {chunk['regulation'].upper()} {chunk['article']} "
                f"— {chunk['source_title']}]\n{chunk['text'][:500]}"
            )
    legal_context = "\n---\n".join(context_parts) if context_parts else "No legal context available."

    prompt = BATCH_JUDGE_PROMPT.format(
        regulation=reg_label,
        categories_block=categories_block,
        legal_context=legal_context,
    )

    raw = _gemini_call(prompt, max_tokens=8000, system=JUDGE_SYSTEM_PROMPT)
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        data: dict = json.loads(raw)
    except json.JSONDecodeError:
        data = {}

    return {
        cat["id"]: _parse_label_results(data.get(cat["name"], []), cat)
        for cat in categories
    }


# ═══════════════════════════════════════════════
# STEP 4 — AGGREGATE INTO REPORT
# ═══════════════════════════════════════════════

def generate_summary(url: str, regulation: str, overall_score: float,
                     total_critical: int, total_high: int,
                     worst_names: list[str]) -> str:
    """Build an executive summary from structured results without an LLM call."""
    reg_label = {
        "gdpr": "GDPR (EU 2016/679)",
        "pdpa": "Pakistan PDPA 2023",
        "both": "GDPR and Pakistan PDPA",
    }.get(regulation, regulation.upper())

    if overall_score >= 0.8:
        risk = "low risk"
        status = "largely compliant"
    elif overall_score >= 0.5:
        risk = "medium risk"
        status = "partially compliant"
    else:
        risk = "high risk"
        status = "significantly non-compliant"

    parts = [
        f"The privacy policy of {url or 'this website'} is {status} with {reg_label}, "
        f"scoring {overall_score:.0%} overall ({risk})."
    ]
    if total_critical:
        cats = f" in: {', '.join(worst_names)}" if worst_names else ""
        parts.append(
            f"There are {total_critical} critical violation(s) requiring immediate attention{cats}."
        )
    if total_high:
        parts.append(f"Additionally, {total_high} high-priority gap(s) were identified.")
    if overall_score < 1.0:
        parts.append(
            "Immediate remediation is recommended: add missing disclosures, specify lawful bases, "
            "and provide clear mechanisms for all data subject rights."
        )
    else:
        parts.append("No violations detected — policy meets all evaluated requirements.")
    return " ".join(parts)


# ═══════════════════════════════════════════════
# MAIN PIPELINE
# ═══════════════════════════════════════════════

class CompliancePipeline:

    def __init__(self, regulation: str = "gdpr"):
        """
        regulation: "gdpr" | "pdpa" | "both"
        Mirrors the extension's dropdown selection.
        """
        assert regulation in ("gdpr", "pdpa", "both"), "Invalid regulation"
        self.regulation = regulation

    def analyze(self, policy_text: str, url: str = "") -> ComplianceReport:
        """
        Full pipeline: decompose → retrieve (parallel) → batch-judge (parallel) → report.
        LLM calls: 1 decompose + 3 batch-judge = 4 total (was 17).
        """
        print(f"\n[pipeline] Analysing policy for: {url}")
        print(f"[pipeline] Regulation: {self.regulation.upper()}")
        print(f"[pipeline] Policy length: {len(policy_text.split())} words\n")

        # ── Step 1: Decompose + embed in parallel ────
        print("[1/3] Decomposing policy and embedding queries...")

        def _decompose():
            return decompose_policy(policy_text)

        def _embed():
            texts = [cat["query_hint"] for cat in CATEGORIES]
            return embed_queries_batch(texts)

        with ThreadPoolExecutor(max_workers=2) as ex:
            decompose_f = ex.submit(_decompose)
            embed_f     = ex.submit(_embed)

        category_excerpts = decompose_f.result()
        base_vectors      = embed_f.result()

        # Re-embed with excerpts now that decompose is done (fast local call)
        query_texts = [
            f"{cat['query_hint']}\n\n{category_excerpts.get(cat['name'], '')}"
            for cat in CATEGORIES
        ]
        query_vectors = embed_queries_batch(query_texts)

        # ── Step 2: Retrieve all 15 categories in parallel (Qdrant, fast) ──
        print("[2/3] Retrieving legal context for all categories...")

        def _retrieve(args):
            cat, excerpt, qvec = args
            try:
                return cat["id"], retrieve_for_category(
                    cat, self.regulation, excerpt, query_vec=qvec
                )
            except Exception as e:
                print(f"  [WARN] Retrieval failed for {cat['name']}: {e}")
                return cat["id"], []

        retrieve_tasks = [
            (cat, category_excerpts.get(cat["name"], ""), query_vectors[i])
            for i, cat in enumerate(CATEGORIES)
        ]
        with ThreadPoolExecutor(max_workers=15) as ex:
            retrieved_map: dict[int, list[dict]] = dict(ex.map(_retrieve, retrieve_tasks))

        # ── Step 3: Batch judge — 5 categories per call, 3 calls in parallel ──
        print("[3/3] Judging violations (3 parallel batched LLM calls)...")

        BATCH_SIZE = 5
        batches = [CATEGORIES[i : i + BATCH_SIZE] for i in range(0, len(CATEGORIES), BATCH_SIZE)]

        def _judge_batch(batch_cats: list[dict]) -> dict[int, list[LabelResult]]:
            try:
                return judge_categories_batch(
                    batch_cats, self.regulation, category_excerpts, retrieved_map
                )
            except Exception as e:
                print(f"  [WARN] Batch judge failed: {e}")
                return {
                    cat["id"]: [
                        LabelResult(
                            label=l["text"], priority=l["priority"],
                            compliant=False, violation=False, missing=True,
                            explanation="Judgment failed. Manual review required.",
                            policy_excerpt="", legal_basis="", recommendation="Review manually.",
                        )
                        for l in cat["labels"]
                    ]
                    for cat in batch_cats
                }

        label_results_map: dict[int, list[LabelResult]] = {}
        with ThreadPoolExecutor(max_workers=len(batches)) as ex:
            for result in ex.map(_judge_batch, batches):
                label_results_map.update(result)
                for cat_id, labels in result.items():
                    cat_name = next(c["name"] for c in CATEGORIES if c["id"] == cat_id)
                    print(f"  ✓ {cat_name}")

        # ── Aggregate ────────────────────────────────
        category_results: list[CategoryResult] = []
        for cat in CATEGORIES:
            label_results = label_results_map.get(cat["id"], [])
            total = len(label_results)
            compliant_count = sum(1 for r in label_results if r.compliant)
            category_results.append(CategoryResult(
                category_id=cat["id"],
                category_name=cat["name"],
                regulation=self.regulation,
                label_results=label_results,
                score=compliant_count / total if total else 0.0,
                critical_violations=sum(
                    1 for r in label_results if (r.violation or r.missing) and r.priority == "Critical"
                ),
                high_violations=sum(
                    1 for r in label_results if (r.violation or r.missing) and r.priority == "High"
                ),
            ))

        total_labels    = sum(len(c.label_results) for c in category_results)
        total_compliant = sum(sum(1 for r in c.label_results if r.compliant) for c in category_results)
        overall_score   = total_compliant / total_labels if total_labels else 0.0
        total_critical  = sum(c.critical_violations for c in category_results)
        total_high      = sum(c.high_violations for c in category_results)
        worst_names     = [c.category_name for c in sorted(category_results, key=lambda c: c.score)[:3] if c.has_violations]

        summary = generate_summary(url, self.regulation, overall_score, total_critical, total_high, worst_names)

        return ComplianceReport(
            url=url,
            regulation=self.regulation,
            timestamp=datetime.now(timezone.utc).isoformat(),
            overall_score=overall_score,
            total_critical_violations=total_critical,
            total_high_violations=total_high,
            category_results=category_results,
            summary=summary,
        )


# ═══════════════════════════════════════════════
# REPORT FORMATTER
# ═══════════════════════════════════════════════

def print_report(report: ComplianceReport):
    from rich.console import Console
    from rich.table import Table
    from rich import box

    console = Console()

    console.print(f"\n{'═'*60}", style="bold")
    console.print(f"  Privacy Policy Compliance Report", style="bold white")
    console.print(f"  URL: {report.url}", style="dim")
    console.print(f"  Regulation: {report.regulation.upper()}", style="dim")
    console.print(f"  Timestamp: {report.timestamp}", style="dim")
    console.print(f"{'═'*60}", style="bold")

    risk_color = {
        "HIGH RISK": "red",
        "MEDIUM RISK": "yellow",
        "LOW RISK": "green",
    }.get(report.risk_level, "white")

    console.print(f"\n  Risk Level:    [{risk_color}]{report.risk_level}[/{risk_color}]")
    console.print(f"  Overall Score: {report.overall_score:.0%}")
    console.print(f"  Critical:      {report.total_critical_violations} violation(s)")
    console.print(f"  High:          {report.total_high_violations} violation(s)")

    console.print(f"\n  Summary:\n  {report.summary}\n")

    # Per-category table
    table = Table(title="Category Breakdown", box=box.ROUNDED)
    table.add_column("Category",    style="cyan", width=28)
    table.add_column("Score",       justify="center", width=8)
    table.add_column("Status",      justify="center", width=12)
    table.add_column("Critical",    justify="center", width=10)
    table.add_column("High",        justify="center", width=8)

    for cat in report.category_results:
        sev_color = {
            "CRITICAL":   "red",
            "HIGH":       "yellow",
            "MEDIUM":     "orange3",
            "COMPLIANT":  "green",
        }.get(cat.severity, "white")

        table.add_row(
            cat.category_name,
            f"{cat.score:.0%}",
            f"[{sev_color}]{cat.severity}[/{sev_color}]",
            str(cat.critical_violations),
            str(cat.high_violations),
        )

    console.print(table)

    # Violation details
    for cat in report.category_results:
        if not cat.has_violations:
            continue

        console.print(f"\n[bold]{cat.category_name}[/bold]")
        for r in cat.label_results:
            if r.compliant:
                continue
            status = "[red]VIOLATION[/red]" if r.violation else "[yellow]MISSING[/yellow]"
            console.print(f"  {status} [{r.priority}] {r.label}")
            console.print(f"    → {r.explanation}", style="dim")
            if r.recommendation:
                console.print(f"    ✏ {r.recommendation}", style="italic")


def export_json(report: ComplianceReport) -> dict:
    """Serialise the report to a JSON-compatible dict for the browser extension."""
    return {
        "url": report.url,
        "regulation": report.regulation,
        "timestamp": report.timestamp,
        "risk_level": report.risk_level,
        "overall_score": round(report.overall_score, 3),
        "total_critical_violations": report.total_critical_violations,
        "total_high_violations": report.total_high_violations,
        "summary": report.summary,
        "categories": [
            {
                "id": cat.category_id,
                "name": cat.category_name,
                "score": round(cat.score, 3),
                "severity": cat.severity,
                "critical_violations": cat.critical_violations,
                "high_violations": cat.high_violations,
                "labels": [
                    {
                        "label": r.label,
                        "priority": r.priority,
                        "compliant": r.compliant,
                        "violation": r.violation,
                        "missing": r.missing,
                        "explanation": r.explanation,
                        "policy_excerpt": r.policy_excerpt,
                        "legal_basis": r.legal_basis,
                        "recommendation": r.recommendation,
                    }
                    for r in cat.label_results
                ],
            }
            for cat in report.category_results
        ],
    }


# ═══════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════
if __name__ == "__main__":
    import argparse
    import sys
    import httpx as hx

    parser = argparse.ArgumentParser(description="Analyse a privacy policy for GDPR/PDPA violations.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--url",  help="URL of the website whose privacy policy to fetch and analyse")
    group.add_argument("--file", help="Local text file containing the privacy policy")
    parser.add_argument(
        "--regulation", choices=["gdpr", "pdpa", "both"], default="gdpr",
        help="Which regulation to check against (default: gdpr)",
    )
    parser.add_argument("--json", action="store_true", help="Output raw JSON instead of rich text")
    args = parser.parse_args()

    # Load policy text
    if args.url:
        print(f"Fetching privacy policy from: {args.url}")
        resp = hx.get(args.url, follow_redirects=True, timeout=20)
        soup = __import__("bs4").BeautifulSoup(resp.content, "lxml")
        policy_text = soup.get_text(separator=" ", strip=True)
    else:
        with open(args.file) as f:
            policy_text = f.read()

    pipeline = CompliancePipeline(regulation=args.regulation)
    report = pipeline.analyze(policy_text=policy_text, url=args.url or args.file)

    if args.json:
        print(json.dumps(export_json(report), indent=2))
    else:
        print_report(report)
