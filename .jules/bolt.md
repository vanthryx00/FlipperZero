## 2026-08-29 - Feature Hash Embeddings & Trigram Counter Optimization
**Learning:** In `agentic/embed.py`, calculating SHA-256 hashes for every character trigram individually in a loop leads to heavy redundant computation on repetitive payload strings. Grouping trigrams with `Counter` prior to hashing and applying `@lru_cache` to `_hash_dim` reduced embedding computation time by over 80%.
**Action:** When performing feature hashing over sub-strings or n-grams, aggregate token counts before hashing and cache deterministic token hash calculations.
