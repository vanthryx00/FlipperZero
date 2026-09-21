## 2026-09-21 - Batching Payload Upserts in Agent Workflow State Store
**Learning:** In agentic workflows processing multi-item batches (such as indexing payload files during curation), calling single-item store write methods causes extreme I/O overhead (repeated JSON disk re-serialization in FileStore, or repeated network round-trips in AtlasStore).
**Action:** Always provide batch store operations (`upsert_payloads`) using `bulk_write` for database backends and single-pass disk persistence for file backends.
