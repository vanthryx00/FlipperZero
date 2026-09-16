## 2026-09-16 - Batch Payload Operations in Store Backends

**Learning:** In both `FileStore` and `AtlasStore`, updating payloads item-by-item during agent curation causes major performance bottlenecks: `FileStore` repeatedly re-serializes and writes `payloads.json` to disk once per document, while `AtlasStore` performs individual network round-trips for each upsert.
**Action:** Implement `upsert_payloads` batch operations in both store backends to perform in-memory updates with a single atomic disk write in `FileStore` and a single `bulk_write` in `AtlasStore`.
