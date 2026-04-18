# PrivaComply RAG Pipeline

GDPR / Pakistan PDPA privacy policy violation detector using RAG.

---

## Architecture

```
Scraped Privacy Policy Text
         │
         ▼
┌──────────────────────┐
│   Decompose (LLM)    │  Split policy into per-category excerpts
└─────────┬────────────┘
          │ 15 category excerpts
          ▼
┌──────────────────────┐
│  Retrieve (Qdrant)   │  For each category: embed + search
│  filtered by:        │  regulation + category_id
│  - regulation        │
│  - category_id       │
└─────────┬────────────┘
          │ top-8 legal chunks per category
          ▼
┌──────────────────────┐
│   Judge (Claude)     │  Check each of 54 labels:
│                      │  compliant / violation / missing
└─────────┬────────────┘
          │
          ▼
┌──────────────────────┐
│  ComplianceReport    │  Score, severity, recommendations
│  (JSON + CLI output) │  → browser extension / API
└──────────────────────┘
```

---

## Quick Start

### 1. Start Qdrant (Docker)
```bash
docker run -p 6333:6333 qdrant/qdrant
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure
```bash
cp .env.example .env
# Fill in OPENAI_API_KEY and ANTHROPIC_API_KEY
```

### 4. Ingest documents
```bash
# All documents (GDPR + PDPA)
python main.py ingest --regulation both

# GDPR only
python main.py ingest --regulation gdpr

# Dry run (see what would be ingested)
python main.py ingest --dry-run
```

### 5. Analyse a privacy policy
```bash
# By URL
python main.py analyze --url https://example.com/privacy --regulation gdpr

# By file
python main.py analyze --file policy.txt --regulation both

# JSON output (for extension integration)
python main.py analyze --url https://example.com/privacy --output-json

# Save to file
python main.py analyze --url https://example.com/privacy --output-file report.json
```

### 6. Run as server (for browser extension)
```bash
python main.py serve --port 8000
```

Extension sends:
```json
POST http://localhost:8000/analyze
{
  "policy_text": "<scraped policy text>",
  "url": "https://example.com",
  "regulation": "gdpr"
}
```

---

## Document Sources

### Layer 1 — Primary Legal Texts

| Document | URL | Regulations |
|---|---|---|
| GDPR Full Text (EU 2016/679) | https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679 | GDPR |
| ePrivacy Directive 2002/58/EC | https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32002L0058 | ePrivacy |
| Pakistan PDPA Bill 2023 (National Assembly) | https://na.gov.pk/uploads/documents/1708428220_785.pdf | PDPA |
| Pakistan PDPA Bill (MOITT fallback) | https://moitt.gov.pk/SiteImage/Policy/Personal%20Data%20Protection%20Bill.pdf | PDPA |

### Layer 2 — EDPB Guidelines

| Document | URL | Categories |
|---|---|---|
| Consent Guidelines 05/2020 | https://edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf | 2,3,4,11,13,14 |
| Right of Access Guidelines 01/2022 | https://edpb.europa.eu/system/files/2022-01/edpb_guidelines_012022_dsrightofaccess_v2_en.pdf | 4 |
| Transparency Guidelines 3/2018 | https://edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202012_transparencyunder_gdpr_en.pdf | 1,2,9 |
| Data Portability Guidelines | https://edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_datasubjectrights_portability_en.pdf | 4 |
| Data Breach Examples 01/2021 | https://edpb.europa.eu/sites/default/files/files/file1/en_edpb_guidelines_202001_databreachnotificationexamples_v2.pdf | 7 |
| Privacy by Design Guidelines 4/2019 | https://edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202003_dataprotectionbydesign_and_by_default_en.pdf | 5,10 |
| Cross-Border Transfer Recommendations | https://edpb.europa.eu/sites/default/files/files/file1/edpb_recommendations_202001_supplementarymeasurestransferstools_en.pdf | 8 |
| DPIA Guidelines | https://edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_201903_dpia_v2_en.pdf | 10 |
| Children's Data Guidelines | https://edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202108_children_en.pdf | 11 |
| Automated Decision-Making Guidelines | https://edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202105_automated_en.pdf | 12 |
| Special Categories Guidelines | https://edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_201906_specialcategories_en.pdf | 14 |

### Layer 3 — ICO Guidance (UK)

| Document | URL | Categories |
|---|---|---|
| Lawful Basis Guide | https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/ | 2 |
| Individual Rights Guide | https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/ | 4 |
| Data Security Guide | https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/security/a-guide-to-data-security/ | 5 |
| Privacy by Design Guide | https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-by-design-and-default/ | 5,10 |
| DPIA Guide | https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/ | 10 |
| Cookies Guide | https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/cookies/ | 13 |
| Children's Code | https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code/ | 11 |
| International Transfers | https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/ | 8 |
| Data Sharing Guide | https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/ | 3 |
| Consent Guide | https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/ | 2,4,13 |

### Layer 4 — Enforcement Decisions

| Document | URL | Categories |
|---|---|---|
| CNIL v. Google (Cookies, €150M) | https://www.cnil.fr/sites/cnil/files/2022-01/san-2022-001.pdf | 13,4 |
| CNIL v. Facebook (Cookies, €60M) | https://www.cnil.fr/sites/cnil/files/2022-01/san-2022-002.pdf | 13,4 |
| EDPB — Meta/Instagram Children's (€405M) | https://edpb.europa.eu/system/files/2023-05/edpb_bindingdecision_202301_ie_sa_re_meta_instagram_en.pdf | 11,4 |
| Hamburg DPA — WhatsApp Transparency | https://www.datenschutz-hamburg.de/assets/pdf/Beschluss-HmbBfDI-WhatsApp.pdf | 9,1,3 |

---

## Categories & GDPR/PDPA Mapping

| # | Category | GDPR Articles | PDPA Sections |
|---|---|---|---|
| 1 | Data Collection | 5, 13, 14 | 10, 11, 12 |
| 2 | Data Processing | 5, 6, 13, 14 | 6, 7, 8 |
| 3 | Third-Party Sharing | 13, 14, 26, 28, 44–46 | 17, 18, 19 |
| 4 | User Rights and Control | 7, 15–18, 20, 21 | 11–15 |
| 5 | Data Security | 5, 25, 32 | 16 |
| 6 | Data Retention | 5, 13, 14, 17 | 10, 15 |
| 7 | Data Breach Notification | 33, 34 | 17 |
| 8 | Cross-Border Transfers | 44–47, 49 | 20, 21 |
| 9 | Transparency | 5, 12, 13, 14 | 10, 11 |
| 10 | Accountability | 24, 35, 37–39 | 22, 23 |
| 11 | Children's Data | 8 | 9 |
| 12 | Automated Decisions | 22 | 24 |
| 13 | Cookies & Tracking | 5, 6, 7 + ePrivacy Art. 5 | 6, 8 |
| 14 | Special Category Data | 9, 10 | 7 |
| 15 | Supervisory Authority | 13, 14, 77–79 | 30, 31 |

---

## Project Structure

```
rag_compliance/
├── config.py            — categories, labels, article mappings, settings
├── document_sources.py  — all document URLs with metadata
├── models.py            — data classes (DocumentChunk, ComplianceReport, etc.)
├── ingest.py            — download → parse → chunk → embed → upsert to Qdrant
├── pipeline.py          — decompose → retrieve → judge → report
├── main.py              — CLI + HTTP server for browser extension
├── requirements.txt
└── .env.example
```
