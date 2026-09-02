## 2026-09-02 - Batching Store Payload Operations
**Learning:** Upserting payload documents individually in `FileStore` causes repeated full JSON re-serialization and disk writes per item (~500+ms for 37 items). Batching updates via `upsert_payloads` drops file storage overhead down to ~15ms and allows single `bulk_write` requests for `AtlasStore`.
**Action:** When updating or indexing multiple documents across agent workflows, always batch store operations to prevent I/O bottlenecks.
