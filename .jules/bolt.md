## 2026-09-17 - Batch Payload Store Operations

**Learning:** `FileStore.upsert_payload` re-serialized the entire `payloads.json` file to disk on every single item insert, turning multi-item curation in `_curate` into an $O(N^2)$ disk I/O bottleneck (500 items took ~50 seconds).
**Action:** Always batch multi-document store mutations using `upsert_payloads` to perform disk serialization or network bulk writes once at the end of the batch operation.
## 2026-09-20 - Batching Store Upserts in Workflow Agent
**Learning:** In agentic indexing/curation workflows that process multiple items, per-item store calls (`upsert_payload`) cause severe bottlenecking due to O(N) disk re-serializations in `FileStore` or O(N) network round-trips in `AtlasStore`.
**Action:** Always provide and use batch store operations (`upsert_payloads`) for bulk updates to reduce store I/O from O(N) to O(1).
## 2026-09-29 - LRU Caching for Deterministic Token Hashing in Feature Hashing
**Learning:** In feature-hashing embedders, calculating SHA-256 digests (`hashlib.sha256`) for every word token and character trigram introduces significant CPU overhead during bulk document embedding, as tokens across documents overlap heavily.
**Action:** Use `@functools.lru_cache` on pure deterministic hashing helper functions (`_hash_dim`) to eliminate redundant SHA-256 computations across items.

## 2026-09-30 - Batch Vector Embedding Generation in Workflow Curation
**Learning:** Invoking `embedder.embed` inside an item loop during multi-document curation in `_curate` results in $O(N)$ sequential API network requests when configured with `OpenAIEmbedder`.
**Action:** Always collect document search texts and batch embedding generation using `embedder.embed_many(search_texts)` to reduce network round-trips from $O(N)$ to $O(1)$.
