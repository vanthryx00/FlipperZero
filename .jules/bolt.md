## 2026-09-17 - Batch Payload Store Operations

**Learning:** `FileStore.upsert_payload` re-serialized the entire `payloads.json` file to disk on every single item insert, turning multi-item curation in `_curate` into an $O(N^2)$ disk I/O bottleneck (500 items took ~50 seconds).
**Action:** Always batch multi-document store mutations using `upsert_payloads` to perform disk serialization or network bulk writes once at the end of the batch operation.
## 2026-09-20 - Batching Store Upserts in Workflow Agent
**Learning:** In agentic indexing/curation workflows that process multiple items, per-item store calls (`upsert_payload`) cause severe bottlenecking due to O(N) disk re-serializations in `FileStore` or O(N) network round-trips in `AtlasStore`.
**Action:** Always provide and use batch store operations (`upsert_payloads`) for bulk updates to reduce store I/O from O(N) to O(1).
