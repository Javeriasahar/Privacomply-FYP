"""
Master list of all legal documents to ingest into the vector DB.

Each DocumentSource carries:
  - url          : direct download / HTML URL
  - title        : human-readable name
  - regulation   : "gdpr" | "pdpa" | "both" | "eprivacy"
  - doc_type     : "regulation" | "guidance" | "enforcement" | "checklist"
  - format       : "html" | "pdf"
  - categories   : list of category IDs this doc is relevant to (from config.py)
  - notes        : any caveats / access notes

HOW TO USE:
  Run `python ingest.py --download` to fetch all docs and build the vector DB.
  Documents are cached in ./doc_cache/ so re-runs skip already-downloaded files.
"""

from dataclasses import dataclass, field


@dataclass
class DocumentSource:
    url: str
    title: str
    regulation: str           # "gdpr" | "pdpa" | "both" | "eprivacy"
    doc_type: str             # "regulation" | "guidance" | "enforcement" | "checklist"
    fmt: str                  # "html" | "pdf"
    categories: list[int]     # category IDs from config.py CATEGORIES
    notes: str = ""


# ═══════════════════════════════════════════════════
#  LAYER 1 — PRIMARY LEGAL TEXTS (Ground Truth)
# ═══════════════════════════════════════════════════

LAYER_1_PRIMARY: list[DocumentSource] = [

    # ── GDPR ────────────────────────────────────────
    DocumentSource(
        url="https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679",
        title="GDPR — General Data Protection Regulation (EU) 2016/679 — Full Text",
        regulation="gdpr",
        doc_type="regulation",
        fmt="html",
        categories=list(range(1, 16)),   # all 15 categories
        notes="Authoritative source. Includes all 99 Articles + 173 Recitals.",
    ),

    # ── ePrivacy Directive ───────────────────────────
    DocumentSource(
        url="https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32002L0058",
        title="ePrivacy Directive 2002/58/EC — Directive on Privacy and Electronic Communications",
        regulation="eprivacy",
        doc_type="regulation",
        fmt="html",
        categories=[13],   # Cookies & Tracking
        notes="Art. 5(3) mandates cookie consent. Essential for category 13.",
    ),

    # ── Pakistan Personal Data Protection Bill 2023 ──
    DocumentSource(
        url="https://na.gov.pk/uploads/documents/1708428220_785.pdf",
        title="Pakistan Personal Data Protection Bill 2023 — National Assembly Draft",
        regulation="pdpa",
        doc_type="regulation",
        fmt="pdf",
        categories=list(range(1, 16)),
        notes=(
            "Latest draft as tabled in National Assembly 2024. "
            "Verify URL at https://na.gov.pk — drafts are periodically re-uploaded."
        ),
    ),

    # ── Pakistan PDPA Final Draft May 2023 (MOITT) ───
    DocumentSource(
        url="https://moitt.gov.pk/SiteImage/Misc/files/Final%20Draft%20Personal%20Data%20Protection%20Bill%20May%202023.pdf",
        title="Pakistan Personal Data Protection Bill — Final Draft May 2023 (MOITT)",
        regulation="pdpa",
        doc_type="regulation",
        fmt="pdf",
        categories=list(range(1, 16)),
        notes=(
            "MOITT final draft (May 2023). Defines three data tiers: regular, sensitive, critical. "
            "Establishes National Commission for Personal Data Protection (NCPDP). "
            "Requires local data hosting for critical personal data."
        ),
    ),

    # ── Pakistan PDPA 2021 Consultation Draft ────────
    DocumentSource(
        url="https://moitt.gov.pk/SiteImage/Misc/files/25821%20DPA%20Bill%20Consultation%20Draft(1).pdf",
        title="Pakistan Personal Data Protection Bill — 2021 Consultation Draft (MOITT)",
        regulation="pdpa",
        doc_type="regulation",
        fmt="pdf",
        categories=list(range(1, 16)),
        notes=(
            "MOITT consultation draft (2021). Useful for understanding legislative intent and evolution "
            "of PDPA provisions on consent, data subject rights, and enforcement."
        ),
    ),

    # ── EU AI Act 2024 ───────────────────────────────────────────────────────
    DocumentSource(
        url="https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202401689",
        title="EU AI Act — Regulation (EU) 2024/1689 on Artificial Intelligence",
        regulation="gdpr",
        doc_type="regulation",
        fmt="html",
        categories=[2, 5, 10, 12, 14],
        notes=(
            "Entered into force August 2024. High-risk AI obligations intersect with GDPR: "
            "data governance (Art. 10), transparency (Art. 13), automated decision-making (Art. 22 GDPR + AI Act), "
            "biometric systems (special category), and accountability records."
        ),
    ),

    # ── Pakistan PDPA Clean Draft ────────────────────────────────────────────
    DocumentSource(
        url="https://moitt.gov.pk/SiteImage/Downloads/Personal%20Data%20Protection%20Bill%20without%20track%20changes.pdf",
        title="Pakistan Personal Data Protection Bill — Clean Draft (MOITT, without track changes)",
        regulation="pdpa",
        doc_type="regulation",
        fmt="pdf",
        categories=list(range(1, 16)),
        notes=(
            "Clean version of the PDPA bill without tracked changes. "
            "Use as the authoritative readable text alongside the May 2023 draft."
        ),
    ),

    # ── Prevention of Electronic Crimes Act (PECA) 2016 ──
    DocumentSource(
        url="https://www.na.gov.pk/uploads/documents/1470910659_707.pdf",
        title="Prevention of Electronic Crimes Act (PECA) 2016 — Pakistan",
        regulation="pdpa",
        doc_type="regulation",
        fmt="pdf",
        categories=[2, 3, 4, 5, 7, 9, 15],
        notes=(
            "Pakistan's primary cybercrime law. Section 16 prohibits obtaining/transmitting personal data "
            "without consent. FIA and PTA have enforcement authority. Predates PDPA; sets baseline for "
            "data security obligations and unauthorized access offences."
        ),
    ),
]


