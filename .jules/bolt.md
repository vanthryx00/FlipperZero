# Bolt Journal - Performance Learnings

## 2026-08-31 - Batching Store Payload Upserts vs LRU Caching
**Learning:** Fine-grained LRU caching on short hashing functions (`_hash_dim`) added function call and tuple wrapping overhead that made execution slower. Conversely, batching payload upserts (`upsert_payloads`) avoided disk re-serialization of `payloads.json` on every item, cutting curation state save time from ~47ms to <1ms on FileStore and reducing N Atlas network round-trips to 1 bulk write.
**Action:** Prefer batching store operations during multi-item agent workflows instead of per-item disk/network syncs; benchmark micro-optimizations on hash functions before keeping them.
