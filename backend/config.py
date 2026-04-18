"""
Central configuration for the GDPR/PDPA RAG Compliance Pipeline.
Encodes all 15 categories, 54 labels, and their legal article mappings.
"""

import os
from dataclasses import dataclass, field
from typing import Literal

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# ─────────────────────────────────────────────
# API Keys (set via .env or environment)
# ─────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "")

# ─────────────────────────────────────────────
# Qdrant settings
# ─────────────────────────────────────────────
QDRANT_URL        = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY    = os.getenv("QDRANT_API_KEY", None)   # None = unauthenticated local
COLLECTION_NAME   = "compliance_docs"
VECTOR_SIZE       = 768    # sentence-transformers all-mpnet-base-v2

# ─────────────────────────────────────────────
# Retrieval settings
# ─────────────────────────────────────────────
TOP_K_PER_CATEGORY = 8     # chunks retrieved per category per query
EMBED_BATCH_SIZE   = 32    # sentence-transformers batch size
EMBED_MODEL        = "all-mpnet-base-v2"  # sentence-transformers model

# ─────────────────────────────────────────────
# LLM Judge
# ─────────────────────────────────────────────
JUDGE_MODEL = "llama-3.3-70b-versatile"

# ─────────────────────────────────────────────
# Regulation type
# ─────────────────────────────────────────────
RegulationType = Literal["gdpr", "pdpa", "both"]