# ═══════════════════════════════════════════════════
#  LAYER 2 — EDPB GUIDELINES (Interpretive Authority)
# ═══════════════════════════════════════════════════

LAYER_2_EDPB: list[DocumentSource] = [

    DocumentSource(
        url="https://edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf",
        title="EDPB Guidelines 05/2020 — Consent under GDPR",
        regulation="gdpr",
        doc_type="guidance",
        fmt="pdf",
        categories=[2, 3, 4, 11, 13, 14],
        notes="Covers valid consent, freely given, specific, informed, unambiguous. Critical for lawful basis.",
    ),

    DocumentSource(
        url="https://edpb.europa.eu/system/files/2022-01/edpb_guidelines_012022_dsrightofaccess_v2_en.pdf",
        title="EDPB Guidelines 01/2022 — Right of Access (Article 15 GDPR)",
        regulation="gdpr",
        doc_type="guidance",
        fmt="pdf",
        categories=[4],
        notes="Detailed guidance on implementing right of access. Covers scope, format, timeframes.",
    ),

    DocumentSource(
        url="https://edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202012_transparencyunder_gdpr_en.pdf",
        title="EDPB Guidelines 3/2018 — Transparency under GDPR (Articles 12, 13, 14)",
        regulation="gdpr",
        doc_type="guidance",
        fmt="pdf",
        categories=[1, 2, 9],
        notes="How to write compliant, accessible, clear privacy notices. Directly governs policy language.",
    ),

    DocumentSource(
        url="https://edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_201903_processingpersonaldataunderlockdown_en.pdf",
        title="EDPB Guidelines 2/2019 — Processing of Personal Data under Article 6(1)(b)",
        regulation="gdpr",
        doc_type="guidance",
        fmt="pdf",
        categories=[2],
        notes="Lawful basis: 'necessary for performance of a contract'. Clarifies scope of Art. 6(1)(b).",
    ),

    DocumentSource(
        url="https://edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_datasubjectrights_portability_en.pdf",
        title="EDPB Guidelines on Right to Data Portability",
        regulation="gdpr",
        doc_type="guidance",
        fmt="pdf",
        categories=[4],
        notes="Covers Article 20 — scope, machine-readable formats, direct transfer obligations.",
    ),

    DocumentSource(
        url="https://edpb.europa.eu/sites/default/files/files/file1/edpb-guidelines-092022-pseudonymisation_en.pdf",
        title="EDPB Guidelines 01/2021 — Pseudonymisation",
        regulation="gdpr",
        doc_type="guidance",
        fmt="pdf",
        categories=[5],
        notes="Technical guidance on pseudonymisation as a security measure under Art. 32.",
    ),

    DocumentSource(
        url="https://edpb.europa.eu/sites/default/files/files/file1/en_edpb_guidelines_202001_databreachnotificationexamples_v2.pdf",
        title="EDPB Guidelines 01/2021 — Data Breach Examples & Notification",
        regulation="gdpr",
        doc_type="guidance",
        fmt="pdf",
        categories=[7],
        notes="Case-based guidance on when Art. 33 / Art. 34 breach notification is triggered.",
    ),

    DocumentSource(
        url="https://edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202003_dataprotectionbydesign_and_by_default_en.pdf",
        title="EDPB Guidelines 4/2019 — Data Protection by Design and by Default (Article 25)",
        regulation="gdpr",
        doc_type="guidance",
        fmt="pdf",
        categories=[5, 10],
        notes="Privacy by design obligations. Covers data minimisation, purpose limitation, security defaults.",
    ),

    DocumentSource(
        url="https://edpb.europa.eu/sites/default/files/files/file1/edpb_recommendations_202001_supplementarymeasurestransferstools_en.pdf",
        title="EDPB Recommendations 01/2020 — Supplementary Measures for Cross-Border Transfers",
        regulation="gdpr",
        doc_type="guidance",
        fmt="pdf",
        categories=[8],
        notes="Post-Schrems II guidance. Covers SCCs, BCRs, and supplementary technical measures.",
    ),

    DocumentSource(
        url="https://edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_201903_dpia_v2_en.pdf",
        title="EDPB Guidelines 4/2022 — Data Protection Impact Assessments (DPIA)",
        regulation="gdpr",
        doc_type="guidance",
        fmt="pdf",
        categories=[10],
        notes="When is a DPIA mandatory? Art. 35 criteria, methodology, and documentation.",
    ),

    DocumentSource(
        url="https://edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202108_children_en.pdf",
        title="EDPB Guidelines 02/2023 — Age Appropriate Design for Children's Data",
        regulation="gdpr",
        doc_type="guidance",
        fmt="pdf",
        categories=[11],
        notes="Art. 8 — age verification, parental consent mechanisms, child-specific design requirements.",
    ),

    DocumentSource(
        url="https://edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202105_automated_en.pdf",
        title="EDPB Guidelines on Automated Individual Decision-Making (Article 22)",
        regulation="gdpr",
        doc_type="guidance",
        fmt="pdf",
        categories=[12],
        notes="Covers profiling, solely automated decisions with legal effects, opt-out rights.",
    ),

    DocumentSource(
        url="https://edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_201906_specialcategories_en.pdf",
        title="EDPB Guidelines on Special Categories of Personal Data (Article 9)",
        regulation="gdpr",
        doc_type="guidance",
        fmt="pdf",
        categories=[14],
        notes="Health, biometric, genetic, racial, political, religious data. Explicit consent requirements.",
    ),

    # ── 2024–2026 additions ──────────────────────────────────────────────────

    DocumentSource(
        url="https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202401_legitimateinterest_en.pdf",
        title="EDPB Guidelines 1/2024 — Legitimate Interest as Lawful Basis (Article 6(1)(f))",
        regulation="gdpr",
        doc_type="guidance",
        fmt="pdf",
        categories=[2],
        notes="Most recent EDPB guidance on legitimate interest. Defines balancing test, necessity, and overriding interests. Critical for assessing lawful basis claims.",
    ),

    DocumentSource(
        url="https://www.edpb.europa.eu/system/files/2024-12/edpb_opinion_202428_ai-models_en.pdf",
        title="EDPB Opinion 28/2024 — AI Models and Data Protection",
        regulation="gdpr",
        doc_type="guidance",
        fmt="pdf",
        categories=[2, 12, 14],
        notes="Addresses GDPR obligations when training and deploying AI/ML models. Covers lawful basis for training data, profiling, and special category risks.",
    ),

    DocumentSource(
        url="https://www.edpb.europa.eu/system/files/2024-05/edpb_opinion_202411_facialrecognitionairports_en.pdf",
        title="EDPB Opinion 11/2024 — Facial Recognition at Airports",
        regulation="gdpr",
        doc_type="guidance",
        fmt="pdf",
        categories=[5, 12, 14],
        notes="Biometric data processing in public spaces. Covers Art. 9 safeguards, automated decision risks, and proportionality under GDPR Art. 5.",
    ),

    DocumentSource(
        url="https://www.edpb.europa.eu/system/files/2023-05/final_for_issue_ov_transfers_decision_12-05-23.pdf",
        title="EDPB Opinion 5/2023 — EU-US Data Privacy Framework Adequacy Decision",
        regulation="gdpr",
        doc_type="guidance",
        fmt="pdf",
        categories=[8],
        notes="EDPB assessment of the EU-US Data Privacy Framework. Key reference for adequacy-based transfer mechanism post-Schrems II.",
    ),

    DocumentSource(
        url="https://www.edpb.europa.eu/system/files/2026-02/edpb_cef-report_2025_right-to-erasure_en.pdf",
        title="EDPB CEF Report 2025 — Right to Erasure (Article 17 GDPR)",
        regulation="gdpr",
        doc_type="guidance",
        fmt="pdf",
        categories=[4, 6],
        notes="Coordinated enforcement findings on Art. 17 right to erasure across EU DPAs. Covers deletion timelines, exceptions, and third-party notification obligations.",
    ),

    DocumentSource(
        url="https://www.edpb.europa.eu/system/files/2025-01/edpb_cef-report-2024_20250116_rightofaccess_en.pdf",
        title="EDPB CEF Report 2024 — Right of Access (Article 15 GDPR)",
        regulation="gdpr",
        doc_type="guidance",
        fmt="pdf",
        categories=[4],
        notes="Coordinated enforcement report on Art. 15 right of access. Identifies common violations: delayed responses, incomplete disclosures, unlawful identity verification demands.",
    ),
]


