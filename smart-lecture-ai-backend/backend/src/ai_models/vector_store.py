<<<<<<< HEAD
import os
import re
import sys
import threading
import hashlib
from typing import Optional

=======
"""
vector_store.py
---------------
ChromaDB-backed vector store for document RAG.

Each document gets its own ChromaDB collection (named by document_id).
Embeddings use sentence-transformers/all-MiniLM-L6-v2 — a fast, local,
high-quality 384-dim model (no API key required, ~80MB download).

Operations:
  - ingest(document_id, chunks, metadata) → stores all chunks as embeddings
  - query(document_id, query_text, top_k) → returns most relevant chunks
  - delete(document_id) → removes the entire collection
  - collection_exists(document_id) → check before re-ingesting
"""

import sys
import os
from typing import Optional

# ── ChromaDB ────────────────────────────────────────────────────────────────
>>>>>>> main
try:
    import chromadb
    from chromadb.config import Settings
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False
    print("[vector_store] WARNING: chromadb not installed. Run: pip install chromadb", file=sys.stderr)

<<<<<<< HEAD
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
    SENTENCE_TRANSFORMERS_IMPORT_ERROR = ""
except Exception as e:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    SENTENCE_TRANSFORMERS_IMPORT_ERROR = str(e)
    print(f"[vector_store] WARNING: sentence-transformers unavailable: {e}", file=sys.stderr)

EMBED_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
CHROMA_PERSIST_DIR = os.getenv(
    "CHROMA_PERSIST_DIR",
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "chroma_db_v2"),
)

_embed_model: Optional["SentenceTransformer"] = None
_chroma_client = None
_embed_model_lock = threading.Lock()
_chroma_client_lock = threading.Lock()
_chroma_operation_lock = threading.RLock()
=======
# ── Sentence Transformers ────────────────────────────────────────────────────
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    print("[vector_store] WARNING: sentence-transformers not installed.", file=sys.stderr)


# ─────────────────────────────────────────────────────────────────
# Singleton embedding model + ChromaDB client
# ─────────────────────────────────────────────────────────────────

EMBED_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
CHROMA_PERSIST_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "chroma_db")

_embed_model: Optional["SentenceTransformer"] = None
_chroma_client = None
>>>>>>> main


def get_embed_model() -> "SentenceTransformer":
    global _embed_model
    if _embed_model is None:
<<<<<<< HEAD
        with _embed_model_lock:
            if _embed_model is None:
                if not SENTENCE_TRANSFORMERS_AVAILABLE:
                    raise RuntimeError(f"sentence-transformers unavailable: {SENTENCE_TRANSFORMERS_IMPORT_ERROR}")
                print(f"[vector_store] Loading embedding model: {EMBED_MODEL_NAME}", file=sys.stderr)
                _embed_model = SentenceTransformer(EMBED_MODEL_NAME)
                print("[vector_store] Embedding model ready", file=sys.stderr)
=======
        if not SENTENCE_TRANSFORMERS_AVAILABLE:
            raise RuntimeError("sentence-transformers not installed.")
        print(f"[vector_store] Loading embedding model: {EMBED_MODEL_NAME}", file=sys.stderr)
        _embed_model = SentenceTransformer(EMBED_MODEL_NAME)
        print("[vector_store] Embedding model ready", file=sys.stderr)
>>>>>>> main
    return _embed_model


def get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
<<<<<<< HEAD
        with _chroma_client_lock:
            if _chroma_client is None:
                if not CHROMA_AVAILABLE:
                    raise RuntimeError("chromadb not installed.")
                os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)
                _chroma_client = chromadb.PersistentClient(
                    path=CHROMA_PERSIST_DIR,
                    settings=Settings(anonymized_telemetry=False),
                )
                print(f"[vector_store] ChromaDB initialized at: {CHROMA_PERSIST_DIR}", file=sys.stderr)
    return _chroma_client


def _collection_name(document_id: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_-]+", "-", document_id).strip("-_")
    if not safe:
        safe = "document"
    digest = hashlib.sha1(document_id.encode("utf-8")).hexdigest()[:10]
    prefix = re.sub(r"[-_]{2,}", "-", f"doc-{safe}")[:52].strip("-_")
    name = f"{prefix}-{digest}"
    return name[:63].strip("-_") or f"doc-{digest}"
=======
        if not CHROMA_AVAILABLE:
            raise RuntimeError("chromadb not installed.")
        os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(
            path=CHROMA_PERSIST_DIR,
            settings=Settings(anonymized_telemetry=False),
        )
        print(f"[vector_store] ChromaDB initialized at: {CHROMA_PERSIST_DIR}", file=sys.stderr)
    return _chroma_client


# ─────────────────────────────────────────────────────────────────
# Collection helpers
# ─────────────────────────────────────────────────────────────────

def _collection_name(document_id: str) -> str:
    # ChromaDB collection names must be 3-63 chars, alphanumeric + hyphens
    safe = "".join(c if c.isalnum() or c == "-" else "_" for c in document_id)
    return f"doc_{safe}"[:63]
>>>>>>> main


def collection_exists(document_id: str) -> bool:
    client = get_chroma_client()
    name = _collection_name(document_id)
<<<<<<< HEAD
    with _chroma_operation_lock:
        try:
            client.get_collection(name)
            return True
        except Exception:
            return False


