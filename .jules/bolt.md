## 2026-09-04 - Batching store payload upserts

**Learning:** Individual `upsert_payload` calls during multi-file iteration (e.g. `_curate` agent across all payloads) cause redundant full-file JSON serializations in `FileStore` (saving `payloads.json` on every item) and excessive network round-trips in `AtlasStore`. Introducing `upsert_payloads` to batch document upserts reduces `_curate` execution time in `FileStore` from ~700ms down to ~80ms (>8x speedup).

**Action:** Whenever iterating through files or items to persist state into `Store` backends, aggregate documents and use bulk/batch operations like `upsert_payloads` rather than writing or sending items individually.