# ═══════════════════════════════════════════════════
#  LAYER 3 — ICO GUIDANCE (Practical Compliance)
# ═══════════════════════════════════════════════════
# ICO (UK) guides are the most practically written — great for pattern matching.
# These are fetchable as HTML.

LAYER_3_ICO: list[DocumentSource] = [

    DocumentSource(
        url="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/",
        title="ICO Guide — Lawful Basis for Processing",
        regulation="gdpr",
        doc_type="guidance",
        fmt="html",
        categories=[2],
        notes="Practical checklist for each of the 6 lawful bases. Cross-check with Art. 6.",
    ),

    DocumentSource(
        url="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/",
        title="ICO Guide — Individual Rights (All Rights)",
        regulation="gdpr",
        doc_type="guidance",
        fmt="html",
        categories=[4],
        notes="Full guide covering all 8 individual rights under UK GDPR. Policy checklist goldmine.",
    ),

    DocumentSource(
        url="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/security/a-guide-to-data-security/",
        title="ICO Guide — Data Security (Article 32)",
        regulation="gdpr",
        doc_type="guidance",
        fmt="html",
        categories=[5],
        notes="Practical security requirements: encryption, access control, testing, staff training.",
    ),

    DocumentSource(
        url="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-by-design-and-default/",
        title="ICO Guide — Data Protection by Design and Default",
        regulation="gdpr",
        doc_type="guidance",
        fmt="html",
        categories=[5, 10],
    ),

    DocumentSource(
        url="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/",
        title="ICO Guide — Data Protection Impact Assessments (DPIAs)",
        regulation="gdpr",
        doc_type="guidance",
        fmt="html",
        categories=[10],
    ),

    DocumentSource(
        url="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/cookies/",
        title="ICO Guide — Cookies and Similar Technologies",
        regulation="gdpr",
        doc_type="guidance",
        fmt="html",
        categories=[13],
        notes="Covers what cookies require consent, how consent must be obtained, cookie audits.",
    ),

    DocumentSource(
        url="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code/",
        title="ICO — Children's Code (Age Appropriate Design)",
        regulation="gdpr",
        doc_type="guidance",
        fmt="html",
        categories=[11],
        notes="15 standards for online services likely accessed by children. Very specific.",
    ),

    DocumentSource(
        url="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/",
        title="ICO Guide — International Data Transfers",
        regulation="gdpr",
        doc_type="guidance",
        fmt="html",
        categories=[8],
    ),

    DocumentSource(
        url="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/",
        title="ICO Guide — Data Sharing (Third Parties)",
        regulation="gdpr",
        doc_type="guidance",
        fmt="html",
        categories=[3],
        notes="When and how to share data with third parties. Covers processors vs controllers.",
    ),

    DocumentSource(
        url="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/",
        title="ICO Guide — Consent (Deep Dive)",
        regulation="gdpr",
        doc_type="guidance",
        fmt="html",
        categories=[2, 4, 13],
        notes="Granular guidance: pre-ticked boxes, bundled consent, withdrawal mechanisms.",
    ),

    DocumentSource(
        url="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/what-is-valid-consent/",
        title="ICO Guide — What is Valid Consent?",
        regulation="gdpr",
        doc_type="guidance",
        fmt="html",
        categories=[2, 4],
        notes="Specific sub-guide on validity requirements for consent: freely given, specific, informed, unambiguous. Practical checklist companion to the main consent guide.",
    ),
]


