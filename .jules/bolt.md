## 2026-09-25 - Batch Upsert Store Payload Operations
**Learning:** Calling store document upserts item-by-item during agent loops (such as `_curate`) causes N sequential file locks, JSON re-serializations, and disk writes in `FileStore`, and N network round-trips in `AtlasStore`. Implementing a batched `upsert_payloads` method that performs in-memory lookup updates and a single disk write / bulk MongoDB operation reduced `_curate` execution time from 413ms to 108ms (~3.8x speedup on 37 payloads).
**Action:** When updating or indexing multiple documents in agent workflows, collect documents into a batch list and invoke store batch operations (`upsert_payloads`) rather than looping over individual store calls.

## 2026-09-22 - Single-Pass Vector Cosine Similarity
**Learning:** In Python, calculating cosine similarity using multiple generator expressions (`sum(x * y for x, y in zip(a, b))` and `sum(x * x for x in a)`) iterates over vector elements 3 separate times and allocates generator objects. Replacing this with a single `for x, y in zip(a, b)` loop that accumulates dot product and squared sums in a single pass yields a ~1.47x speedup (~32% execution time reduction).
**Action:** When computing vector distance metrics in Python without external C dependencies (like numpy), accumulate dot product and magnitudes concurrently in a single pass over `zip(a, b)`.
