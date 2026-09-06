---
"@expressive/mvc": patch
---

Resolve upstream `get()` siblings through the parent rather than the shared context. Two `Parent.new()` instances in one process no longer cross-resolve each other's children through root, and a destroyed child's pending lookup is unregistered so a later `Parent.new()` does not throw.