# ═══════════════════════════════════════════════════
#  LAYER 5 — PDPA GUIDANCE (Pakistan Regulatory Context)
# ═══════════════════════════════════════════════════
# Pakistan-specific regulatory documents that interpret or supplement the PDPA.
# PTA is the primary enforcement authority for telecom sector until NCPDP is established.

LAYER_5_PDPA_GUIDANCE: list[DocumentSource] = [

    # ── PTA Critical Telecom Data & Infrastructure Security Regulations 2025 ──
    DocumentSource(
        url="https://www.pta.gov.pk/assets/media/2025-10-29-Critical-Telecom-Data-and-Infrastructure-Security-Regulations-2025.pdf",
        title="PTA — Critical Telecom Data and Infrastructure Security Regulations 2025",
        regulation="pdpa",
        doc_type="guidance",
        fmt="pdf",
        categories=[5, 7, 8, 10],
        notes=(
            "Mandatory for all PTA-licensed operators. Requires local data hosting for critical data, "
            "zero-trust architecture, CERT teams, data classification (Critical/High/Medium/Low), "
            "event logging, and confidentiality agreements. Most current PTA data security standard."
        ),
    ),

    # ── PTA National Cyber Security Framework for Telecom 2022 ──
    DocumentSource(
        url="https://www.pta.gov.pk/assets/media/national_cs_framework_for_telecom_17-10-2022.pdf",
        title="PTA — National Cyber Security Framework for Telecom Sector 2022",
        regulation="pdpa",
        doc_type="guidance",
        fmt="pdf",
        categories=[5, 7, 10],
        notes=(
            "Comprehensive cybersecurity controls for telecom operators. Covers data protection by design, "
            "incident response, access control, encryption standards, and security audits aligned with "
            "ISO 27001 and NIST frameworks."
        ),
    ),

    # ── PTA Cyber Security Strategy 2023–2028 ──
    DocumentSource(
        url="https://pta.gov.pk/assets/media/cyber_security_strategy_telecom_sector_2023_2028_11-12-2023.pdf",
        title="PTA — Cyber Security Strategy for Telecom Sector 2023–2028",
        regulation="pdpa",
        doc_type="guidance",
        fmt="pdf",
        categories=[5, 7, 10],
        notes=(
            "Five-year national strategy for telecom data security. Establishes incident reporting timelines, "
            "data breach notification obligations for telecom operators, and risk management frameworks "
            "under PDPA alignment."
        ),
    ),

    # ── Right to Information Act 2017 ──
    DocumentSource(
        url="https://rti.gov.pk/SiteImage/Misc/files/The-Right-of-Access-to-Information-Act-2017-Gazette.pdf",
        title="Right of Access to Information Act 2017 — Pakistan",
        regulation="pdpa",
        doc_type="regulation",
        fmt="pdf",
        categories=[4, 9, 15],
        notes=(
            "Establishes citizens' right to access government-held information. Complements PDPA "
            "data subject access rights (PDPA s.12). Pakistan Information Commission adjudicates "
            "access disputes. Relevant to transparency and supervisory authority categories."
        ),
    ),

    # ── Digital Pakistan Policy 2018 ──
    DocumentSource(
        url="https://moitt.gov.pk/SiteImage/Misc/files/DIGITAL%20PAKISTAN%20POLICY.pdf",
        title="MOITT — Digital Pakistan Policy 2018",
        regulation="pdpa",
        doc_type="guidance",
        fmt="pdf",
        categories=[1, 2, 9, 10],
        notes=(
            "National data governance framework that laid the policy foundation for PDPA. "
            "Sets data localisation goals, accountability standards for digital service providers, "
            "and transparency requirements for government data processing."
        ),
    ),

    # ── National Cyber Security Policy 2021 (MOITT) ──
    DocumentSource(
        url="https://moitt.gov.pk/SiteImage/Misc/files/National%20Cyber%20Security%20Policy%202021%20Final.pdf",
        title="MOITT — National Cyber Security Policy 2021",
        regulation="pdpa",
        doc_type="guidance",
        fmt="pdf",
        categories=[5, 7, 10],
        notes=(
            "Pakistan's national cybersecurity policy. Mandates security-by-design, incident response plans, "
            "breach notification obligations, and sector-specific data protection controls aligned with PDPA security requirements."
        ),
    ),

    # ── PTA Cyber Security Annual Report 2024-25 ──
    DocumentSource(
        url="https://www.pta.gov.pk/assets/media/2025-10-16-CS-Annual-Report-2024-25.pdf",
        title="PTA — Cyber Security Annual Report 2024–25",
        regulation="pdpa",
        doc_type="guidance",
        fmt="pdf",
        categories=[5, 7, 10],
        notes=(
            "PTA's latest annual cybersecurity report. Documents enforcement actions, incident statistics, "
            "and emerging threat landscape for Pakistani operators. Useful for breach notification and security category context."
        ),
    ),

    # ── PTA Consumer Protection Regulations (HTML) ──
    DocumentSource(
        url="http://nasirlawsite.com/laws/tcpr.htm",
        title="PTA Telecom Consumer Protection Regulations 2009",
        regulation="pdpa",
        doc_type="guidance",
        fmt="html",
        categories=[1, 2, 3, 4, 9],
        notes=(
            "Requires telecom operators to protect subscriber personal data, provide transparent "
            "data handling disclosures, and establish complaint mechanisms. Prohibits illegal use "
            "of personal data. Penalties up to PKR 10 million or 3 years imprisonment."
        ),
    ),
]


