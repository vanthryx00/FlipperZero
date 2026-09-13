## 2026-09-13 - Batch Payload Upsert Optimization in Agentic Engine
**Learning:** Sequential calls to `upsert_payload` in `FileStore` triggered 37 full disk re-serializations of `payloads.json` (and would cause 37 network round-trips in `AtlasStore`). Adding `upsert_payloads` to batch writes reduced the curate step execution time from ~406ms to ~87ms.
**Action:** Always provide and prefer batching operations (`upsert_payloads`) for store updates when processing multi-item collections in agent workflows.
