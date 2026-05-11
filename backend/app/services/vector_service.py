"""
Vector embedding service using ChromaDB for RAG pipelines.

All ChromaDB collection operations run in asyncio thread pool executors
to avoid blocking the FastAPI event loop.
"""
import json
import asyncio
import hashlib
from typing import List, Dict, Any, Optional
from functools import partial
import chromadb
import google.generativeai as genai
from app.core.config import settings
import structlog

logger = structlog.get_logger()


def _run_sync(fn, *args, **kwargs):
    """Helper: run a sync function in the default thread pool executor."""
    loop = asyncio.get_event_loop()
    return loop.run_in_executor(None, partial(fn, *args, **kwargs))


class VectorEmbeddingService:
    """
    ChromaDB-based vector store with async wrappers.
    All blocking operations are offloaded to thread pool executor.
    """

    def __init__(self):
        self._client: Optional[chromadb.Client] = None
        self._collections: Dict[str, Any] = {}

    def _get_client_sync(self) -> chromadb.Client:
        """Create ChromaDB client (sync, called from executor)."""
        if self._client is None:
            try:
                host_url = settings.CHROMA_URL
                if "://" in host_url:
                    host_url = host_url.split("://", 1)[1]
                host = host_url.split(":")[0]
                port = int(host_url.split(":")[-1]) if ":" in host_url else 8001
                self._client = chromadb.HttpClient(host=host, port=port)
                self._client.heartbeat()
            except Exception as e:
                logger.warning("ChromaDB HTTP unavailable, using in-memory", error=str(e))
                self._client = chromadb.Client()
        return self._client

    async def _get_client(self):
        if self._client is None:
            await asyncio.get_event_loop().run_in_executor(None, self._get_client_sync)
        return self._client

    async def _get_collection(self, name: str):
        """Get or create a ChromaDB collection, non-blocking."""
        if name in self._collections:
            return self._collections[name]
        client = await self._get_client()
        coll_name = f"intellicare_{name}"
        collection = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: client.get_or_create_collection(
                name=coll_name,
                metadata={"hnsw:space": "cosine"},
            )
        )
        self._collections[name] = collection
        return collection

    async def _embed_text_async(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings using Gemini, non-blocking."""
        def _sync_embed():
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                result = genai.embed_content(
                    model="models/text-embedding-004",
                    content=texts,
                    task_type="retrieval_document",
                )
                emb = result.get("embedding", result.get("embeddings", []))
                if isinstance(emb, list) and emb and isinstance(emb[0], list):
                    return emb
                return [emb]
            except Exception as e:
                logger.warning("Gemini embedding failed, using fallback", error=str(e))
                return [self._fallback_embed(t) for t in texts]

        return await asyncio.get_event_loop().run_in_executor(None, _sync_embed)

    def _fallback_embed(self, text: str) -> List[float]:
        """Deterministic 768-dim fallback embedding."""
        import struct
        h = hashlib.sha256(text.encode()).digest() * 12  # 12*32 = 384 bytes
        raw = [struct.unpack("f", h[i:i+4])[0] for i in range(0, 384, 4)][:96]
        full = (raw * 8)[:768]
        norm = (sum(v * v for v in full) ** 0.5) or 1.0
        return [v / norm for v in full]

    # ------------------------------------------------------------------
    # PATIENT CONTEXT
    # ------------------------------------------------------------------

    async def index_patient_context(self, patient_id: str, clinical_context: dict) -> bool:
        try:
            collection = await self._get_collection("patient_contexts")
            text = json.dumps(clinical_context, default=str)
            embeddings = await self._embed_text_async([text])
            embedding = embeddings[0]
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: collection.upsert(
                    ids=[patient_id],
                    embeddings=[embedding],
                    documents=[text],
                    metadatas=[{"patient_id": patient_id, "type": "clinical_context"}],
                )
            )
            return True
        except Exception as e:
            logger.error("Failed to index patient context", patient_id=patient_id, error=str(e))
            return False

    async def search_similar_patients(self, query_context: dict, n_results: int = 5) -> List[dict]:
        try:
            collection = await self._get_collection("patient_contexts")
            query_text = json.dumps(query_context, default=str)
            embeddings = await self._embed_text_async([query_text])
            results = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: collection.query(
                    query_embeddings=[embeddings[0]],
                    n_results=n_results,
                    include=["documents", "metadatas", "distances"],
                )
            )
            return [
                {"patient_id": meta["patient_id"], "similarity": 1 - dist, "context": json.loads(doc)}
                for meta, dist, doc in zip(
                    results["metadatas"][0], results["distances"][0], results["documents"][0]
                )
            ]
        except Exception as e:
            logger.error("Patient similarity search failed", error=str(e))
            return []

    # ------------------------------------------------------------------
    # PAYER POLICIES
    # ------------------------------------------------------------------

    async def index_payer_policy(self, policy_id: str, policy_text: str, metadata: dict) -> bool:
        try:
            collection = await self._get_collection("payer_policies")
            chunks = self._chunk_text(policy_text)
            for i, chunk in enumerate(chunks):
                embeddings = await self._embed_text_async([chunk])
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda c=chunk, emb=embeddings[0], idx=i: collection.upsert(
                        ids=[f"{policy_id}_chunk_{idx}"],
                        embeddings=[emb],
                        documents=[c],
                        metadatas=[{**metadata, "policy_id": policy_id, "chunk": idx}],
                    )
                )
            return True
        except Exception as e:
            logger.error("Failed to index payer policy", error=str(e))
            return False

    async def retrieve_relevant_policy(self, query: str, payer_name: str, n_results: int = 3) -> List[str]:
        try:
            collection = await self._get_collection("payer_policies")
            embeddings = await self._embed_text_async([query])
            results = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: collection.query(
                    query_embeddings=[embeddings[0]],
                    n_results=n_results,
                    include=["documents"],
                )
            )
            return results["documents"][0] if results.get("documents") else []
        except Exception as e:
            logger.error("Policy retrieval failed", error=str(e))
            return []

    # ------------------------------------------------------------------
    # TRIAL CRITERIA
    # ------------------------------------------------------------------

    async def index_trial_criteria(self, nct_id: str, criteria_text: str, trial_metadata: dict) -> bool:
        try:
            collection = await self._get_collection("trial_criteria")
            embeddings = await self._embed_text_async([criteria_text])
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: collection.upsert(
                    ids=[nct_id],
                    embeddings=[embeddings[0]],
                    documents=[criteria_text],
                    metadatas=[{"nct_id": nct_id, **trial_metadata}],
                )
            )
            return True
        except Exception as e:
            logger.error("Failed to index trial criteria", error=str(e))
            return False

    async def search_relevant_trials(self, patient_profile: str, n_results: int = 10) -> List[dict]:
        try:
            collection = await self._get_collection("trial_criteria")
            embeddings = await self._embed_text_async([patient_profile])
            results = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: collection.query(
                    query_embeddings=[embeddings[0]],
                    n_results=n_results,
                    include=["documents", "metadatas", "distances"],
                )
            )
            return [
                {"nct_id": m.get("nct_id"), "relevance_score": 1 - d, "metadata": m}
                for m, d in zip(results["metadatas"][0], results["distances"][0])
            ]
        except Exception as e:
            logger.error("Trial semantic search failed", error=str(e))
            return []

    # ------------------------------------------------------------------
    # PRIOR AUTH TEMPLATES
    # ------------------------------------------------------------------

    async def index_auth_template(self, template_id: str, template_text: str, metadata: dict) -> bool:
        try:
            collection = await self._get_collection("auth_templates")
            embeddings = await self._embed_text_async([template_text])
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: collection.upsert(
                    ids=[template_id],
                    embeddings=[embeddings[0]],
                    documents=[template_text],
                    metadatas=[metadata],
                )
            )
            return True
        except Exception as e:
            logger.error("Failed to index auth template", error=str(e))
            return False

    async def retrieve_similar_auth_letters(self, diagnosis: str, procedure: str) -> List[str]:
        try:
            collection = await self._get_collection("auth_templates")
            query = f"Prior authorization for {procedure} in patient with {diagnosis}"
            embeddings = await self._embed_text_async([query])
            results = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: collection.query(
                    query_embeddings=[embeddings[0]],
                    n_results=3,
                    include=["documents"],
                )
            )
            return results["documents"][0] if results.get("documents") else []
        except Exception as e:
            logger.error("Auth letter retrieval failed", error=str(e))
            return []

    def _chunk_text(self, text: str, chunk_size: int = 500) -> List[str]:
        words = text.split()
        chunks, overlap = [], chunk_size // 5
        for i in range(0, len(words), chunk_size - overlap):
            chunk = " ".join(words[i:i + chunk_size])
            if chunk:
                chunks.append(chunk)
        return chunks or [text]


vector_service = VectorEmbeddingService()
