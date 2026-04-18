"""
Privacy Policy Scraper

Given any website URL (e.g. www.google.com), this module:
  1. Normalises the URL (adds https:// if missing)
  2. Finds the privacy policy page (common paths + footer link scan)
  3. Fetches and parses the HTML
  4. Strips noise: nav, header, footer, scripts, banners, cookie notices
  5. Returns clean plain text ready for the RAG pipeline
"""

import re
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

# ─────────────────────────────────────────────
# Common privacy policy URL paths to probe first
# ─────────────────────────────────────────────
PRIVACY_PATHS = [
    "/privacy-policy",
    "/privacy",
    "/privacypolicy",
    "/privacy-notice",
    "/privacy-statement",
    "/legal/privacy",
    "/legal/privacy-policy",
    "/policies/privacy",
    "/about/privacy",
    "/en/privacy",
    "/en/privacy-policy",
    "/terms/privacy",
    "/info/privacy",
    "/help/privacy",
    "/data-privacy",
    "/gdpr",
]

# Link text / href patterns that indicate a privacy policy link
_PRIVACY_RE = re.compile(r"privacy[\s\-_]?(policy|notice|statement)?", re.IGNORECASE)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

# HTML tags that never contain policy text
_NOISE_TAGS = [
    "script", "style", "noscript", "iframe", "svg", "img",
    "nav", "header", "footer", "aside", "form", "button",
    "dialog", "template", "figure", "figcaption",
]

# CSS selectors for common noise elements
_NOISE_SELECTORS = [
    "[class*='cookie']", "[id*='cookie']",
    "[class*='banner']", "[id*='banner']",
    "[class*='popup']",  "[id*='popup']",
    "[class*='modal']",  "[id*='modal']",
    "[class*='toast']",
    "[class*='menu']",   "[id*='menu']",
    "[class*='navbar']", "[id*='navbar']",
    "[class*='sidebar']","[id*='sidebar']",
    "[class*='breadcrumb']",
    "[class*='social']",
    "[aria-label='breadcrumb']",
]


# ═══════════════════════════════════════════════
# 1. URL HELPERS
# ═══════════════════════════════════════════════

def normalize_url(url: str) -> str:
    url = url.strip().rstrip("/")
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def _root(url: str) -> str:
    p = urlparse(url)
    return f"{p.scheme}://{p.netloc}"


# ═══════════════════════════════════════════════
# 2. FIND PRIVACY POLICY URL
# ═══════════════════════════════════════════════

def find_privacy_url(website_url: str) -> str:
    """
    Try common paths first (fast HEAD requests), then scan the homepage
    for any link whose text or href mentions 'privacy'.
    Returns the privacy policy URL, or the original URL as fallback.
    """
    base = normalize_url(website_url)
    root = _root(base)

    # ── Probe common paths ───────────────────────
    for path in PRIVACY_PATHS:
        candidate = root + path
        try:
            r = httpx.head(
                candidate, headers=HEADERS, timeout=5,
                follow_redirects=True,
            )
            if r.status_code == 200:
                print(f"[scraper] Found privacy policy at: {candidate}")
                return candidate
        except Exception:
            continue

    # ── Scan homepage links ──────────────────────
    print(f"[scraper] Common paths failed — scanning {base} for privacy links...")
    try:
        r = httpx.get(base, headers=HEADERS, timeout=15, follow_redirects=True)
        soup = BeautifulSoup(r.content, "lxml")

        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            text = a.get_text(strip=True)
            if _PRIVACY_RE.search(text) or _PRIVACY_RE.search(href):
                full = urljoin(base, href)
                # Ignore anchors that just scroll on the same page
                if full.rstrip("/") != base.rstrip("/"):
                    print(f"[scraper] Found privacy link: {full}  (text='{text[:40]}')")
                    return full
    except Exception as e:
        print(f"[scraper] Homepage scan failed: {e}")

    # ── Fallback: treat the given URL as the policy ─
    print(f"[scraper] Could not find privacy policy — using URL as-is: {base}")
    return base


