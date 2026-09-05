---
"@expressive/mvc": patch
---

Resolve upstream `get()` between siblings regardless of field order. A child's `get(Type)` no longer throws when the matching sibling is declared after it on the same parent, and `get(Type, false)` and the callback form backfill when the sibling arrives. States added to a context now notify upstream consumers registered in that same context.
