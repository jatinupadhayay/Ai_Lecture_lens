import os
import re
import sys
import threading
import hashlib
from typing import Optional

try:
    import chromadb
    from chromadb.config import Settings
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False
    print("[vector_store] WARNING: chromadb not installed. Run: pip install chromadb", file=sys.stderr)

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


def get_embed_model() -> "SentenceTransformer":
    global _embed_model
    if _embed_model is None:
        with _embed_model_lock:
            if _embed_model is None:
                if not SENTENCE_TRANSFORMERS_AVAILABLE:
                    raise RuntimeError(f"sentence-transformers unavailable: {SENTENCE_TRANSFORMERS_IMPORT_ERROR}")
                print(f"[vector_store] Loading embedding model: {EMBED_MODEL_NAME}", file=sys.stderr)
                _embed_model = SentenceTransformer(EMBED_MODEL_NAME)
                print("[vector_store] Embedding model ready", file=sys.stderr)
    return _embed_model


def get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
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


def collection_exists(document_id: str) -> bool:
    client = get_chroma_client()
    name = _collection_name(document_id)
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

    print(f"[vector_store] Ingested {len(texts)} chunks for document {document_id}", file=sys.stderr)
    return len(texts)


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
            "score": round(1 - dist, 4),
        })

    return output


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