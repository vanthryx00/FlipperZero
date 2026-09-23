## 2026-09-22 - Single-Pass Vector Cosine Similarity
**Learning:** In Python, calculating cosine similarity using multiple generator expressions (`sum(x * y for x, y in zip(a, b))` and `sum(x * x for x in a)`) iterates over vector elements 3 separate times and allocates generator objects. Replacing this with a single `for x, y in zip(a, b)` loop that accumulates dot product and squared sums in a single pass yields a ~1.47x speedup (~32% execution time reduction).
**Action:** When computing vector distance metrics in Python without external C dependencies (like numpy), accumulate dot product and magnitudes concurrently in a single pass over `zip(a, b)`.

## 2026-09-23 - Batch Payload Store Operations
**Learning:** In multi-item agent workflows, upserting documents individually causes N disk re-serializations in file-backed stores (`FileStore`) and N sequential network round-trips in MongoDB (`AtlasStore`). Implementing batch operations (`upsert_payloads`) with O(1) index lookups in memory and a single disk write or `bulk_write` call reduces curation time by >80% (from ~467-712ms down to ~87-104ms).
**Action:** When performing state persistence over multi-item collections in agent workflows, collect items and perform batch upserts (`upsert_payloads`) instead of iterating individual store writes.
