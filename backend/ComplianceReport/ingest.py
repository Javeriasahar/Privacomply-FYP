"""
Ingestion pipeline:
  1. Download documents (HTML or PDF) from document_sources.py
  2. Parse and chunk them with rich metadata
  3. Embed with OpenAI text-embedding-3-large
  4. Upsert into Qdrant

Usage:
    python ingest.py                   # ingest all docs
    python ingest.py --regulation gdpr  # ingest only GDPR docs
    python ingest.py --dry-run          # show what would be ingested
"""

import sys
import os

# ── Resolve project root and add required source directories to path ──
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _d in [
    _ROOT,
    os.path.join(_ROOT, "metadata"),
    os.path.join(_ROOT, "settings"),
]:
    if _d not in sys.path:
        sys.path.insert(0, _d)

import argparse
import hashlib
import json
import re
import time
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(os.path.join(_ROOT, ".env"))

import httpx
from bs4 import BeautifulSoup
from sentence_transformers import SentenceTransformer
from pypdf import PdfReader
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from config import (
    COLLECTION_NAME,
    EMBED_BATCH_SIZE,
    EMBED_MODEL,
    QDRANT_API_KEY,
    QDRANT_URL,
    VECTOR_SIZE,
)
from document_sources import ALL_SOURCES, DocumentSource, sources_for
from models import DocumentChunk

# ─────────────────────────────────────────────
CACHE_DIR = Path(_ROOT) / "doc_cache"
CACHE_DIR.mkdir(exist_ok=True)

embedding_model = SentenceTransformer(EMBED_MODEL)
qdrant = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=60)


# ═══════════════════════════════════════════════
# 1. DOWNLOAD & CACHE
# ═══════════════════════════════════════════════

def cache_path(source: DocumentSource) -> Path:
    url_hash = hashlib.md5(source.url.encode()).hexdigest()[:10]
    ext = ".pdf" if source.fmt == "pdf" else ".html"
    return CACHE_DIR / f"{url_hash}{ext}"


def _is_valid_content(raw: bytes, fmt: str) -> bool:
    """Return False if the bytes are obviously the wrong format (e.g. HTML cached as PDF)."""
    if fmt == "pdf":
        return raw[:5] == b"%PDF-"
    return True


def _fetch_url(url: str) -> bytes | None:
    headers = {"User-Agent": "Mozilla/5.0 (PrivaComply Research Bot)"}
    try:
        resp = httpx.get(url, headers=headers, timeout=30, follow_redirects=True)
        resp.raise_for_status()
        return resp.content
    except Exception as e:
        print(f"  [ERROR] Could not fetch {url}: {e}")
        return None


def download_source(source: DocumentSource) -> bytes | None:
    path = cache_path(source)

    # Load from cache — but evict if content is clearly wrong format
    if path.exists():
        raw = path.read_bytes()
        if _is_valid_content(raw, source.fmt):
            print(f"  [cache] {source.title[:60]}")
            return raw
        print(f"  [cache-invalid] Stale/wrong-format cache for {source.title[:60]} — re-fetching")
        path.unlink()

    print(f"  [fetch] {source.title[:60]}")
    raw = _fetch_url(source.url)
    if raw is None:
        return None

    if not _is_valid_content(raw, source.fmt):
        print(f"  [WARN] URL returned wrong content type for {source.title[:60]} — skipping cache")
        # Return raw anyway so parse_source can try HTML fallback
        return raw

    path.write_bytes(raw)
    time.sleep(1)
    return raw


# ═══════════════════════════════════════════════
# 2. PARSE DOCUMENTS
# ═══════════════════════════════════════════════

def parse_html(raw: bytes, source: DocumentSource) -> list[dict]:
    """
    Parse HTML legal documents.
    Returns list of {article, article_title, text} dicts.
    Strategy: extract by heading structure (h2/h3/h4) for guidance docs,
              by article divs for EUR-Lex regulation pages.
    """
    soup = BeautifulSoup(raw, "lxml")

    # ── EUR-Lex GDPR / ePrivacy ─────────────────
    # EUR-Lex wraps each article in <div class="eli-subdivision">
    articles = soup.select("div.eli-subdivision") or soup.select("div.reg-content")
    if articles:
        chunks = []
        for art in articles:
            heading = art.find(["h2", "h3", "h4"])
            article_num_match = re.search(r"Article\s+(\d+)", heading.get_text() if heading else "")
            article_title_el = art.find("p", class_="oj-sti-art")

            article_num = article_num_match.group(1) if article_num_match else "?"
            article_title = article_title_el.get_text(strip=True) if article_title_el else ""
            text = art.get_text(separator=" ", strip=True)

            # Skip very short fragments (e.g. cross-reference headings)
            if len(text) < 100:
                continue

            chunks.append({
                "article": article_num,
                "article_title": article_title,
                "text": text,
            })
        if chunks:
            return chunks

    # ── ICO / Generic guidance: split by heading ─
    chunks = []
    current_heading = "Introduction"
    current_text_parts: list[str] = []

    for el in soup.find_all(["h1", "h2", "h3", "h4", "p", "li"]):
        if el.name in ("h1", "h2", "h3", "h4"):
            # flush current section
            text = " ".join(current_text_parts).strip()
            if len(text) > 150:
                chunks.append({
                    "article": "guidance",
                    "article_title": current_heading,
                    "text": f"{current_heading}: {text}",
                })
            current_heading = el.get_text(strip=True)
            current_text_parts = []
        else:
            t = el.get_text(strip=True)
            if t:
                current_text_parts.append(t)

    # flush last section
    text = " ".join(current_text_parts).strip()
    if len(text) > 150:
        chunks.append({
            "article": "guidance",
            "article_title": current_heading,
            "text": f"{current_heading}: {text}",
        })

    return chunks


