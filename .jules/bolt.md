## 2026-08-28 - Single-Pass Cosine Similarity & Avoid Sqrt Bypassing
**Learning:** Combining generator expressions into a single loop pass and computing math.sqrt once improves vector similarity performance cleanly. Attempting to bypass math.sqrt with loose tolerance unit-vector checks risks returning values outside [-1.0, 1.0].
**Action:** Keep mathematical invariants exact and rely on clean single-pass loops over zip for Python vector math.
