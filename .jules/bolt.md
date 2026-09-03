# Bolt's Journal - Performance Insights & Learnings

## 2026-09-03 - Batching Store Operations Prevents O(N^2) Disk & Network Overhead
**Learning:** Calling individual `upsert_payload` calls in a loop causes `FileStore` to re-serialize the entire payload dataset and write to disk on every single payload ($O(N^2)$ write time complexity), while causing `AtlasStore` to perform $N$ separate network round-trips.
**Action:** When updating multiple items during curation or agent workflows, always collect items in memory and invoke batch store methods like `upsert_payloads` to perform a single disk write or `bulk_write` network operation.