def parse_pdf(raw: bytes, source: DocumentSource) -> list[dict]:
    """
    Parse PDF legal documents.
    Strategy: extract text page by page, then merge into section chunks
              using regex heuristics for article/section headings.
    """
    import io
    try:
        reader = PdfReader(io.BytesIO(raw))
    except Exception as e:
        print(f"  [WARN] PDF parse failed ({e}) — skipping")
        return []
    full_text = ""
    for page in reader.pages:
        try:
            t = page.extract_text()
        except Exception:
            continue
        if t:
            full_text += t + "\n"

    # Split on article / section / chapter headings
    # Handles: "Article 6", "Section 10.", "Chapter III", "PART 2"
    pattern = re.compile(
        r"(?m)^(?:Article|Section|Chapter|PART|CHAPTER|SECTION)\s+\d+[A-Z]?[\.\s]",
        re.IGNORECASE,
    )
    splits = list(pattern.finditer(full_text))

    if not splits:
        # No structured headings found — fall back to 800-word windows
        words = full_text.split()
        window = 800
        return [
            {
                "article": str(i // window),
                "article_title": f"Passage {i // window + 1}",
                "text": " ".join(words[i : i + window]),
            }
            for i in range(0, len(words), window)
            if " ".join(words[i : i + window]).strip()
        ]

    chunks = []
    for idx, match in enumerate(splits):
        start = match.start()
        end = splits[idx + 1].start() if idx + 1 < len(splits) else len(full_text)
        section_text = full_text[start:end].strip()
        if len(section_text) < 80:
            continue

        # Extract article number from the heading
        num_match = re.search(r"\d+", match.group())
        article_num = num_match.group() if num_match else str(idx)

        # First line after the heading = likely the title
        lines = section_text.split("\n")
        article_title = lines[1].strip() if len(lines) > 1 else ""

        chunks.append({
            "article": article_num,
            "article_title": article_title,
            "text": section_text,
        })

    return chunks


def parse_source(raw: bytes, source: DocumentSource) -> list[dict]:
    if source.fmt == "pdf":
        if raw[:5] != b"%PDF-":
            # Server returned HTML (redirect page, login wall, etc.) — parse as HTML
            print(f"  [WARN] Expected PDF but got HTML — parsing as HTML instead")
            return parse_html(raw, source)
        return parse_pdf(raw, source)
    return parse_html(raw, source)


# ═══════════════════════════════════════════════
# 3. BUILD DocumentChunks WITH METADATA
# ═══════════════════════════════════════════════

def build_chunks(
    parsed: list[dict], source: DocumentSource
) -> list[DocumentChunk]:
    """
    Attach full metadata to each parsed section, including:
      - which of the 15 categories this chunk covers
      - priority level
    """
    from config import CATEGORIES

    # Build a lookup: article number → categories that reference it
    article_to_categories: dict[str, list[int]] = {}
    for cat in CATEGORIES:
        gdpr_arts = cat.get("gdpr_articles", [])
        pdpa_secs = cat.get("pdpa_sections", [])
        all_arts = gdpr_arts + pdpa_secs
        for art in all_arts:
            if art not in article_to_categories:
                article_to_categories[art] = []
            article_to_categories[art].append(cat["id"])

    chunks: list[DocumentChunk] = []
    for idx, section in enumerate(parsed):
        article = section.get("article", "?")

        # Determine which categories this chunk is relevant to
        if source.categories:
            # Source already specifies categories explicitly
            relevant_cats = source.categories
        else:
            relevant_cats = article_to_categories.get(article, [])

        # Determine max priority across covered labels
        from config import CATEGORIES
        priority = "Medium"
        for cat in CATEGORIES:
            if cat["id"] in relevant_cats:
                for label in cat["labels"]:
                    if label["priority"] == "Critical":
                        priority = "Critical"
                    elif label["priority"] == "High" and priority != "Critical":
                        priority = "High"

        # Stable chunk ID based on source URL + index
        url_hash = hashlib.md5(source.url.encode()).hexdigest()[:6]
        chunk_id = f"{url_hash}_art{article}_{idx}"

        chunks.append(
            DocumentChunk(
                chunk_id=chunk_id,
                text=section["text"],
                regulation=source.regulation,
                doc_type=source.doc_type,
                source_title=source.title,
                source_url=source.url,
                article=article,
                article_title=section.get("article_title", ""),
                categories=relevant_cats,
                priority=priority,
                chunk_index=idx,
            )
        )

    return chunks


# ═══════════════════════════════════════════════
# 4. EMBED
# ═══════════════════════════════════════════════

def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch embed using sentence-transformers."""
    all_embeddings: list[list[float]] = []
    for i in range(0, len(texts), EMBED_BATCH_SIZE):
        batch = texts[i : i + EMBED_BATCH_SIZE]
        embeddings = embedding_model.encode(batch, show_progress_bar=False)
        all_embeddings.extend(embeddings.tolist())
    return all_embeddings


# ═══════════════════════════════════════════════
# 5. UPSERT TO QDRANT
# ═══════════════════════════════════════════════

def ensure_collection():
    """Create Qdrant collection if it doesn't exist."""
    existing = [c.name for c in qdrant.get_collections().collections]
    if COLLECTION_NAME not in existing:
        qdrant.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
        # Create payload indexes for fast filtering
        qdrant.create_payload_index(COLLECTION_NAME, "regulation", "keyword")
        qdrant.create_payload_index(COLLECTION_NAME, "doc_type",   "keyword")
        qdrant.create_payload_index(COLLECTION_NAME, "categories", "integer")
        qdrant.create_payload_index(COLLECTION_NAME, "priority",   "keyword")
        print(f"[qdrant] Created collection '{COLLECTION_NAME}'")
    else:
        print(f"[qdrant] Collection '{COLLECTION_NAME}' already exists")


def upsert_chunks(chunks: list[DocumentChunk], embeddings: list[list[float]]):
    points = [
        PointStruct(
            id=int(hashlib.md5(c.chunk_id.encode()).hexdigest(), 16) % (2**63),
            vector=emb,
            payload={
                "chunk_id":     c.chunk_id,
                "text":         c.text,
                "regulation":   c.regulation,
                "doc_type":     c.doc_type,
                "source_title": c.source_title,
                "source_url":   c.source_url,
                "article":      c.article,
                "article_title":c.article_title,
                "categories":   c.categories,
                "priority":     c.priority,
                "chunk_index":  c.chunk_index,
            },
        )
        for c, emb in zip(chunks, embeddings)
    ]

    batch_size = 25  # smaller batches to avoid cloud write timeouts
    for i in range(0, len(points), batch_size):
        batch = points[i : i + batch_size]
        for attempt in range(5):
            try:
                qdrant.upsert(collection_name=COLLECTION_NAME, points=batch)
                break
            except Exception as e:
                if attempt == 4:
                    print(f"  [ERROR] Upsert failed after 5 attempts: {e}")
                    raise
                wait = 2 ** attempt
                print(f"  [retry] Upsert attempt {attempt+1} failed ({e}) — retrying in {wait}s")
                time.sleep(wait)


# ═══════════════════════════════════════════════
# 6. MAIN ORCHESTRATOR
# ═══════════════════════════════════════════════

def run_ingestion(regulation: str = "both", dry_run: bool = False):
    sources = sources_for(regulation)
    print(f"\n{'='*60}")
    print(f"  Ingesting {len(sources)} document sources for: {regulation.upper()}")
    print(f"{'='*60}\n")

    if not dry_run:
        ensure_collection()

    total_chunks = 0
    for source in sources:
        print(f"\n▶  {source.title}")

        if dry_run:
            print(f"   → [dry-run] Would fetch: {source.url}")
            continue

        # Download
        raw = download_source(source)
        if not raw:
            continue

        # Parse
        parsed = parse_source(raw, source)
        if not parsed:
            print(f"   → [WARN] No parseable content found")
            continue
        print(f"   → Parsed {len(parsed)} sections")

        # Build chunks
        chunks = build_chunks(parsed, source)
        # Filter out very short chunks (table headers, page numbers etc.)
        chunks = [c for c in chunks if len(c.text.split()) >= 30]
        print(f"   → Built {len(chunks)} chunks after filtering")

        # Embed
        print(f"   → Embedding {len(chunks)} chunks...")
        texts = [c.text for c in chunks]
        embeddings = embed_texts(texts)

        # Upsert
        upsert_chunks(chunks, embeddings)
        total_chunks += len(chunks)
        print(f"   → ✅ Upserted {len(chunks)} chunks")

    print(f"\n{'='*60}")
    print(f"  ✅ Done. Total chunks stored: {total_chunks}")
    print(f"{'='*60}\n")


# ═══════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest compliance documents into Qdrant.")
    parser.add_argument(
        "--regulation", choices=["gdpr", "pdpa", "both"], default="both",
        help="Which regulation's documents to ingest (default: both)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show what would be ingested without fetching or storing",
    )
    args = parser.parse_args()

    run_ingestion(regulation=args.regulation, dry_run=args.dry_run)
