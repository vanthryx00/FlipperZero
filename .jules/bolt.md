## 2026-09-06 - Batching Store Payload Upserts

**Learning:** Individual calls to `upsert_payload` in multi-item agent workflows (such as `_curate`) cause $O(N)$ full JSON disk writes and re-serializations in `FileStore` and $N$ individual network round-trips in `AtlasStore`. Implementing a batched `upsert_payloads` method and calling it once per curation pass reduced `_curate` step runtime from ~373ms down to ~93ms (~75% reduction).

**Action:** Always batch multi-item document upserts in store operations rather than invoking per-item write/replace methods inside loops.
