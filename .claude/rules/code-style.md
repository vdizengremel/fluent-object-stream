---
paths:
  - 'src/**/*.ts'
---

# Code rules

- **No module-level mutable state** (global `WeakSet`, caches, counters…). Prefer state carried by the objects themselves, or derived from public APIs (e.g. the state of the `Readable`).
- **No redundant code**: e.g. no `=== true` when plain truthiness gives the same result.