# ═══════════════════════════════════════════════════
#  LAYER 4 — ENFORCEMENT DECISIONS (Violation Patterns)
# ═══════════════════════════════════════════════════
# These are actual DPA rulings — the closest thing to labeled violation examples.

LAYER_4_ENFORCEMENT: list[DocumentSource] = [

    DocumentSource(
        url="https://www.cnil.fr/sites/cnil/files/2022-01/san-2022-001.pdf",
        title="CNIL Fine — Google LLC (2022) — Cookie Consent Violations",
        regulation="gdpr",
        doc_type="enforcement",
        fmt="pdf",
        categories=[13, 4],
        notes="€150M fine. Cookie consent opt-out harder than opt-in. Key pattern for category 13.",
    ),

    DocumentSource(
        url="https://www.cnil.fr/sites/cnil/files/2022-01/san-2022-002.pdf",
        title="CNIL Fine — Facebook/Meta (2022) — Cookie Consent Violations",
        regulation="gdpr",
        doc_type="enforcement",
        fmt="pdf",
        categories=[13, 4],
        notes="€60M fine. Same cookie consent pattern as Google ruling.",
    ),

    DocumentSource(
        url="https://edpb.europa.eu/system/files/2023-05/edpb_bindingdecision_202301_ie_sa_re_meta_instagram_en.pdf",
        title="EDPB Binding Decision — Meta/Instagram Children's Data",
        regulation="gdpr",
        doc_type="enforcement",
        fmt="pdf",
        categories=[11, 4],
        notes="€405M fine. Processing children's data without adequate safeguards.",
    ),

    DocumentSource(
        url="https://www.datenschutz-hamburg.de/assets/pdf/Beschluss-HmbBfDI-WhatsApp.pdf",
        title="Hamburg DPA Decision — WhatsApp Transparency Violations",
        regulation="gdpr",
        doc_type="enforcement",
        fmt="pdf",
        categories=[9, 1, 3],
        notes="Transparency / third-party sharing violations. Privacy policy language deficiencies.",
    ),
]


