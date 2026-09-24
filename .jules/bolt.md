## 2026-09-22 - Single-Pass Vector Cosine Similarity
**Learning:** In Python, calculating cosine similarity using multiple generator expressions (`sum(x * y for x, y in zip(a, b))` and `sum(x * x for x in a)`) iterates over vector elements 3 separate times and allocates generator objects. Replacing this with a single `for x, y in zip(a, b)` loop that accumulates dot product and squared sums in a single pass yields a ~1.47x speedup (~32% execution time reduction).
**Action:** When computing vector distance metrics in Python without external C dependencies (like numpy), accumulate dot product and magnitudes concurrently in a single pass over `zip(a, b)`.

## 2026-09-24 - Batch Payload Store Operations
**Learning:** In `FileStore`, calling `upsert_payload` sequentially per item re-serialized the entire `payloads.json` file to disk N times (37+ times during curation). Implementing `upsert_payloads` to accumulate payload documents and batch-write to disk once reduces curation time from ~381ms to ~85ms (~4.4x speedup / 77% runtime reduction) while preparing `AtlasStore` for `bulk_write` operations.
**Action:** Always batch store mutations during multi-item agent workflows (e.g., curation or scanning) using `upsert_payloads` rather than single-doc `upsert_payload` calls in a loop.