def ingest(document_id: str, chunks: list[dict], doc_metadata: dict | None = None) -> int:
    if not chunks:
        return 0

    embed_model = get_embed_model()
    client = get_chroma_client()
    name = _collection_name(document_id)

=======
    try:
        client.get_collection(name)
        return True
    except Exception:
        return False


# ─────────────────────────────────────────────────────────────────
# Ingest
# ─────────────────────────────────────────────────────────────────

def ingest(
    document_id: str,
    chunks: list[dict],
    doc_metadata: dict | None = None,
) -> int:
    """
    Embed and store all chunks for a document.

    Args:
        document_id: Unique identifier (MongoDB _id string)
        chunks: List of {"chunk_index": int, "text": str, "word_count": int}
        doc_metadata: Extra metadata stored with every chunk (title, file name, etc.)

    Returns:
        Number of chunks stored.
    """
    if not chunks:
        return 0

    client = get_chroma_client()
    embed_model = get_embed_model()
    name = _collection_name(document_id)

    # Delete existing collection if re-ingesting
    try:
        client.delete_collection(name)
    except Exception:
        pass

    collection = client.create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )

>>>>>>> main
    texts = [c["text"] for c in chunks]
    embeddings = embed_model.encode(texts, batch_size=32, show_progress_bar=False).tolist()

    ids = [f"{document_id}_chunk_{c['chunk_index']}" for c in chunks]
    metadatas = [
        {
            "document_id": document_id,
            "chunk_index": c["chunk_index"],
            "word_count": c["word_count"],
            **(doc_metadata or {}),
        }
        for c in chunks
    ]

<<<<<<< HEAD
    with _chroma_operation_lock:
        try:
            client.delete_collection(name)
        except Exception:
            pass

        collection = client.create_collection(
            name=name,
            metadata={"hnsw:space": "cosine"},
        )

        BATCH = 500
        for i in range(0, len(texts), BATCH):
            collection.add(
                ids=ids[i:i+BATCH],
                embeddings=embeddings[i:i+BATCH],
                documents=texts[i:i+BATCH],
                metadatas=metadatas[i:i+BATCH],
            )

=======
    # ChromaDB batch insert (max 5461 per call — chunked to be safe)
    BATCH = 500
    for i in range(0, len(texts), BATCH):
        collection.add(
            ids=ids[i:i+BATCH],
            embeddings=embeddings[i:i+BATCH],
            documents=texts[i:i+BATCH],
            metadatas=metadatas[i:i+BATCH],
        )

>>>>>>> main
    print(f"[vector_store] Ingested {len(texts)} chunks for document {document_id}", file=sys.stderr)
    return len(texts)


<<<<<<< HEAD
def query(document_id: str, query_text: str, top_k: int = 5) -> list[dict]:
    embed_model = get_embed_model()
    client = get_chroma_client()
    name = _collection_name(document_id)

    query_embedding = embed_model.encode([query_text]).tolist()

    with _chroma_operation_lock:
        try:
            collection = client.get_collection(name)
        except Exception:
            raise ValueError(f"No vector store found for document '{document_id}'. Ingest it first.")

        results = collection.query(
            query_embeddings=query_embedding,
            n_results=min(top_k, collection.count()),
            include=["documents", "metadatas", "distances"],
        )
=======
# ─────────────────────────────────────────────────────────────────
# Query
# ─────────────────────────────────────────────────────────────────

def query(
    document_id: str,
    query_text: str,
    top_k: int = 5,
) -> list[dict]:
    """
    Retrieve the top-k most semantically similar chunks.

    Returns list of dicts:
        {"text": str, "chunk_index": int, "score": float, "word_count": int}
    Sorted by relevance (most relevant first).
    """
    client = get_chroma_client()
    embed_model = get_embed_model()
    name = _collection_name(document_id)

    try:
        collection = client.get_collection(name)
    except Exception:
        raise ValueError(f"No vector store found for document '{document_id}'. Ingest it first.")

    query_embedding = embed_model.encode([query_text]).tolist()

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=min(top_k, collection.count()),
        include=["documents", "metadatas", "distances"],
    )
>>>>>>> main

    output = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        output.append({
            "text": doc,
            "chunk_index": meta.get("chunk_index", -1),
            "word_count": meta.get("word_count", 0),
<<<<<<< HEAD
            "score": round(1 - dist, 4),
=======
            "score": round(1 - dist, 4),  # cosine similarity (0-1, higher = more relevant)
>>>>>>> main
        })

    return output


<<<<<<< HEAD
def delete(document_id: str) -> bool:
    client = get_chroma_client()
    name = _collection_name(document_id)
    with _chroma_operation_lock:
        try:
            client.delete_collection(name)
            print(f"[vector_store] Deleted collection for document {document_id}", file=sys.stderr)
            return True
        except Exception as e:
            print(f"[vector_store] Delete failed for {document_id}: {e}", file=sys.stderr)
            return False
=======
# ─────────────────────────────────────────────────────────────────
# Delete
# ─────────────────────────────────────────────────────────────────

def delete(document_id: str) -> bool:
    """Remove the ChromaDB collection for a document."""
    client = get_chroma_client()
    name = _collection_name(document_id)
    try:
        client.delete_collection(name)
        print(f"[vector_store] Deleted collection for document {document_id}", file=sys.stderr)
        return True
    except Exception as e:
        print(f"[vector_store] Delete failed for {document_id}: {e}", file=sys.stderr)
        return False
>>>>>>> main