# ═══════════════════════════════════════════════════
#  LAYER 6 — RESEARCH PAPERS (Privacy Policy Analysis)
# ═══════════════════════════════════════════════════
# Peer-reviewed academic work on automated privacy policy analysis.
# Provides pattern-level understanding of what compliance/non-compliance looks like in real policies.

LAYER_6_RESEARCH: list[DocumentSource] = [

    DocumentSource(
        url="https://arxiv.org/pdf/2309.10238",
        title="PolicyGPT: Automated Analysis of Privacy Policies with Large Language Models (2023)",
        regulation="both",
        doc_type="research",
        fmt="pdf",
        categories=list(range(1, 16)),
        notes=(
            "Uses GPT-4 to classify privacy policy segments across OPP-115 categories. "
            "State-of-the-art benchmark for automated compliance detection across all 15 categories."
        ),
    ),

    DocumentSource(
        url="https://arxiv.org/pdf/2001.02479",
        title="MAPS: Scaling Privacy Compliance Analysis to a Million Apps (2020)",
        regulation="both",
        doc_type="research",
        fmt="pdf",
        categories=[1, 2, 3, 4, 13],
        notes=(
            "Large-scale automated analysis of privacy policies across mobile apps. "
            "Identifies patterns of missing disclosures in data collection, sharing, and consent."
        ),
    ),

    DocumentSource(
        url="https://arxiv.org/pdf/1802.02561",
        title="Polisis: Automated Analysis and Presentation of Privacy Policies (2018)",
        regulation="both",
        doc_type="research",
        fmt="pdf",
        categories=list(range(1, 16)),
        notes=(
            "Foundational NLP model for privacy policy analysis. Introduces the hierarchical multi-label "
            "classification framework that underpins OPP-115 and subsequent compliance tools."
        ),
    ),

    DocumentSource(
        url="https://dl.acm.org/doi/pdf/10.1145/3442381.3450022",
        title="Automated Detection of GDPR Disclosure Requirements in Privacy Policies (WWW 2021)",
        regulation="gdpr",
        doc_type="research",
        fmt="pdf",
        categories=[1, 2, 3, 4, 6, 8, 9],
        notes=(
            "ACM WWW 2021. Maps GDPR Art. 13/14 mandatory disclosure requirements to policy text "
            "using NLP. Benchmark dataset and fine-grained label taxonomy for GDPR compliance."
        ),
    ),

    DocumentSource(
        url="https://www.usenix.org/system/files/sec22-bollinger.pdf",
        title="Automating Cookie Consent and GDPR Violation Detection (USENIX Sec 2022)",
        regulation="gdpr",
        doc_type="research",
        fmt="pdf",
        categories=[13, 4],
        notes=(
            "Large-scale automated audit of cookie consent banners. "
            "Identifies dark patterns, consent bypass techniques, and violations of ePrivacy/GDPR Art. 7."
        ),
    ),

    DocumentSource(
        url="https://www.usenix.org/system/files/usenixsecurity23-cui.pdf",
        title="PrivacyLens: Evaluating Privacy Policy Compliance of Mobile Apps (USENIX Sec 2023)",
        regulation="both",
        doc_type="research",
        fmt="pdf",
        categories=[1, 2, 3, 4, 13],
        notes=(
            "Automated framework to detect inconsistencies between app data practices and privacy policy disclosures. "
            "Covers data collection, sharing, and user rights categories."
        ),
    ),

    DocumentSource(
        url="https://usableprivacy.org/data",
        title="OPP-115 Corpus — Usable Privacy Policy Project Dataset",
        regulation="both",
        doc_type="research",
        fmt="html",
        categories=list(range(1, 16)),
        notes=(
            "Gold-standard annotated dataset of 115 privacy policies with segment-level labels across 10 data practice categories. "
            "Foundational reference for privacy policy compliance classification."
        ),
    ),
]


# ═══════════════════════════════════════════════════
#  ALL SOURCES — used by ingest.py
# ═══════════════════════════════════════════════════
ALL_SOURCES: list[DocumentSource] = (
    LAYER_1_PRIMARY
    + LAYER_2_EDPB
    + LAYER_3_ICO
    + LAYER_4_ENFORCEMENT
    + LAYER_5_PDPA_GUIDANCE
    + LAYER_6_RESEARCH
)

# Convenience: sources by regulation
def sources_for(regulation: str) -> list[DocumentSource]:
    """Return docs relevant to the given regulation ('gdpr', 'pdpa', 'both')."""
    if regulation == "both":
        return ALL_SOURCES
    return [
        s for s in ALL_SOURCES
        if s.regulation in (regulation, "both", "eprivacy")
    ]
