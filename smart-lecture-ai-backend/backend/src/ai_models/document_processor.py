"""
document_processor.py
---------------------
Extract and chunk text from PDF and DOCX files for RAG ingestion.

Pipeline:
  PDF/DOCX → raw text → cleaned sentences → overlapping chunks
  Each chunk is ~400 words with 50-word overlap to preserve context.
"""

import re
import sys
from pathlib import Path

# ── PDF extraction ──────────────────────────────────────────────────────────
try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False
    print("[document_processor] WARNING: PyMuPDF not installed. PDF support disabled.", file=sys.stderr)

# ── DOCX extraction ─────────────────────────────────────────────────────────
try:
    import docx
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False
    print("[document_processor] WARNING: python-docx not installed. DOCX support disabled.", file=sys.stderr)


# ─────────────────────────────────────────────────────────────────
# Text extraction
# ─────────────────────────────────────────────────────────────────

def extract_from_pdf(path: str) -> str:
    if not PYMUPDF_AVAILABLE:
        raise RuntimeError("PyMuPDF not installed. Run: pip install pymupdf")
    doc = fitz.open(path)
    pages = []
    for page in doc:
        text = page.get_text("text")
        if text.strip():
            pages.append(text.strip())
    doc.close()
    return "\n\n".join(pages)


def extract_from_docx(path: str) -> str:
    if not DOCX_AVAILABLE:
        raise RuntimeError("python-docx not installed. Run: pip install python-docx")
    document = docx.Document(path)
    paragraphs = [p.text.strip() for p in document.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)


def extract_from_txt(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def extract_text(file_path: str) -> str:
    """Extract raw text from a file. Supports PDF, DOCX, TXT."""
    ext = Path(file_path).suffix.lower()
    if ext == ".pdf":
        return extract_from_pdf(file_path)
    elif ext in (".docx", ".doc"):
        return extract_from_docx(file_path)
    elif ext == ".txt":
        return extract_from_txt(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


# ─────────────────────────────────────────────────────────────────
# Cleaning
# ─────────────────────────────────────────────────────────────────

def clean_text(text: str) -> str:
    """Remove headers, footers, page numbers, and excessive whitespace."""
    # Remove page numbers (standalone numbers on a line)
    text = re.sub(r"^\s*\d+\s*$", "", text, flags=re.MULTILINE)
    # Collapse multiple newlines
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Remove non-printable chars
    text = re.sub(r"[^\x20-\x7E\n]", " ", text)
    # Normalize spaces
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


# ─────────────────────────────────────────────────────────────────
# Chunking — overlapping windows over sentences
# ─────────────────────────────────────────────────────────────────

def split_into_sentences(text: str) -> list[str]:
    """Split text into sentences (simple regex, no NLTK dependency here)."""
    sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z])", text)
    return [s.strip() for s in sentences if len(s.strip().split()) > 3]


def chunk_text(
    text: str,
    chunk_size: int = 400,    # target words per chunk
    overlap: int = 50,         # words of overlap between chunks
) -> list[dict]:
    """
    Split text into overlapping word-level chunks.

    Returns list of dicts:
        {"chunk_index": int, "text": str, "word_count": int}
    """
    words = text.split()
    if not words:
        return []

    chunks = []
    start = 0
    idx = 0

    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk_words = words[start:end]
        chunk_text_str = " ".join(chunk_words)

        chunks.append({
            "chunk_index": idx,
            "text": chunk_text_str,
            "word_count": len(chunk_words),
        })

        idx += 1
        start += chunk_size - overlap  # slide with overlap

        # Avoid infinite loop on tiny docs
        if chunk_size - overlap <= 0:
            break

    return chunks


# ─────────────────────────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────────────────────────

def process_document(file_path: str, chunk_size: int = 400, overlap: int = 50) -> dict:
    """
    Full pipeline: file → extracted text → cleaned text → chunks.

    Returns:
        {
            "raw_text": str,
            "chunks": [{"chunk_index": int, "text": str, "word_count": int}],
            "total_words": int,
            "total_chunks": int,
        }
    """
    raw = extract_text(file_path)
    cleaned = clean_text(raw)
    chunks = chunk_text(cleaned, chunk_size=chunk_size, overlap=overlap)

    return {
        "raw_text": cleaned,
        "chunks": chunks,
        "total_words": len(cleaned.split()),
        "total_chunks": len(chunks),
    }