# ─────────────────────────────────────────────
# 15 Categories × 54 Labels
# Each category maps to:
#   - labels: the checklist items from the spreadsheet
#   - gdpr_articles: specific GDPR articles that govern this category
#   - pdpa_sections: equivalent Pakistan PDPA 2023 bill sections
#   - edpb_guidelines: relevant EDPB guideline references for retrieval
# ─────────────────────────────────────────────
CATEGORIES: list[dict] = [
    {
        "id": 1,
        "name": "Data Collection",
        "labels": [
            {"text": "Specifies types of data collected",           "priority": "High"},
            {"text": "States purpose of collection",                 "priority": "High"},
            {"text": "Identifies data sources",                      "priority": "Medium"},
            {"text": "Informs voluntary/mandatory collection",       "priority": "Medium"},
        ],
        "gdpr_articles": ["5", "13", "14"],
        "pdpa_sections":  ["10", "11", "12"],
        "query_hint": "types of personal data collected, purpose of data collection, data sources, mandatory vs voluntary disclosure",
    },
    {
        "id": 2,
        "name": "Data Processing",
        "labels": [
            {"text": "States processing purpose",                    "priority": "High"},
            {"text": "Describes processing methods",                 "priority": "High"},
            {"text": "Specifies lawful basis (e.g., consent, contract)", "priority": "Critical"},
            {"text": "Limits secondary processing",                  "priority": "Medium"},
        ],
        "gdpr_articles": ["5", "6", "13", "14"],
        "pdpa_sections":  ["6", "7", "8"],
        "query_hint": "lawful basis for processing, processing purpose limitation, secondary processing restrictions",
    },
    {
        "id": 3,
        "name": "Third-Party Sharing",
        "labels": [
            {"text": "Identifies third parties",                     "priority": "High"},
            {"text": "States sharing purpose",                       "priority": "High"},
            {"text": "Requires consent for sharing",                 "priority": "Critical"},
            {"text": "Details data sharing agreements",              "priority": "Medium"},
        ],
        "gdpr_articles": ["13", "14", "26", "28", "44", "45", "46"],
        "pdpa_sections":  ["17", "18", "19"],
        "query_hint": "third party data sharing, processors, joint controllers, data transfer agreements, consent for sharing",
    },
    {
        "id": 4,
        "name": "User Rights and Control",
        "labels": [
            {"text": "Mentions user consent",                        "priority": "Critical"},
            {"text": "Provides opt-out mechanisms",                  "priority": "High"},
            {"text": "Right to object to processing",               "priority": "High"},
            {"text": "Right to access",                              "priority": "Critical"},
            {"text": "Right to rectification",                       "priority": "High"},
            {"text": "Right to erasure (GDPR Right to be Forgotten)","priority": "Critical"},
            {"text": "Right to restrict processing",                 "priority": "Medium"},
            {"text": "Right to data portability",                    "priority": "High"},
        ],
        "gdpr_articles": ["7", "15", "16", "17", "18", "20", "21"],
        "pdpa_sections":  ["11", "12", "13", "14", "15"],
        "query_hint": "right of access rectification erasure portability object restriction consent withdrawal",
    },
    {
        "id": 5,
        "name": "Data Security",
        "labels": [
            {"text": "Lists security measures",                      "priority": "Critical"},
            {"text": "Protects against unauthorized access",         "priority": "Critical"},
            {"text": "Uses encryption",                              "priority": "High"},
            {"text": "Implements anonymization/pseudonymization",    "priority": "Medium"},
        ],
        "gdpr_articles": ["5", "25", "32"],
        "pdpa_sections":  ["16"],
        "query_hint": "technical organizational security measures encryption pseudonymization unauthorized access data protection by design",
    },
    {
        "id": 6,
        "name": "Data Retention",
        "labels": [
            {"text": "Specifies retention period",                   "priority": "High"},
            {"text": "States retention purpose",                     "priority": "Medium"},
            {"text": "Details data deletion process",                "priority": "High"},
        ],
        "gdpr_articles": ["5", "13", "14", "17"],
        "pdpa_sections":  ["10", "15"],
        "query_hint": "data retention period storage limitation deletion criteria purpose of retention",
    },
    {
        "id": 7,
        "name": "Data Breach Notification",
        "labels": [
            {"text": "Notifies users of breaches",                   "priority": "Critical"},
            {"text": "Notifies authorities",                         "priority": "Critical"},
            {"text": "Specifies timely reporting",                   "priority": "High"},
        ],
        "gdpr_articles": ["33", "34"],
        "pdpa_sections":  ["17"],
        "query_hint": "personal data breach notification 72 hours supervisory authority communication to data subjects",
    },
    {
        "id": 8,
        "name": "Cross-Border Transfers",
        "labels": [
            {"text": "Mentions data transfers",                      "priority": "High"},
            {"text": "Details safeguards (e.g., SCCs, Binding Corporate Rules)", "priority": "Critical"},
            {"text": "Mentions data localization (PDPA)",            "priority": "High"},
            {"text": "Notifies users of transfers",                  "priority": "Medium"},
        ],
        "gdpr_articles": ["44", "45", "46", "47", "49"],
        "pdpa_sections":  ["20", "21"],
        "query_hint": "international data transfer adequacy decision standard contractual clauses binding corporate rules third country",
    },
    {
        "id": 9,
        "name": "Transparency",
        "labels": [
            {"text": "Uses clear policy language",                   "priority": "High"},
            {"text": "Ensures accessible policy location",           "priority": "Medium"},
            {"text": "Notifies users of policy changes",             "priority": "Medium"},
        ],
        "gdpr_articles": ["5", "12", "13", "14"],
        "pdpa_sections":  ["10", "11"],
        "query_hint": "transparent privacy notice clear plain language accessible policy change notification",
    },
    {
        "id": 10,
        "name": "Accountability",
        "labels": [
            {"text": "Appoints Data Protection Officer (DPO)",       "priority": "Critical"},
            {"text": "Conducts compliance audits",                   "priority": "High"},
            {"text": "Performs Data Protection Impact Assessments (DPIAs)", "priority": "Critical"},
        ],
        "gdpr_articles": ["24", "35", "37", "38", "39"],
        "pdpa_sections":  ["22", "23"],
        "query_hint": "data protection officer DPO DPIA impact assessment accountability records of processing",
    },
    {
        "id": 11,
        "name": "Children's Data",
        "labels": [
            {"text": "Specifies age threshold",                      "priority": "High"},
            {"text": "Requires parental consent",                    "priority": "Critical"},
            {"text": "Implements child-specific safeguards",         "priority": "High"},
        ],
        "gdpr_articles": ["8"],
        "pdpa_sections":  ["9"],
        "query_hint": "children minors age threshold parental consent information society services child-specific safeguards",
    },
    {
        "id": 12,
        "name": "Automated Decisions",
        "labels": [
            {"text": "Mentions profiling/automated decisions",       "priority": "High"},
            {"text": "States user rights against profiling",         "priority": "Critical"},
            {"text": "Provides opt-out for automated decisions",     "priority": "High"},
        ],
        "gdpr_articles": ["22"],
        "pdpa_sections":  ["24"],
        "query_hint": "automated decision-making profiling solely automated processing legal significant effects opt-out human review",
    },
    {
        "id": 13,
        "name": "Cookies & Tracking",
        "labels": [
            {"text": "Mentions cookie usage",                        "priority": "Medium"},
            {"text": "Provides cookie consent options",              "priority": "High"},
            {"text": "Details tracking purposes",                    "priority": "Medium"},
        ],
        "gdpr_articles": ["5", "6", "7"],
        "pdpa_sections":  ["6", "8"],
        "eprivacy_articles": ["5"],   # ePrivacy Directive Art. 5(3) — cookie consent
        "query_hint": "cookies tracking consent banner analytics advertising cookie purpose categories opt-out",
    },
    {
        "id": 14,
        "name": "Special Category Data",
        "labels": [
            {"text": "Mentions handling sensitive data (e.g., health, biometrics)", "priority": "Critical"},
            {"text": "Specifies additional safeguards",              "priority": "Critical"},
        ],
        "gdpr_articles": ["9", "10"],
        "pdpa_sections":  ["7"],
        "query_hint": "special categories sensitive data health biometric genetic racial political religious trade union explicit consent additional safeguards",
    },
    {
        "id": 15,
        "name": "Supervisory Authority",
        "labels": [
            {"text": "Provides supervisory authority contact",       "priority": "High"},
            {"text": "Details complaint lodging process",            "priority": "Medium"},
        ],
        "gdpr_articles": ["13", "14", "77", "78", "79"],
        "pdpa_sections":  ["30", "31"],
        "query_hint": "supervisory authority DPA complaint right to lodge complaint lead authority",
    },
]

# Fast lookup: category name → category dict
CATEGORY_MAP: dict[str, dict] = {c["name"]: c for c in CATEGORIES}
