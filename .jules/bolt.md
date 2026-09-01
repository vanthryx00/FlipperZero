## 2026-09-01 - Batching Payload Store Upserts

**Learning:** Invoking single-item `store.upsert_payload` sequentially in agent loops causes `FileStore` to re-serialize and write `payloads.json` to disk N times per workflow run, resulting in disk I/O bottlenecks (~740ms per curate run for 37 payloads). Similarly, it causes N network round-trips in `AtlasStore`.

**Action:** Prefer `upsert_payloads` to batch multi-item state operations into a single in-memory update and disk save (or a single `bulk_write` call for MongoDB Atlas).
