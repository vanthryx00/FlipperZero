## 2026-09-07 - Store Payload Batch Operations
**Learning:** In multi-item agent workflows like `curate`, individually calling `upsert_payload` for each item causes repeated disk serialization (`json.dumps` and file writing) in `FileStore` or excessive network round-trips in `AtlasStore`.
**Action:** Always batch multi-document upserts with `upsert_payloads` / `bulk_write` to execute a single I/O write per curation pass.