# ═══════════════════════════════════════════════
# 3. FETCH + CLEAN TEXT
# ═══════════════════════════════════════════════

def _extract_main_text(soup: BeautifulSoup) -> str:
    """
    Remove noise elements, then extract text from the most likely
    main-content container.
    """
    # Strip noise tags entirely
    for tag in soup(_NOISE_TAGS):
        tag.decompose()

    # Strip noise by CSS selector
    for sel in _NOISE_SELECTORS:
        for el in soup.select(sel):
            el.decompose()

    # Prefer semantic content containers
    main = (
        soup.find("main")
        or soup.find("article")
        or soup.find(id=re.compile(r"(content|main|privacy|policy)", re.I))
        or soup.find(class_=re.compile(r"(content|main|privacy|policy)", re.I))
        or soup.find("body")
    )

    return (main or soup).get_text(separator="\n", strip=True)


def _clean_text(raw: str) -> str:
    """
    Post-process extracted plain text:
      - Remove lines too short to be policy content
      - Remove duplicate lines
      - Collapse excessive blank lines
    """
    lines = raw.splitlines()
    seen: set[str] = set()
    kept: list[str] = []
    for line in lines:
        line = line.strip()
        if len(line) < 15:        # raised from 30 → 15 to keep short policy sentences
            continue
        norm = re.sub(r"\s+", " ", line.lower())
        if norm in seen:
            continue
        seen.add(norm)
        kept.append(line)

    text = "\n".join(kept)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ═══════════════════════════════════════════════
# 4. PLAYWRIGHT FALLBACK (JS-rendered pages)
# ═══════════════════════════════════════════════

def _fetch_with_playwright(url: str) -> str:
    """
    Use a headless Chromium browser to fetch pages that require JavaScript.
    Requires:  pip install playwright && playwright install chromium
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise ImportError(
            "Page requires JavaScript but Playwright is not installed.\n"
            "Fix: pip install playwright && playwright install chromium"
        )

    print(f"[scraper] JS-rendered page detected — launching Playwright...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page    = browser.new_page(user_agent=HEADERS["User-Agent"])
        page.goto(url, wait_until="networkidle", timeout=30_000)
        # Wait a moment for any lazy-loaded content
        page.wait_for_timeout(2000)
        html = page.content()
        browser.close()
    return html


# ═══════════════════════════════════════════════
# 5. PUBLIC ENTRY POINT
# ═══════════════════════════════════════════════

def scrape_privacy_policy(website_url: str) -> tuple[str, str]:
    """
    Given any website URL, find its privacy policy, scrape and clean the text.

    Flow:
      1. Find the privacy policy URL (common paths + link scan)
      2. Fetch with httpx (fast, no browser overhead)
      3. If text is too short (JS-rendered site), retry with Playwright
      4. Clean and return

    Returns:
        (cleaned_policy_text, privacy_policy_url)
    """
    privacy_url = find_privacy_url(website_url)
    print(f"[scraper] Fetching: {privacy_url}")

    # ── Attempt 1: plain httpx ───────────────────
    resp = httpx.get(privacy_url, headers=HEADERS, timeout=20, follow_redirects=True)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.content, "lxml")
    text = _clean_text(_extract_main_text(soup))
    word_count = len(text.split())
    print(f"[scraper] httpx → {word_count} words")

    # ── Attempt 2: Playwright if page needs JS ───
    if word_count < 100:
        print(f"[scraper] Too little text ({word_count} words) — trying Playwright...")
        html  = _fetch_with_playwright(privacy_url)
        soup  = BeautifulSoup(html, "lxml")
        text  = _clean_text(_extract_main_text(soup))
        word_count = len(text.split())
        print(f"[scraper] Playwright → {word_count} words")

    if word_count < 50:
        raise ValueError(
            f"Could only extract {word_count} words from {privacy_url}. "
            "The page may be behind a login or bot protection."
        )

    return text, privacy_url
