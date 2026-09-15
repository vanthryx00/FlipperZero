## 2026-09-15 - Batch Payload Operations in FileStore and AtlasStore

**Learning:** Calling single-item `upsert_payload` in a loop inside agent workflows (such as `_curate`) causes severe I/O overhead: `FileStore` re-serializes and writes `payloads.json` to disk for every single item (37 times for 37 payloads, taking ~770ms per curate run), while `AtlasStore` incurs N individual network round-trips. Implementing `upsert_payloads` to batch writes reduces disk serialization and network calls to a single operation, accelerating `_curate` step runtime by ~8.3x (from ~770ms down to ~90ms).

**Action:** Whenever adding or updating multi-item loops in `agentic` agents, always expose and use batched store methods (`upsert_payloads`) rather than calling per-item store operations in a loop.
