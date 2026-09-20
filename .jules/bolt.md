## 2026-09-20 - Batching Store Upserts in Workflow Agent
**Learning:** In agentic indexing/curation workflows that process multiple items, per-item store calls (`upsert_payload`) cause severe bottlenecking due to O(N) disk re-serializations in `FileStore` or O(N) network round-trips in `AtlasStore`.
**Action:** Always provide and use batch store operations (`upsert_payloads`) for bulk updates to reduce store I/O from O(N) to O(1).
