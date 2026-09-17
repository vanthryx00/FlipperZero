## 2026-09-17 - Batch Payload Store Operations

**Learning:** `FileStore.upsert_payload` re-serialized the entire `payloads.json` file to disk on every single item insert, turning multi-item curation in `_curate` into an $O(N^2)$ disk I/O bottleneck (500 items took ~50 seconds).
**Action:** Always batch multi-document store mutations using `upsert_payloads` to perform disk serialization or network bulk writes once at the end of the batch operation.
